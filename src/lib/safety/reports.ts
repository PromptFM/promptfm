// src/lib/safety/reports.ts
// Central Content Moderation & Reporting Service
// Manages community safety reports across Web UI, Discord, Telegram, and MCP.
// Sends high-priority moderation alerts to admins on Discord and Telegram.

import { createAdminClient } from '../supabase/server';
import { broadcastToCommunity } from '../chat/bridge';
import { type ContentReport, type ReportReason, type ReportTargetType, type ReporterPlatform, REASON_LABELS } from '../../types/database';
import { existsSync, readFileSync, writeFileSync } from 'fs';

export { REASON_LABELS };

const PERSISTENT_REPORTS_FILE = '/tmp/promptfm_reports.json';

function loadFallbackReports(): ContentReport[] {
  try {
    if (existsSync(PERSISTENT_REPORTS_FILE)) {
      const content = readFileSync(PERSISTENT_REPORTS_FILE, 'utf8');
      return JSON.parse(content) as ContentReport[];
    }
  } catch {
    // Ignore read errors
  }
  return [];
}

function saveFallbackReports(reports: ContentReport[]) {
  try {
    writeFileSync(PERSISTENT_REPORTS_FILE, JSON.stringify(reports.slice(0, 100), null, 2), 'utf8');
  } catch {
    // Ignore write errors
  }
}

export interface SubmitReportInput {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details?: string;
  reporter_platform: ReporterPlatform;
  reporter_id?: string;
}

/**
 * Submits a new content report, logs it, and dispatches an alert to admin channels.
 */
export async function submitContentReport(input: SubmitReportInput): Promise<{
  success: boolean;
  reportId: string;
  message: string;
}> {
  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newReport: ContentReport = {
    id: reportId,
    target_type: input.target_type,
    target_id: input.target_id.trim(),
    reason: input.reason,
    details: input.details?.trim() || null,
    reporter_platform: input.reporter_platform,
    reporter_id: input.reporter_id?.trim() || null,
    status: 'pending',
    created_at: now,
  };

  const currentReports = loadFallbackReports();
  currentReports.unshift(newReport);
  saveFallbackReports(currentReports);

  // Attempt DB write
  try {
    const supabase = createAdminClient();
    await supabase.from('content_reports').insert({
      id: newReport.id,
      target_type: newReport.target_type,
      target_id: newReport.target_id,
      reason: newReport.reason,
      details: newReport.details,
      reporter_platform: newReport.reporter_platform,
      reporter_id: newReport.reporter_id,
      status: 'pending',
      created_at: newReport.created_at,
    });
  } catch (err) {
    console.warn('[Safety Reports] Supabase insert note (using memory fallback):', err);
  }

  // Dispatch high-priority moderation notification to Discord & Telegram
  const alertText = [
    `🚨 **PROMPTFM CONTENT REPORT FILED**`,
    `• **Target:** \`${newReport.target_type}\` (${newReport.target_id})`,
    `• **Reason:** ${REASON_LABELS[newReport.reason] || newReport.reason}`,
    `• **Platform:** ${newReport.reporter_platform.toUpperCase()}`,
    newReport.reporter_id ? `• **Reporter:** ${newReport.reporter_id}` : null,
    newReport.details ? `• **Details:** "${newReport.details}"` : null,
    `• **Ticket ID:** \`${reportId}\``,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await broadcastToCommunity({
      title: '🚨 Content Moderation Alert',
      message: alertText,
      category: 'announcement',
    });
  } catch (e) {
    console.warn('[Safety Reports] Could not broadcast moderation alert:', e);
  }

  return {
    success: true,
    reportId,
    message: 'Report received and routed to the station safety desk.',
  };
}

/**
 * Returns recent reports for the admin dashboard or audit checks.
 */
export async function getRecentReports(limit = 20): Promise<ContentReport[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('content_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (data && data.length > 0) {
      return data as ContentReport[];
    }
  } catch {
    // Return persistent file fallback
  }

  return loadFallbackReports().slice(0, limit);
}
