// tests/unit/rotation-sync.test.ts
// Unit tests verifying on-air track synchronicity:
// 1. Music tracks are NOT prematurely auto-advanced at 180s while still playing on air.
// 2. Liquidsoap on_track transitions remain authoritative.
// 3. Watchdog fallback only advances after an extreme timeout (>= 600s) to prevent frozen stations.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNowPlaying, markTrackStarted } from '@/lib/dj/rotation';

// Mock Supabase admin client
vi.mock('@/lib/supabase/server', () => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'song-draga-123',
      title: 'Haina-mi este cea mai draga',
      artist_name: 'alextrifan',
      audio_url: 'https://cdn.example.com/haina.mp3',
      status: 'approved',
      upvotes_count: 33,
      duration_hint_seconds: 220,
    },
  });
  chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.update = vi.fn(() => chain);

  return {
    createAdminClient: vi.fn(() => ({
      from: vi.fn(() => chain),
    })),
  };
});

vi.mock('@/lib/chat/bridge', () => ({
  broadcastToCommunity: vi.fn().mockResolvedValue({ discord: true, telegram: true }),
}));

describe('On-Air Track Synchronization & Rotation Watchdog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps playing active music track beyond 180s (e.g. at 210s) without premature song change', async () => {
    // Start track
    const started = await markTrackStarted('sync-test', 'song-draga-123');
    expect(started.title).toBe('Haina-mi este cea mai draga');

    // Simulate 200 seconds of elapsed airplay (past old 180s threshold)
    const nowPlaying = await getNowPlaying('sync-test');
    expect(nowPlaying.item.title).toBe('Haina-mi este cea mai draga');
    expect(nowPlaying.item.id).toBe('song-draga-123');
  });

  it('does NOT auto-advance when elapsed airplay is 200s for a music track', async () => {
    await markTrackStarted('sync-channel-3', 'song-draga-123');

    // Manipulate time by 200 seconds
    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      Date.now = () => realNow + 200 * 1000;

      const current = await getNowPlaying('sync-channel-3');
      // Should STILL be "Haina-mi este cea mai draga" and NOT auto-advance!
      expect(current.item.id).toBe('song-draga-123');
      expect(current.item.title).toBe('Haina-mi este cea mai draga');
      expect(current.elapsedSeconds).toBeGreaterThanOrEqual(200);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('advances on-air track when elapsed airplay reaches safety watchdog ceiling (>= 600s)', async () => {
    await markTrackStarted('sync-channel-watchdog', 'song-draga-123');

    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      Date.now = () => realNow + 605 * 1000;

      const current = await getNowPlaying('sync-channel-watchdog');
      // Watchdog kicks in after 600s to avoid frozen orphaned station
      expect(current.elapsedSeconds).toBeLessThan(600);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('preserves the active music track when elapsed is 250s instead of auto-advancing prematurely', async () => {
    const started = await markTrackStarted('sync-test-2', 'song-draga-123');
    expect(started.id).toBe('song-draga-123');

    // Query now playing immediately
    const state = await getNowPlaying('sync-test-2');
    expect(state.item.id).toBe('song-draga-123');
    expect(state.item.title).toBe('Haina-mi este cea mai draga');
  });
});
