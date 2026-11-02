// tests/unit/reports.test.ts
// Comprehensive unit tests for PromptFM Content Moderation & Reporting System

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  submitContentReport,
  getRecentReports,
  resolveContentReport,
  formatReportAlert,
  clearMemoryReportsForTesting,
  getMemoryReports,
  REASON_LABELS,
} from '@/lib/safety/reports';
import type { ContentReport } from '@/types/database';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

const mockBroadcast = vi.fn();
const mockSendEmail = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: mockInsert,
      update: (data: any) => ({
        eq: mockEq.mockReturnValue({ data: null, error: null }),
      }),
      select: () => ({
        order: () => ({
          limit: mockLimit,
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/chat/bridge', () => ({
  broadcastToCommunity: (...args: any[]) => mockBroadcast(...args),
}));

vi.mock('@/lib/email/resend', () => ({
  sendContentReportAlert: (...args: any[]) => mockSendEmail(...args),
}));

describe('Content Reporting Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMemoryReportsForTesting();
    mockInsert.mockResolvedValue({ error: null });
    mockBroadcast.mockResolvedValue({ success: true });
    mockSendEmail.mockResolvedValue({ success: true, id: 'email-123' });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  describe('REASON_LABELS mapping', () => {
    it('correctly maps all valid report reasons to human-readable labels', () => {
      expect(REASON_LABELS.copyright_dmca).toBe('DMCA & Copyright Infringement');
      expect(REASON_LABELS.hate_harassment).toBe('Hate Speech, Harassment or Defamation');
      expect(REASON_LABELS.religious_ethical).toBe('Religious Mockery or Ethical Violation');
      expect(REASON_LABELS.unlabeled_18_plus).toBe('Unlabeled Adult / Explicit Content (18+)');
      expect(REASON_LABELS.spam_abuse).toBe('Spam, Flooding or Deceptive Metadata');
      expect(REASON_LABELS.other).toBe('Other Community Guidelines Violation');
    });
  });

  describe('formatReportAlert', () => {
    it('formats alert with all optional fields present', () => {
      const report: ContentReport = {
        id: 'rep_12345',
        target_type: 'track',
        target_id: 'trk_999',
        reason: 'copyright_dmca',
        details: 'Infringing sample detected',
        reporter_platform: 'web',
        reporter_id: 'dmca_agent',
        status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
      };

      const text = formatReportAlert(report);
      expect(text).toContain('🚨 **PROMPTFM CONTENT REPORT FILED**');
      expect(text).toContain('• **Target:** `track` (trk_999)');
      expect(text).toContain('• **Reason:** DMCA & Copyright Infringement');
      expect(text).toContain('• **Platform:** WEB');
      expect(text).toContain('• **Reporter:** dmca_agent');
      expect(text).toContain('• **Details:** "Infringing sample detected"');
      expect(text).toContain('• **Ticket ID:** `rep_12345`');
    });

    it('formats alert when reporter_id and details are absent', () => {
      const report: ContentReport = {
        id: 'rep_minimal',
        target_type: 'broadcast',
        target_id: 'stream',
        reason: 'other',
        details: null,
        reporter_platform: 'discord',
        reporter_id: null,
        status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
      };

      const text = formatReportAlert(report);
      expect(text).not.toContain('• **Reporter:**');
      expect(text).not.toContain('• **Details:**');
      expect(text).toContain('• **Ticket ID:** `rep_minimal`');
    });
  });

  describe('submitContentReport', () => {
    it('creates and records a valid DMCA report with database persistence and notifications', async () => {
      const result = await submitContentReport({
        target_type: 'track',
        target_id: '  track-uuid-9999  ',
        reason: 'copyright_dmca',
        details: 'Unlicensed vocal rip from studio record',
        reporter_platform: 'web',
        reporter_id: '  artist_label_rep  ',
      });

      expect(result.success).toBe(true);
      expect(result.reportId).toMatch(/^rep_\d+_[a-z0-9]+$/);
      expect(result.message).toBe('Report received and routed to the station safety desk.');
      expect(result.report.target_id).toBe('track-uuid-9999');
      expect(result.report.reporter_id).toBe('artist_label_rep');
      expect(result.report.details).toBe('Unlicensed vocal rip from studio record');
      expect(result.report.status).toBe('pending');
      expect(getMemoryReports()).toHaveLength(1);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result.reportId,
          target_type: 'track',
          target_id: 'track-uuid-9999',
          reason: 'copyright_dmca',
          reporter_id: 'artist_label_rep',
          status: 'pending',
        })
      );

      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '🚨 Content Moderation Alert',
          category: 'announcement',
          message: expect.stringContaining('DMCA & Copyright Infringement'),
        })
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result.reportId,
          reason: 'copyright_dmca',
        })
      );
    });

    it('submits report without optional details or reporter_id cleanly', async () => {
      const result = await submitContentReport({
        target_type: 'broadcast',
        target_id: 'live-stream',
        reason: 'unlabeled_18_plus',
        reporter_platform: 'mcp',
      });

      expect(result.success).toBe(true);
      expect(result.report.details).toBeNull();
      expect(result.report.reporter_id).toBeNull();
    });

    it('handles database write failure gracefully and continues with in-memory persistence', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockInsert.mockRejectedValueOnce(new Error('PostgreSQL connection timeout'));

      const result = await submitContentReport({
        target_type: 'track',
        target_id: 'track-offline-db',
        reason: 'spam_abuse',
        reporter_platform: 'telegram',
      });

      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Safety Reports] Supabase insert note'),
        expect.any(Error)
      );
      consoleWarnSpy.mockRestore();
    });

    it('handles broadcast or email notification failures gracefully without throwing', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockBroadcast.mockRejectedValueOnce(new Error('Discord rate limit'));
      mockSendEmail.mockRejectedValueOnce(new Error('Resend SMTP error'));

      const result = await submitContentReport({
        target_type: 'track',
        target_id: 'track-notify-fail',
        reason: 'other',
        reporter_platform: 'discord',
      });

      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Safety Reports] Could not broadcast moderation alert:'),
        expect.any(Error)
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Safety Reports] Could not send Resend moderation email:'),
        expect.any(Error)
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getRecentReports', () => {
    it('returns reports from database when available', async () => {
      const mockDbReports: ContentReport[] = [
        {
          id: 'rep_db_1',
          target_type: 'track',
          target_id: 'track_1',
          reason: 'copyright_dmca',
          details: 'DB report',
          reporter_platform: 'web',
          reporter_id: null,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ];

      mockLimit.mockResolvedValueOnce({ data: mockDbReports, error: null });

      const reports = await getRecentReports(5);
      expect(reports).toEqual(mockDbReports);
    });

    it('falls back to in-memory reports when database query throws or returns empty', async () => {
      await submitContentReport({
        target_type: 'track',
        target_id: 'memory-track',
        reason: 'hate_harassment',
        reporter_platform: 'web',
      });

      mockLimit.mockRejectedValueOnce(new Error('Database unavailable'));

      const reports = await getRecentReports(10);
      expect(reports).toHaveLength(1);
      expect(reports[0]?.target_id).toBe('memory-track');
    });

    it('uses default limit of 20 when limit parameter is omitted', async () => {
      mockLimit.mockResolvedValueOnce({ data: [], error: null });
      const reports = await getRecentReports();
      expect(reports).toEqual([]);
    });
  });

  describe('resolveContentReport', () => {
    it('resolves an existing report in memory and updates database', async () => {
      const submitted = await submitContentReport({
        target_type: 'track',
        target_id: 'track-to-resolve-100',
        reason: 'spam_abuse',
        reporter_platform: 'web',
      });

      const resActioned = await resolveContentReport(submitted.reportId, 'actioned', 'Track removed');
      expect(resActioned.success).toBe(true);
      expect(resActioned.reportId).toBe(submitted.reportId);
      expect(resActioned.status).toBe('actioned');
      expect(resActioned.notes).toBe('Track removed');
      expect(mockEq).toHaveBeenCalledWith('id', submitted.reportId);

      const memReports = getMemoryReports();
      expect(memReports.find((r) => r.id === submitted.reportId)?.status).toBe('actioned');

      const resDismissed = await resolveContentReport(submitted.reportId, 'dismissed');
      expect(resDismissed.success).toBe(true);
      expect(resDismissed.status).toBe('dismissed');
      expect(memReports.find((r) => r.id === submitted.reportId)?.status).toBe('dismissed');
    });

    it('handles resolving a report that is not in memory without error', async () => {
      const res = await resolveContentReport('non-existent-report-id', 'dismissed');
      expect(res.success).toBe(true);
      expect(res.reportId).toBe('non-existent-report-id');
      expect(res.status).toBe('dismissed');
    });

    it('handles database error during resolution gracefully and logs warning', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockEq.mockImplementationOnce(() => {
        throw new Error('Supabase network error');
      });

      const res = await resolveContentReport('some-id', 'actioned');
      expect(res.success).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Safety Reports] Supabase update note'),
        expect.any(Error)
      );
      consoleWarnSpy.mockRestore();
    });
  });
});
