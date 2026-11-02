// tests/unit/reports.test.ts
// Unit tests for the Content Reporting System

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { submitContentReport, getRecentReports, resolveContentReport } from '@/lib/safety/reports';
import { REASON_LABELS } from '@/types/database';

describe('Content Reporting Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global fetch so tests never block on external network I/O
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
      text: async () => 'OK',
    }) as unknown as typeof fetch;
  });

  it('correctly maps all valid report reasons to human-readable labels', () => {
    expect(REASON_LABELS.copyright_dmca).toBe('DMCA & Copyright Infringement');
    expect(REASON_LABELS.hate_harassment).toBe('Hate Speech, Harassment or Defamation');
    expect(REASON_LABELS.religious_ethical).toBe('Religious Mockery or Ethical Violation');
    expect(REASON_LABELS.unlabeled_18_plus).toBe('Unlabeled Adult / Explicit Content (18+)');
    expect(REASON_LABELS.spam_abuse).toBe('Spam, Flooding or Deceptive Metadata');
    expect(REASON_LABELS.other).toBe('Other Community Guidelines Violation');
  });

  it('creates and records a valid DMCA report with proper ticket format', async () => {
    const result = await submitContentReport({
      target_type: 'track',
      target_id: 'track-uuid-9999',
      reason: 'copyright_dmca',
      details: 'Unlicensed vocal rip from studio record',
      reporter_platform: 'web',
      reporter_id: 'artist_label_rep',
    });

    expect(result.success).toBe(true);
    expect(result.reportId).toMatch(/^rep_\d+_[a-z0-9]+$/);
    expect(result.message).toContain('Report received');

    // Verify report is in recent list
    const reports = await getRecentReports(10);
    const found = reports.find((r) => r.id === result.reportId);
    expect(found).toBeDefined();
    expect(found?.target_id).toBe('track-uuid-9999');
    expect(found?.reason).toBe('copyright_dmca');
    expect(found?.reporter_platform).toBe('web');
    expect(found?.status).toBe('pending');
  });

  it('records reports from multiple platforms (Discord, Telegram, MCP)', async () => {
    // Discord report
    const discordRep = await submitContentReport({
      target_type: 'track',
      target_id: 'track-discord-123',
      reason: 'hate_harassment',
      details: 'Defamatory lyrics directed at user',
      reporter_platform: 'discord',
      reporter_id: 'discord_mod#1234',
    });
    expect(discordRep.success).toBe(true);

    // Telegram report
    const telegramRep = await submitContentReport({
      target_type: 'track',
      target_id: 'track-tg-456',
      reason: 'religious_ethical',
      details: 'Religious disrespect',
      reporter_platform: 'telegram',
      reporter_id: '@tg_listener',
    });
    expect(telegramRep.success).toBe(true);

    // MCP report
    const mcpRep = await submitContentReport({
      target_type: 'broadcast',
      target_id: 'live-stream',
      reason: 'unlabeled_18_plus',
      details: 'Explicit profanity during daytime safe harbor',
      reporter_platform: 'mcp',
      reporter_id: 'AutoSafetyAgent',
    });
    expect(mcpRep.success).toBe(true);

    const recent = await getRecentReports(10);
    expect(recent.some((r) => r.id === discordRep.reportId)).toBe(true);
    expect(recent.some((r) => r.id === telegramRep.reportId)).toBe(true);
    expect(recent.some((r) => r.id === mcpRep.reportId)).toBe(true);
  });

  it('resolves a content report with actioned or dismissed status', async () => {
    const rep = await submitContentReport({
      target_type: 'track',
      target_id: 'track-to-resolve-1',
      reason: 'spam_abuse',
      details: 'Spam flooding track',
      reporter_platform: 'web',
    });

    const resActioned = await resolveContentReport(rep.reportId, 'actioned', 'Track removed from rotation');
    expect(resActioned.success).toBe(true);
    expect(resActioned.status).toBe('actioned');

    const reportsAfterAction = await getRecentReports(10);
    const updatedRep = reportsAfterAction.find((r) => r.id === rep.reportId);
    expect(updatedRep?.status).toBe('actioned');

    const resDismissed = await resolveContentReport(rep.reportId, 'dismissed', 'False report');
    expect(resDismissed.success).toBe(true);
    expect(resDismissed.status).toBe('dismissed');

    const reportsAfterDismiss = await getRecentReports(10);
    const dismissedRep = reportsAfterDismiss.find((r) => r.id === rep.reportId);
    expect(dismissedRep?.status).toBe('dismissed');
  });
});
