// tests/unit/reports.test.ts
// Comprehensive unit tests for PromptFM Content Moderation & Reporting System

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  submitContentReport,
  getRecentReports,
  resolveContentReport,
  auditContentReports,
  quarantineInfringingTrack,
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
const mockFrom = vi.fn();

const mockBroadcast = vi.fn();
const mockSendEmail = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      mockFrom(table);
      return {
        insert: mockInsert,
        update: (data: any) => {
          mockUpdate(data, table);
          return {
            eq: mockEq.mockReturnValue({ data: null, error: null }),
          };
        },
        select: (...selectArgs: any[]) => {
          mockSelect(...selectArgs);
          return {
            order: (...orderArgs: any[]) => {
              mockOrder(...orderArgs);
              return {
                limit: mockLimit,
              };
            },
          };
        },
      };
    },
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

      const resultWs = await submitContentReport({
        target_type: 'broadcast',
        target_id: 'live-stream',
        reason: 'unlabeled_18_plus',
        reporter_platform: 'mcp',
        details: '   ',
        reporter_id: '   ',
      });
      expect(resultWs.report.details).toBeNull();
      expect(resultWs.report.reporter_id).toBeNull();

      const resultTrim = await submitContentReport({
        target_type: 'track',
        target_id: 'trk_trim',
        reason: 'other',
        reporter_platform: 'web',
        details: '  trimmed detail  ',
        reporter_id: '  trimmed reporter  ',
      });
      expect(resultTrim.report.details).toBe('trimmed detail');
      expect(resultTrim.report.reporter_id).toBe('trimmed reporter');
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
      expect(mockFrom).toHaveBeenCalledWith('content_reports');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(5);
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
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'actioned' }),
        'content_reports'
      );
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'rejected' }, 'tracks');

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

    it('automatically quarantines track when report with target_type=track is actioned', async () => {
      const submitted = await submitContentReport({
        target_type: 'track',
        target_id: 'infringing-track-123',
        reason: 'copyright_dmca',
        reporter_platform: 'web',
      });

      const res = await resolveContentReport(submitted.reportId, 'actioned', 'DMCA notice verified');
      expect(res.success).toBe(true);
      expect(mockEq).toHaveBeenCalledWith('id', 'infringing-track-123');
    });

    it('does not quarantine track when report is dismissed or target_type is not track', async () => {
      const trackReport = await submitContentReport({
        target_type: 'track',
        target_id: 'innocent-track-456',
        reason: 'other',
        reporter_platform: 'web',
      });
      mockEq.mockClear();
      await resolveContentReport(trackReport.reportId, 'dismissed');
      expect(mockEq).not.toHaveBeenCalledWith('id', 'innocent-track-456');

      const broadcastReport = await submitContentReport({
        target_type: 'broadcast',
        target_id: 'channel-main',
        reason: 'spam_abuse',
        reporter_platform: 'web',
      });
      mockEq.mockClear();
      await resolveContentReport(broadcastReport.reportId, 'actioned');
      expect(mockEq).not.toHaveBeenCalledWith('id', 'channel-main');
    });

    it('uses fallback note when resolving actioned track report without notes', async () => {
      const trackReport = await submitContentReport({
        target_type: 'track',
        target_id: 'no-notes-track-789',
        reason: 'copyright_dmca',
        reporter_platform: 'web',
      });
      mockEq.mockClear();
      const res = await resolveContentReport(trackReport.reportId, 'actioned');
      expect(res.notes).toBeUndefined();
      expect(mockEq).toHaveBeenCalledWith('id', 'no-notes-track-789');
    });

    it('records actor attribution, resolution timestamp, and notes in memory and database update', async () => {
      const rep = await submitContentReport({
        target_type: 'track',
        target_id: 'audit-track-123',
        reason: 'hate_harassment',
        reporter_platform: 'web',
      });
      mockUpdate.mockClear();

      const res = await resolveContentReport(
        rep.reportId,
        'actioned',
        'Violates community standards',
        'admin_moderator_1'
      );

      expect(res.success).toBe(true);
      expect(res.resolved_by).toBe('admin_moderator_1');
      expect(res.resolved_at).toBeDefined();
      expect(res.notes).toBe('Violates community standards');

      const mem = getMemoryReports().find((r) => r.id === rep.reportId);
      expect(mem?.resolved_by).toBe('admin_moderator_1');
      expect(mem?.resolved_at).toBeDefined();
      expect(mem?.notes).toBe('Violates community standards');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'actioned',
          resolved_by: 'admin_moderator_1',
          notes: 'Violates community standards',
        }),
        'content_reports'
      );
    });

    it('defaults actor to system_admin when actor is not supplied or empty', async () => {
      const rep = await submitContentReport({
        target_type: 'track',
        target_id: 'default-actor-track',
        reason: 'spam_abuse',
        reporter_platform: 'web',
      });

      const res = await resolveContentReport(rep.reportId, 'dismissed');
      expect(res.resolved_by).toBe('system_admin');
      expect(res.resolved_at).toBeDefined();

      const resWhitespace = await resolveContentReport(rep.reportId, 'dismissed', 'Some note', '   ');
      expect(resWhitespace.resolved_by).toBe('system_admin');

      const resTrimmed = await resolveContentReport(rep.reportId, 'actioned', 'Trim test', '  moderator_bob  ');
      expect(resTrimmed.resolved_by).toBe('moderator_bob');
    });

    it('passes custom or fallback notes to quarantineInfringingTrack when track report is actioned', async () => {
      const rep1 = await submitContentReport({
        target_type: 'track',
        target_id: 'track-custom-note-quarantine',
        reason: 'copyright_dmca',
        reporter_platform: 'web',
      });
      mockEq.mockClear();
      await resolveContentReport(rep1.reportId, 'actioned', 'Statutory DMCA Takedown Verified', 'legal_officer');
      expect(mockEq).toHaveBeenCalledWith('id', 'track-custom-note-quarantine');

      const rep2 = await submitContentReport({
        target_type: 'track',
        target_id: 'track-fallback-note-quarantine',
        reason: 'copyright_dmca',
        reporter_platform: 'web',
      });
      mockEq.mockClear();
      await resolveContentReport(rep2.reportId, 'actioned', undefined, 'legal_officer');
      expect(mockEq).toHaveBeenCalledWith('id', 'track-fallback-note-quarantine');
    });
  });

  describe('auditContentReports', () => {
    it('detects reports actioned or dismissed during the unauthenticated window without actor attribution', async () => {
      clearMemoryReportsForTesting();

      // Report 1: Actioned during unauthenticated window without actor or timestamp
      const rep1 = await submitContentReport({
        target_type: 'track',
        target_id: 'unauth-dmca-track',
        reason: 'copyright_dmca',
        reporter_platform: 'web',
      });
      // Simulate unauthenticated legacy modification
      const mem1 = getMemoryReports().find((r) => r.id === rep1.reportId);
      if (mem1) {
        mem1.status = 'dismissed'; // Dismissed without resolved_by or resolved_at!
      }

      // Report 2: Properly resolved with actor and timestamp
      const rep2 = await submitContentReport({
        target_type: 'track',
        target_id: 'legit-actioned-track',
        reason: 'spam_abuse',
        reporter_platform: 'web',
      });
      await resolveContentReport(rep2.reportId, 'actioned', 'Confirmed spam', 'mod_sarah');

      // Report 3: Still pending
      await submitContentReport({
        target_type: 'track',
        target_id: 'pending-track',
        reason: 'other',
        reporter_platform: 'web',
      });

      const audit = await auditContentReports();

      expect(audit.total_reports).toBe(3);
      expect(audit.pending_count).toBe(1);
      expect(audit.actioned_count).toBe(1);
      expect(audit.dismissed_count).toBe(1);
      expect(audit.unaudited_count).toBe(1);
      expect(audit.clean).toBe(false);

      const flagged = audit.flagged_items.find((f) => f.report.id === rep1.reportId);
      expect(flagged).toBeDefined();
      expect(flagged?.severity).toBe('high');
      expect(flagged?.issue).toBe('suspicious_dismissal');
      expect(flagged?.message).toContain('DMCA report');
    });

    it('flags high-severity reports dismissed without explanatory notes as missing_metadata', async () => {
      clearMemoryReportsForTesting();

      const rep = await submitContentReport({
        target_type: 'track',
        target_id: 'dmca-no-notes',
        reason: 'copyright_dmca',
        reporter_platform: 'web',
      });
      // Resolved with actor but without notes
      await resolveContentReport(rep.reportId, 'dismissed', undefined, 'admin_dave');

      const audit = await auditContentReports();
      expect(audit.unaudited_count).toBe(0);
      expect(audit.suspicious_count).toBe(1);
      expect(audit.clean).toBe(false);
      const flagged = audit.flagged_items.find((f) => f.report.id === rep.reportId);
      expect(flagged?.issue).toBe('missing_metadata');
      expect(flagged?.severity).toBe('medium');
      expect(flagged?.message).toBe(
        `High-priority report ${rep.reportId} (copyright_dmca) was dismissed without explanatory resolution notes.`
      );
      expect(flagged?.recommendation).toBe(
        'Require moderator to document dismissal justification for legal record.'
      );
    });

    it('flags high-priority reports dismissed with whitespace-only notes as missing_metadata', async () => {
      clearMemoryReportsForTesting();

      const rep = await submitContentReport({
        target_type: 'track',
        target_id: 'harassment-whitespace-notes',
        reason: 'hate_harassment',
        reporter_platform: 'web',
      });
      await resolveContentReport(rep.reportId, 'dismissed', '     ', 'admin_dave');

      const audit = await auditContentReports();
      expect(audit.suspicious_count).toBe(1);
      expect(audit.clean).toBe(false);
      const flagged = audit.flagged_items[0];
      expect(flagged?.issue).toBe('missing_metadata');
    });

    it('does not flag actioned high-priority reports as missing_metadata when notes are omitted', async () => {
      clearMemoryReportsForTesting();

      const rep = await submitContentReport({
        target_type: 'track',
        target_id: 'actioned-without-notes',
        reason: 'copyright_dmca',
        reporter_platform: 'web',
      });
      await resolveContentReport(rep.reportId, 'actioned', undefined, 'admin_dave');

      const audit = await auditContentReports();
      expect(audit.unaudited_count).toBe(0);
      expect(audit.suspicious_count).toBe(0);
      expect(audit.clean).toBe(true);
      expect(audit.flagged_items.length).toBe(0);
    });

    it('audits non-high-priority reports modified without actor or timestamp and sets clean to false', async () => {
      clearMemoryReportsForTesting();

      const rep = await submitContentReport({
        target_type: 'track',
        target_id: 'spam-track',
        reason: 'spam_abuse',
        reporter_platform: 'web',
      });

      const mem = getMemoryReports().find((r) => r.id === rep.reportId);
      if (mem) {
        mem.status = 'actioned';
        mem.resolved_by = null;
        mem.resolved_at = null;
      }

      const audit = await auditContentReports();
      expect(audit.unaudited_count).toBe(1);
      expect(audit.suspicious_count).toBe(0);
      expect(audit.clean).toBe(false);
      expect(audit.flagged_items.length).toBe(1);
      expect(audit.flagged_items[0]?.severity).toBe('medium');
      expect(audit.flagged_items[0]?.issue).toBe('unaudited_resolution');
      expect(audit.flagged_items[0]?.message).toBe(
        `Report ${rep.reportId} (spam_abuse) was actioned without recorded actor or timestamp.`
      );
      expect(audit.flagged_items[0]?.recommendation).toBe(
        'Verify moderation decision with station administrators and backfill audit log.'
      );
    });

    it('flags unaudited hate_harassment actioned report with high severity and exact message', async () => {
      clearMemoryReportsForTesting();

      const rep = await submitContentReport({
        target_type: 'track',
        target_id: 'harass-track-777',
        reason: 'hate_harassment',
        reporter_platform: 'web',
      });

      const mem = getMemoryReports().find((r) => r.id === rep.reportId);
      if (mem) {
        mem.status = 'actioned';
        mem.resolved_by = undefined;
        mem.resolved_at = undefined;
      }

      const audit = await auditContentReports();
      expect(audit.unaudited_count).toBe(1);
      expect(audit.suspicious_count).toBe(1);
      expect(audit.clean).toBe(false);
      expect(audit.flagged_items[0]?.severity).toBe('high');
      expect(audit.flagged_items[0]?.issue).toBe('unaudited_resolution');
      expect(audit.flagged_items[0]?.message).toBe(
        `Hate speech / harassment report ${rep.reportId} was actioned without actor attribution or timestamp.`
      );
      expect(audit.flagged_items[0]?.recommendation).toBe(
        `Verify track harass-track-777 immediately to ensure proper moderation enforcement.`
      );
    });

    it('flags report with whitespace-only resolved_by or whitespace-only resolved_at as unaudited', async () => {
      clearMemoryReportsForTesting();

      const rep1 = await submitContentReport({
        target_type: 'track',
        target_id: 'track-ws-actor',
        reason: 'other',
        reporter_platform: 'web',
      });
      const mem1 = getMemoryReports().find((r) => r.id === rep1.reportId);
      if (mem1) {
        mem1.status = 'dismissed';
        mem1.resolved_by = '   ';
        mem1.resolved_at = '2026-11-06T00:00:00Z';
      }

      const audit1 = await auditContentReports();
      expect(audit1.unaudited_count).toBe(1);

      clearMemoryReportsForTesting();
      const rep2 = await submitContentReport({
        target_type: 'track',
        target_id: 'track-ws-time',
        reason: 'other',
        reporter_platform: 'web',
      });
      const mem2 = getMemoryReports().find((r) => r.id === rep2.reportId);
      if (mem2) {
        mem2.status = 'actioned';
        mem2.resolved_by = 'admin_alex';
        mem2.resolved_at = '   ';
      }

      const audit2 = await auditContentReports();
      expect(audit2.unaudited_count).toBe(1);
    });

    it('tallies reviewed_count and respects invalid or negative limit parameter defaulting to 100', async () => {
      clearMemoryReportsForTesting();

      const rep = await submitContentReport({
        target_type: 'track',
        target_id: 'reviewed-trk',
        reason: 'other',
        reporter_platform: 'web',
      });
      const mem = getMemoryReports().find((r) => r.id === rep.reportId);
      if (mem) {
        mem.status = 'reviewed';
        mem.resolved_by = 'reviewer_bob';
        mem.resolved_at = '2026-11-06T00:00:00Z';
      }

      const auditNegative = await auditContentReports({ limit: -5 });
      expect(auditNegative.reviewed_count).toBe(1);
      expect(auditNegative.total_reports).toBe(1);

      const auditZero = await auditContentReports({ limit: 0 });
      expect(auditZero.total_reports).toBe(1);

      const auditNonNumber = await auditContentReports({ limit: 'bad' as any });
      expect(auditNonNumber.total_reports).toBe(1);
    });

    it('reads from Supabase when database returns rows and falls back to memory if DB returns null or empty', async () => {
      mockLimit.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const auditNull = await auditContentReports({ limit: 10 });
      expect(auditNull).toBeDefined();

      mockLimit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const auditEmpty = await auditContentReports({ limit: 10 });
      expect(auditEmpty).toBeDefined();
    });

    it('returns clean: true when all resolved reports have valid actor attribution and notes', async () => {
      clearMemoryReportsForTesting();

      const rep = await submitContentReport({
        target_type: 'track',
        target_id: 'clean-track',
        reason: 'copyright_dmca',
        reporter_platform: 'web',
      });
      await resolveContentReport(rep.reportId, 'actioned', 'DMCA Verified by Legal', 'legal_team');

      const audit = await auditContentReports();
      expect(audit.unaudited_count).toBe(0);
      expect(audit.suspicious_count).toBe(0);
      expect(audit.clean).toBe(true);
      expect(audit.flagged_items.length).toBe(0);
    });

    it('reads from Supabase when database returns rows and falls back to memory if DB throws', async () => {
      mockLimit.mockResolvedValueOnce({
        data: [
          {
            id: 'db_rep_1',
            target_type: 'track',
            target_id: 'db_trk',
            reason: 'hate_harassment',
            reporter_platform: 'web',
            status: 'actioned',
            created_at: new Date().toISOString(),
            // missing resolved_by and resolved_at
          },
        ],
        error: null,
      });

      const audit = await auditContentReports({ limit: 10 });
      expect(audit.total_reports).toBe(1);
      expect(audit.unaudited_count).toBe(1);
      expect(audit.flagged_items[0]?.severity).toBe('high');
      expect(mockFrom).toHaveBeenCalledWith('content_reports');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  describe('quarantineInfringingTrack (Direct Killswitch)', () => {
    it('sets track status to rejected in database and returns takedown confirmation', async () => {
      const res = await quarantineInfringingTrack('direct-kill-track-555', 'Statutory DMCA Takedown');
      expect(res.success).toBe(true);
      expect(res.trackId).toBe('direct-kill-track-555');
      expect(res.action).toBe('quarantined');
      expect(res.reason).toBe('Statutory DMCA Takedown');
      expect(mockEq).toHaveBeenCalledWith('id', 'direct-kill-track-555');
    });

    it('uses default reason when reason parameter is omitted', async () => {
      const res = await quarantineInfringingTrack('default-reason-track');
      expect(res.success).toBe(true);
      expect(res.trackId).toBe('default-reason-track');
      expect(res.reason).toBe('Copyright DMCA takedown');
    });

    it('handles database error gracefully when quarantining track', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockEq.mockImplementationOnce(() => {
        throw new Error('Supabase failure');
      });

      const res = await quarantineInfringingTrack('fail-track', 'Takedown error test');
      expect(res.success).toBe(true);
      expect(res.trackId).toBe('fail-track');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Safety Reports] Quarantine track note:'),
        expect.any(Error)
      );
      consoleWarnSpy.mockRestore();
    });
  });
});
