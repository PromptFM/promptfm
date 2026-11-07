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
 * Quarantines or disables a track immediately from active broadcast rotation and charts.
 */
export async function quarantineInfringingTrack(
  trackId: string,
  reason = 'Copyright DMCA takedown'
): Promise<{ success: boolean; trackId: string; action: string; reason: string }> {
  try {
    const supabase = createAdminClient();
    await supabase.from('tracks').update({ status: 'rejected' }).eq('id', trackId);
  } catch (err) {
    console.warn('[Safety Reports] Quarantine track note:', err);
  }

  return {
    success: true,
    trackId,
    action: 'quarantined',
    reason,
  };
}

export interface ContentReportAuditItem {
  report: ContentReport;
  severity: 'high' | 'medium' | 'low';
  issue: 'unaudited_resolution' | 'suspicious_dismissal' | 'missing_metadata' | 'clean';
  message: string;
  recommendation: string;
}

export interface ContentReportAuditSummary {
  total_reports: number;
  pending_count: number;
  actioned_count: number;
  dismissed_count: number;
  reviewed_count: number;
  unaudited_count: number;
  suspicious_count: number;
  flagged_items: ContentReportAuditItem[];
  clean: boolean;
  timestamp: string;
}

export interface AuditReportsOptions {
  limit?: number;
  includeClean?: boolean;
}

/**
 * Resolves or updates the moderation status of a report (actioned or dismissed).
 * Attaches actor attribution, timestamp, and explanation notes for audit compliance.
 */
export async function resolveContentReport(
  reportId: string,
  status: 'actioned' | 'dismissed',
  notes?: string,
  actor?: string
): Promise<{
  success: boolean;
  reportId: string;
  status: string;
  notes?: string;
  resolved_by: string;
  resolved_at: string;
}> {
  const resolvedAt = new Date().toISOString();
  const resolvedBy = actor && actor.trim() ? actor.trim() : 'system_admin';

  const report = memoryReports.find((r) => r.id === reportId);
  if (report) {
    report.status = status;
    report.notes = notes || null;
    report.resolved_by = resolvedBy;
    report.resolved_at = resolvedAt;
    if (status === 'actioned' && report.target_type === 'track') {
      await quarantineInfringingTrack(report.target_id, notes || 'Actioned report takedown');
    }
  }

  // Update in database if configured
  try {
    const supabase = createAdminClient();
    await supabase
      .from('content_reports')
      .update({
        status,
        notes: notes || null,
        resolved_by: resolvedBy,
        resolved_at: resolvedAt,
      })
      .eq('id', reportId);
  } catch (err) {
    console.warn('[Safety Reports] Supabase update note (memory fallback updated):', err);
  }

  return {
    success: true,
    reportId,
    status,
    notes,
    resolved_by: resolvedBy,
    resolved_at: resolvedAt,
  };
}

/**
 * Audits content moderation reports to detect status changes made during unauthenticated windows
 * (e.g. without recorded actor or timestamp attribution, or suspicious dismissal of DMCA / harassment reports).
 */
export async function auditContentReports(
  options: AuditReportsOptions = {}
): Promise<ContentReportAuditSummary> {
  const limit = typeof options.limit === 'number' && options.limit > 0 ? options.limit : 100;
  let reports: ContentReport[] = [];

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('content_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (data && data.length > 0) {
      reports = data as ContentReport[];
    }
  } catch {
    // Fall back to memory cache if DB fails
  }

  if (reports.length === 0) {
    reports = memoryReports.slice(0, limit);
  }

  let pending_count = 0;
  let actioned_count = 0;
  let dismissed_count = 0;
  let reviewed_count = 0;
  let unaudited_count = 0;
  let suspicious_count = 0;
  const flagged_items: ContentReportAuditItem[] = [];

  for (const report of reports) {
    if (report.status === 'pending') {
      pending_count++;
      continue;
    }

    if (report.status === 'actioned') {
      actioned_count++;
    } else if (report.status === 'dismissed') {
      dismissed_count++;
    } else if (report.status === 'reviewed') {
      reviewed_count++;
    }

    const hasActor = Boolean(report.resolved_by && report.resolved_by.trim());
    const hasTimestamp = Boolean(report.resolved_at && report.resolved_at.trim());
    const isHighPriority =
      report.reason === 'copyright_dmca' || report.reason === 'hate_harassment';

    // Check 1: Actioned or dismissed without actor attribution or timestamp (unauthenticated window modification)
    if (!hasActor || !hasTimestamp) {
      unaudited_count++;
      if (isHighPriority) {
        suspicious_count++;
        flagged_items.push({
          report,
          severity: 'high',
          issue: report.status === 'dismissed' ? 'suspicious_dismissal' : 'unaudited_resolution',
          message: `${report.reason === 'copyright_dmca' ? 'DMCA' : 'Hate speech / harassment'} report ${report.id} was ${report.status} without actor attribution or timestamp.`,
          recommendation: `Verify ${report.target_type} ${report.target_id} immediately to ensure proper moderation enforcement.`,
        });
      } else {
        flagged_items.push({
          report,
          severity: 'medium',
          issue: 'unaudited_resolution',
          message: `Report ${report.id} (${report.reason}) was ${report.status} without recorded actor or timestamp.`,
          recommendation: `Verify moderation decision with station administrators and backfill audit log.`,
        });
      }
      continue;
    }

    // Check 2: High priority report dismissed without explanatory notes
    if (report.status === 'dismissed' && isHighPriority && (!report.notes || !report.notes.trim())) {
      suspicious_count++;
      flagged_items.push({
        report,
        severity: 'medium',
        issue: 'missing_metadata',
        message: `High-priority report ${report.id} (${report.reason}) was dismissed without explanatory resolution notes.`,
        recommendation: `Require moderator to document dismissal justification for legal record.`,
      });
      continue;
    }
  }

  const clean = unaudited_count === 0 && suspicious_count === 0;

  return {
    total_reports: reports.length,
    pending_count,
    actioned_count,
    dismissed_count,
    reviewed_count,
    unaudited_count,
    suspicious_count,
    flagged_items,
    clean,
    timestamp: new Date().toISOString(),
  };
}
