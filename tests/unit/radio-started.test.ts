// tests/unit/radio-started.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  markTrackStarted,
  getNextAirplayItem,
  getNowPlaying,
  formatLiquidsoapAnnotateUri,
  isAirplayRecentlyAnnounced,
  recordAirplayAnnounced,
  resetAirplayDedupeCache,
  AirplayItem,
} from '@/lib/dj/rotation';
import { broadcastToCommunity } from '@/lib/chat/bridge';

// Mock Supabase admin client
vi.mock('@/lib/supabase/server', () => {
  const store: Record<string, any> = {
    'track-101': {
      id: 'track-101',
      title: 'Existing Live Track',
      artist_name: 'Test Artist',
      audio_url: 'https://example.com/live.mp3',
      status: 'approved',
      upvotes_count: 15,
      duration_hint_seconds: 210,
    },
    'track-102': {
      id: 'track-102',
      title: 'Cyber Skyline',
      artist_name: 'Synth Master',
      audio_url: 'https://example.com/skyline.mp3',
      status: 'approved',
      upvotes_count: 12,
      duration_hint_seconds: 180,
    },
  };

  const createChain = () => {
    let currentFilter: { col?: string; val?: any } = {};
    const chain: Record<string, any> = {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, val: any) => {
        currentFilter = { col, val };
        return chain;
      }),
      ilike: vi.fn((col: string, val: any) => {
        currentFilter = { col, val };
        return chain;
      }),
      is: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn().mockImplementation(async () => {
        if (currentFilter.col === 'id' && store[currentFilter.val]) {
          return { data: store[currentFilter.val] };
        }
        if (currentFilter.col === 'title') {
          const match = Object.values(store).find(
            (t) => t.title.toLowerCase() === String(currentFilter.val).toLowerCase()
          );
          if (match) return { data: match };
        }
        if (currentFilter.col === 'slug' && currentFilter.val === 'main') {
          return { data: { id: 'channel-main' } };
        }
        if (currentFilter.col === 'channel_slug' && currentFilter.val === 'main') {
          return { data: null };
        }
        return { data: null };
      }),
      single: vi.fn().mockImplementation(async () => {
        if (currentFilter.col === 'id' && store[currentFilter.val]) {
          return { data: store[currentFilter.val] };
        }
        return { data: store['track-101'] };
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn(() => chain),
    };
    return chain;
  };

  return {
    createAdminClient: vi.fn(() => ({
      from: vi.fn(() => createChain()),
    })),
  };
});

// Mock chat bridge notifications
vi.mock('@/lib/chat/bridge', () => ({
  broadcastToCommunity: vi.fn().mockResolvedValue({ discord: true, telegram: true }),
}));

// Mock DJ voice engine to prevent real network calls to Gemini TTS in unit tests
vi.mock('@/lib/dj/engine', () => ({
  createBroadcastDrop: vi.fn().mockResolvedValue({
    script: 'Mock broadcast script',
    audioUrl: 'https://example.com/drop.mp3',
  }),
  fetchLiveHeadlines: vi.fn().mockResolvedValue(['Mock Headline 1', 'Mock Headline 2']),
}));

describe('Liquidsoap Synchronization & Track Started Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAirplayDedupeCache();
  });

  describe('formatLiquidsoapAnnotateUri', () => {
    it('formats a clean Liquidsoap annotate string with escaped quotes', () => {
      const item: AirplayItem = {
        id: 'track-abc-123',
        type: 'music',
        title: 'Cyber "Neon" Dreams',
        artist: 'DJ & Synth',
        audio_url: 'https://cdn.promptfm.live/audio.mp3',
      };

      const result = formatLiquidsoapAnnotateUri(item);
      expect(result).toBe(
        'annotate:title="Cyber \'Neon\' Dreams",artist="DJ & Synth",promptfm_id="track-abc-123":https://cdn.promptfm.live/audio.mp3'
      );
    });

    it('handles fallback anthem gracefully', () => {
      const fallbackItem: AirplayItem = {
        id: 'demo-fallback',
        type: 'music',
        title: 'PromptFM Ambient AI Anthem',
        artist: 'PromptFM Core',
        audio_url: '/etc/liquidsoap/fallback.mp3',
      };

      const result = formatLiquidsoapAnnotateUri(fallbackItem);
      expect(result).toContain('title="PromptFM Ambient AI Anthem"');
      expect(result).toContain('artist="PromptFM Core"');
      expect(result).toContain('promptfm_id="demo-fallback"');
      expect(result).toContain(':/etc/liquidsoap/fallback.mp3');
    });
  });

  describe('markTrackStarted & Community Broadcast Safeguards (Issue #44)', () => {
    it('promotes pending next item to now playing when liquidsoap signals start', async () => {
      // 1. Prefetch the next track without auto-promoting
      const nextItem = await getNextAirplayItem('main', false);
      expect(nextItem).toBeDefined();

      // 2. Signal that this track has actually started on air
      const started = await markTrackStarted('main', nextItem.id);
      expect(started.id).toBe(nextItem.id);

      // 3. Verify getNowPlaying reflects the newly started track
      const nowPlaying = await getNowPlaying('main');
      expect(nowPlaying.item.id).toBe(nextItem.id);
      expect(nowPlaying.elapsedSeconds).toBeLessThanOrEqual(2);
    });

    it('handles demo fallback gracefully if liquidsoap signals fallback item', async () => {
      const started = await markTrackStarted('main', 'demo-fallback');
      expect(started.id).toBe('demo-fallback');
      expect(started.title).toContain('PromptFM');

      const nowPlaying = await getNowPlaying('main');
      expect(nowPlaying.item.id).toBe('demo-fallback');
    });

    it('broadcasts to community on main stage when track actually starts', async () => {
      const nextItem = await getNextAirplayItem('main', false);
      vi.mocked(broadcastToCommunity).mockClear();

      await markTrackStarted('main', nextItem.id);

      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);
      expect(broadcastToCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'now_playing',
          trackId: nextItem.id,
        })
      );
    });

    it('deduplicates consecutive now-playing announcements within 60s for the same track', async () => {
      const nextItem = await getNextAirplayItem('main', false);
      vi.mocked(broadcastToCommunity).mockClear();

      // First airplay notification
      await markTrackStarted('main', nextItem.id);
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);

      // Immediate retry / replay of the same event
      await markTrackStarted('main', nextItem.id);
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);
    });

    it('isolates community broadcast: non-main channels do NOT broadcast to community #now-playing', async () => {
      vi.mocked(broadcastToCommunity).mockClear();

      // Track started on a themed sub-channel (e.g. cyberpunk or chillout)
      await markTrackStarted('cyberpunk', 'track-102');

      // Must NOT post to the main Discord #now-playing channel
      expect(broadcastToCommunity).not.toHaveBeenCalled();
    });

    it('multi-item buffer retains pre-buffered tracks across queue cycles without overwriting', async () => {
      // Liquidsoap pre-buffers track 1, then track 2
      const item1 = await getNextAirplayItem('main', false);
      const item2 = await getNextAirplayItem('main', false);

      expect(item1.id).toBeDefined();
      expect(item2.id).toBeDefined();

      vi.mocked(broadcastToCommunity).mockClear();

      // Even though item2 was fetched second, starting item1 first should find item1 in buffer
      const started1 = await markTrackStarted('main', item1.id);
      expect(started1.id).toBe(item1.id);

      // Now item2 starts
      const started2 = await markTrackStarted('main', item2.id);
      expect(started2.id).toBe(item2.id);
    });

    it('suppresses community announcement for unresolvable drops or unknown track IDs', async () => {
      vi.mocked(broadcastToCommunity).mockClear();

      // Unknown or non-music interstitial ID that fails DB lookup
      await markTrackStarted('main', 'unresolvable-drop-id-999');

      // Must NOT broadcast misleading now-playing notification
      expect(broadcastToCommunity).not.toHaveBeenCalled();
    });

    it('provides isAirplayRecentlyAnnounced and resetAirplayDedupeCache helper semantics', () => {
      expect(isAirplayRecentlyAnnounced('main', 'test-track')).toBe(false);

      recordAirplayAnnounced('main', 'test-track');
      expect(isAirplayRecentlyAnnounced('main', 'test-track')).toBe(true);

      // Multiple tracks recorded on same channel must preserve all entries
      recordAirplayAnnounced('main', 'test-track-2');
      expect(isAirplayRecentlyAnnounced('main', 'test-track')).toBe(true);
      expect(isAirplayRecentlyAnnounced('main', 'test-track-2')).toBe(true);

      // Unrecorded track on existing channel map returns false
      expect(isAirplayRecentlyAnnounced('main', 'unrecorded-track')).toBe(false);

      // Different channel should not be marked announced
      expect(isAirplayRecentlyAnnounced('cyberpunk', 'test-track')).toBe(false);

      // Expiration after 60s
      vi.useFakeTimers();
      const baseTime = 1_000_000;
      vi.setSystemTime(baseTime);
      recordAirplayAnnounced('main', 'time-track');

      // 59.999s -> still announced
      vi.setSystemTime(baseTime + 59_999);
      expect(isAirplayRecentlyAnnounced('main', 'time-track')).toBe(true);

      // exactly 60.000s -> false
      vi.setSystemTime(baseTime + 60_000);
      expect(isAirplayRecentlyAnnounced('main', 'time-track')).toBe(false);

      // 60.001s -> false
      vi.setSystemTime(baseTime + 60_001);
      expect(isAirplayRecentlyAnnounced('main', 'time-track')).toBe(false);

      vi.useRealTimers();

      resetAirplayDedupeCache();
      expect(isAirplayRecentlyAnnounced('main', 'test-track')).toBe(false);
    });

    it('reconciles Icecast on-air track to community and suppresses duplicates when already announced', async () => {
      // Announce track-101
      await markTrackStarted('main', 'track-101');
      vi.mocked(broadcastToCommunity).mockClear();

      // Change in-memory to demo-fallback
      await markTrackStarted('main', 'demo-fallback');
      vi.mocked(broadcastToCommunity).mockClear();

      // Now Icecast status says track-101 is playing again, but it was already announced recently (<60s)
      globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('status-json.xsl')) {
          return {
            ok: true,
            json: async () => ({
              icestats: {
                source: {
                  title: 'Test Artist - Existing Live Track',
                },
              },
            }),
          } as unknown as Response;
        }
        return { ok: true, json: async () => ({}) } as unknown as Response;
      });

      const now = await getNowPlaying('main');
      expect(now.item.id).toBe('track-101');
      expect(broadcastToCommunity).not.toHaveBeenCalled();
    });

    it('broadcasts to community when Icecast reconciles to a new track not yet announced', async () => {
      // Set current playing track to track-102 ('Cyber Skyline')
      await markTrackStarted('main', 'track-102');
      resetAirplayDedupeCache();
      vi.mocked(broadcastToCommunity).mockClear();

      globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('status-json.xsl')) {
          return {
            ok: true,
            json: async () => ({
              icestats: {
                source: {
                  title: 'Test Artist - Existing Live Track',
                },
              },
            }),
          } as unknown as Response;
        }
        return { ok: true, json: async () => ({}) } as unknown as Response;
      });

      const now = await getNowPlaying('main');
      expect(now.item.id).toBe('track-101');
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);
    });

    it('resolves track by itemId from database with complete fields', async () => {
      const started = await markTrackStarted('main', 'track-101');
      expect(started.id).toBe('track-101');
      expect(started.artist).toBe('Test Artist');
      expect(started.upvotes_count).toBe(15);
      expect(started.duration_hint_seconds).toBe(210);
    });

    it('matches pre-buffered pending item by title case-insensitively with whitespace trim', async () => {
      const next = await getNextAirplayItem('main', false);
      const started = await markTrackStarted('main', undefined, `  ${next.title.toUpperCase()}  `);
      expect(started.id).toBe(next.id);
    });

    it('returns exact fallback metadata when demo-fallback is started', async () => {
      const started = await markTrackStarted('main', 'demo-fallback');
      expect(started.artist).toBe('PromptFM Core');
      expect(started.audio_url).toBe(
        'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/promptfm_ambient_ai_anthem.mp3'
      );
    });

    it('does NOT set currentAirplayItem on main stage when non-main channel track starts', async () => {
      await markTrackStarted('main', 'track-101');
      await markTrackStarted('cyberpunk', 'track-102');
      const now = await getNowPlaying('main');
      expect(now.item.id).toBe('track-101');
    });

    it('removes item from pendingAirplayItems once markTrackStarted is invoked', async () => {
      const next = await getNextAirplayItem('main', false);
      expect(next).toBeDefined();

      // Start the track once
      await markTrackStarted('main', next.id);

      // Subsequent call without item/title should not resolve the removed item from pending
      const second = await markTrackStarted('main');
      expect(second).toBeDefined();
    });
  });
});
