// tests/unit/cli-track-management.test.ts
// Unit tests for track editing and deletion CLI helpers

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as trackMgmt from '@/lib/dj/track-management';
import { formatRequestLifecycleMessage } from '@/lib/song/lifecycle';

describe('PromptFM Admin Track CLI Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('edits track metadata through track management service', async () => {
    const spy = vi.spyOn(trackMgmt, 'editTrackMetadata').mockResolvedValueOnce({
      success: true,
      message: 'Track updated',
      track: {
        id: 'track-1',
        user_id: null,
        title: 'Cyber Drift 2088',
        artist_name: 'DJ Vance',
        category: 'Cyberpunk & Synth',
        is_explicit: false,
        status: 'approved',
        upvotes_count: 5,
        created_at: '2026-11-06T00:00:00Z',
        audio_url: 'https://promptfm.live/audio.mp3',
        tool_used: 'Suno',
      },
    });

    const res = await trackMgmt.editTrackMetadata(
      'track-1',
      {
        title: 'Cyber Drift 2088',
        artist_name: 'DJ Vance',
      },
      'Admin CLI'
    );

    expect(spy).toHaveBeenCalledWith(
      'track-1',
      {
        title: 'Cyber Drift 2088',
        artist_name: 'DJ Vance',
      },
      'Admin CLI'
    );
    expect(res.success).toBe(true);
    expect(res.track.title).toBe('Cyber Drift 2088');
  });

  it('deletes track through track management service', async () => {
    const spy = vi.spyOn(trackMgmt, 'deleteTrack').mockResolvedValueOnce({
      success: true,
      soft_deleted: false,
      deleted_id: 'track-1',
      title: 'Bad Track',
      message: 'Track "Bad Track" permanently deleted from library by Admin CLI.',
    });

    const res = await trackMgmt.deleteTrack('track-1', {
      softDelete: false,
      actor: 'Admin CLI',
    });

    expect(spy).toHaveBeenCalledWith('track-1', {
      softDelete: false,
      actor: 'Admin CLI',
    });
    expect(res.success).toBe(true);
    expect(res.deleted_id).toBe('track-1');
  });

  it('formats request lifecycle message for CLI output', () => {
    const mockInfo = {
      requestId: 'req-cli-1',
      status: 'airing_soon' as const,
      displayStatus: 'Airing Soon',
      badgeLabel: 'AIRING SOON',
      platform: 'cli' as const,
      platformUserName: 'terminal_user',
      type: 'song',
      prompt: 'cyberpunk beats',
      batchId: 'BATCH-18:00',
      createdAt: '2026-11-07T18:00:00.000Z',
      track: {
        id: 't-1',
        title: 'Cyberpunk Drive',
        artist: 'Neon Wave',
      },
      eta: {
        position: 1,
        itemsAhead: 0,
        waitSeconds: 60,
        waitMinutes: 1,
        displayTime: '18:00 UTC',
        batchId: 'BATCH-18:00',
        estimatedAirDate: new Date('2026-11-07T18:00:00.000Z'),
        formattedETA: '~1 min',
        isProvisional: false,
      },
    };

    const output = formatRequestLifecycleMessage(mockInfo, 'cli');
    expect(output).toContain('⏳ AIRING SOON (UP NEXT)');
    expect(output).toContain('Cyberpunk Drive');
    expect(output).toContain('terminal_user');
  });
});
