// src/lib/safety/reports.ts
// Central Content Moderation & Reporting Service
// Manages community safety reports across Web UI, Discord, Telegram, and MCP.
// Sends high-priority moderation alerts to admins on Discord and Telegram.

import { createAdminClient } from '../supabase/server';
import { broadcastToCommunity } from '../chat/bridge';
import { sendContentReportAlert } from '../email/resend';
import {
  type ContentReport,
  type ReportReason,
  type ReportTargetType,
  type ReporterPlatform,
  REASON_LABELS,
} from '../../types/database';

export { REASON_LABELS };

// In-memory reports cache (instant fallback access)
let memoryReports: ContentReport[] = [];

export function getMemoryReports(): ContentReport[] {
  return memoryReports;
}

export function clearMemoryReportsForTesting(): void {
  memoryReports = [];
}

export interface SubmitReportInput {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details?: string;
  reporter_platform: ReporterPlatform;
  reporter_id?: string;
}

export function formatReportAlert(report: ContentReport): string {
  const parts = [
    `🚨 **PROMPTFM CONTENT REPORT FILED**`,
    `• **Target:** \`${report.target_type}\` (${report.target_id})`,
    `• **Reason:** ${REASON_LABELS[report.reason] || report.reason}`,
    `• **Platform:** ${report.reporter_platform.toUpperCase()}`,
  ];
  if (report.reporter_id) {
    parts.push(`• **Reporter:** ${report.reporter_id}`);
  }
  if (report.details) {
    parts.push(`• **Details:** "${report.details}"`);
  }
  parts.push(`• **Ticket ID:** \`${report.id}\``);
  return parts.join('\n');
}

/**
 * Submits a new content report, logs it, and dispatches an alert to admin channels.
 */
export async function submitContentReport(input: SubmitReportInput): Promise<{
  success: boolean;
  reportId: string;
  message: string;
  report: ContentReport;
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

  memoryReports.unshift(newReport);

  // Attempt DB write
  try {
    const supabase = createAdminClient();
    await supabase.from('content_reports').insert(newReport);
  } catch (err) {
    console.warn('[Safety Reports] Supabase insert note (using memory fallback):', err);
  }

  // Dispatch high-priority moderation notification to Discord & Telegram
  try {
    await broadcastToCommunity({
      title: '🚨 Content Moderation Alert',
      message: formatReportAlert(newReport),
      category: 'announcement',
    });
  } catch (e) {
    console.warn('[Safety Reports] Could not broadcast moderation alert:', e);
  }

  // Dispatch moderation email alert via Resend
  try {
    await sendContentReportAlert(newReport);
  } catch (e) {
    console.warn('[Safety Reports] Could not send Resend moderation email:', e);
  }

  return {
    success: true,
    reportId,
    message: 'Report received and routed to the station safety desk.',
    report: newReport,
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
    // Return memory fallback on DB failure
  }

  return memoryReports.slice(0, limit);
}

/**
 * Resolves or updates the moderation status of a report (actioned or dismissed).
 */
export async function resolveContentReport(
  reportId: string,
  status: 'actioned' | 'dismissed',
  notes?: string
): Promise<{ success: boolean; reportId: string; status: string; notes?: string }> {
  const report = memoryReports.find((r) => r.id === reportId);
  if (report) {
    report.status = status;
  }

  // Update in database if configured
  try {
    const supabase = createAdminClient();
    await supabase
      .from('content_reports')
      .update({ status })
      .eq('id', reportId);
  } catch (err) {
    console.warn('[Safety Reports] Supabase update note (memory fallback updated):', err);
  }

  return {
    success: true,
    reportId,
    status,
    notes,
  };
}
