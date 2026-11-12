// tests/unit/radio-started.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  markTrackStarted,
  getNextAirplayItem,
  getNowPlaying,
  formatLiquidsoapAnnotateUri,
  isAirplayRecentlyAnnounced,
  recordAirplayAnnounced,
  resetAirplayDedupeCache,
  DEMO_FALLBACK_AUDIO_URL,
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
      maybeSingle: vi.fn(async () => {
        if (currentFilter.col === 'id') {
          return { data: store[String(currentFilter.val)] || null };
        }
        if (currentFilter.col === 'title') {
          const found = Object.values(store).find(
            (t: any) => t.title.toLowerCase() === String(currentFilter.val).toLowerCase()
          );
          return { data: found || null };
        }
        return { data: store['track-101'] };
      }),
      single: vi.fn(async () => {
        if (currentFilter.col === 'id') {
          return { data: store[String(currentFilter.val)] || null };
        }
        return { data: store['track-101'] };
      }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn(() => chain),
      then: (resolve: any) => resolve({ data: Object.values(store) }),
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
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetAirplayDedupeCache();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('status-json.xsl')) {
        return {
          ok: false,
          json: async () => ({}),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
      expect(started.category).toBe('Ambient & Lo-Fi');
      expect(started.tool_used).toBe('Stable Audio');
      expect(started.duration_hint_seconds).toBe(210);
      expect(started.upvotes_count).toBe(20);

      const nowPlaying = await getNowPlaying('main');
      expect(nowPlaying.item.id).toBe('demo-fallback');
    });

    it('resolves track by title from database when item_id is not passed', async () => {
      const started = await markTrackStarted('main', undefined, 'Existing Live Track');
      expect(started.id).toBe('track-101');
      expect(started.title).toBe('Existing Live Track');
      expect(started.artist).toBe('Test Artist');
      expect(started.audio_url).toBe('https://example.com/live.mp3');
      expect(started.cover_art_url).toBe('/logo-mark.png');
      expect(started.duration_hint_seconds).toBe(210);
    });

    it('gracefully handles unknown item_id by maintaining or resolving valid airplay item', async () => {
      const started = await markTrackStarted('main', 'non-existent-random-id');
      expect(started).toBeDefined();
      expect(started.title).toBeDefined();
    });

    it('does not broadcast now-playing announcement when track is only queued or scheduled via getNextAirplayItem', async () => {
      vi.mocked(broadcastToCommunity).mockClear();
      const nextItem = await getNextAirplayItem('main', true);
      expect(nextItem).toBeDefined();
      expect(broadcastToCommunity).not.toHaveBeenCalled();
    });

    it('broadcasts now-playing announcement when track actually starts airing via markTrackStarted', async () => {
      vi.mocked(broadcastToCommunity).mockClear();
      const nextItem = await getNextAirplayItem('main', false);
      expect(nextItem).toBeDefined();

      await markTrackStarted('main', nextItem.id);
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);
      expect(broadcastToCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'now_playing',
          trackId: nextItem.id,
        })
      );
    });

    it('deduplicates repeated markTrackStarted calls for the same track to prevent duplicate #now-playing posts', async () => {
      vi.mocked(broadcastToCommunity).mockClear();
      const nextItem = await getNextAirplayItem('main', false);
      expect(nextItem).toBeDefined();

      // First airplay start event
      await markTrackStarted('main', nextItem.id);
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);

      // Duplicate start event (e.g. repeated call at 18:59, reconnect, retry)
      await markTrackStarted('main', nextItem.id);
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);
    });

    it('allows broadcasting when a different track actually starts airing', async () => {
      vi.mocked(broadcastToCommunity).mockClear();

      await markTrackStarted('main', 'track-101');
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);

      await markTrackStarted('main', 'demo-fallback');
      expect(broadcastToCommunity).toHaveBeenCalledTimes(2);
    });

    it('allows re-broadcasting after resetAirplayDedupeCache is called', async () => {
      vi.mocked(broadcastToCommunity).mockClear();
      await markTrackStarted('main', 'track-101');
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);

      resetAirplayDedupeCache();
      await markTrackStarted('main', 'track-101');
      expect(broadcastToCommunity).toHaveBeenCalledTimes(2);
    });

    it('allows broadcasting the same track after the airplay deduplication window passes', async () => {
      vi.mocked(broadcastToCommunity).mockClear();
      const origNow = Date.now;
      try {
        let mockTime = 1_000_000;
        Date.now = () => mockTime;

        await markTrackStarted('main', 'track-101');
        expect(broadcastToCommunity).toHaveBeenCalledTimes(1);

        // Within 60,000ms window -> deduped
        mockTime += 30_000;
        await markTrackStarted('main', 'track-101');
        expect(broadcastToCommunity).toHaveBeenCalledTimes(1);

        // At or past 60,000ms boundary -> allowed
        mockTime += 30_000;
        await markTrackStarted('main', 'track-101');
        expect(broadcastToCommunity).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = origNow;
      }
    });

    it('sets staged_item when getNextAirplayItem pre-fetches and clears staged_item when markTrackStarted runs', async () => {
      const nextItem = await getNextAirplayItem('main', false);
      expect(nextItem).toBeDefined();

      const startedItem = await markTrackStarted('main', nextItem.id);
      expect(startedItem.id).toBe(nextItem.id);
    });

    it('isolates channel airplay state when starting track on non-main channel', async () => {
      await markTrackStarted('main', 'track-101');
      const mainBefore = await getNowPlaying('main');
      expect(mainBefore.item.id).toBe('track-101');

      // Start on cyberpunk
      await markTrackStarted('cyberpunk', 'demo-fallback');
      const mainAfter = await getNowPlaying('main');
      expect(mainAfter.item.id).toBe('track-101');

      const cyberNow = await getNowPlaying('cyberpunk');
      expect(cyberNow.item.id).toBe('demo-fallback');
    });

    it('does NOT broadcast to public community #now-playing when a non-main channel track starts', async () => {
      vi.mocked(broadcastToCommunity).mockClear();
      await markTrackStarted('cyberpunk', 'demo-fallback');
      expect(broadcastToCommunity).not.toHaveBeenCalled();
    });

    it('correctly tracks multiple pre-buffered items in sequence without announcing the wrong song', async () => {
      vi.mocked(broadcastToCommunity).mockClear();
      // Track 1 starts airing
      await markTrackStarted('main', 'track-101');
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);
      expect(broadcastToCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'now_playing',
          trackId: 'track-101',
        })
      );

      // Track 2 starts airing next
      await markTrackStarted('main', 'track-102');
      expect(broadcastToCommunity).toHaveBeenCalledTimes(2);
      expect(broadcastToCommunity).toHaveBeenLastCalledWith(
        expect.objectContaining({
          category: 'now_playing',
          trackId: 'track-102',
        })
      );
    });

    it('does NOT announce a pending music track when an unbuffered drop or news item airs', async () => {
      vi.mocked(broadcastToCommunity).mockClear();
      // Prepare a pending music track
      const pendingMusic = await getNextAirplayItem('main', false);

      // Now a live spoken news item starts on air (not in tracks table)
      await markTrackStarted('main', 'news-hourly-briefing', 'PromptFM Hourly AI News Briefing');

      // Must NOT broadcast pendingMusic as now_playing!
      expect(broadcastToCommunity).not.toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'now_playing',
          trackId: pendingMusic.id,
        })
      );
    });

    it('does NOT broadcast to community when markTrackStarted is called with an unknown unresolvable item_id', async () => {
      vi.mocked(broadcastToCommunity).mockClear();
      // Pending track waiting
      await getNextAirplayItem('main', false);

      // Unresolvable ID
      await markTrackStarted('main', 'completely-bogus-unknown-id');
      expect(broadcastToCommunity).not.toHaveBeenCalled();
    });

    it('reconciles and announces to community when Icecast live stream changes on air to a new track', async () => {
      await markTrackStarted('main', 'track-101');
      vi.mocked(broadcastToCommunity).mockClear();

      // Mock Icecast live status returning new title "Existing Live Track 2"
      globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('status-json.xsl')) {
          return {
            ok: true,
            json: async () => ({
              icestats: {
                source: {
                  title: 'PromptFM Core - PromptFM Ambient AI Anthem',
                },
              },
            }),
          } as unknown as Response;
        }
        return { ok: true, json: async () => ({}) } as unknown as Response;
      });

      const now = await getNowPlaying('main');
      expect(now.item.id).toBe('demo-fallback');
      // Should broadcast the reconciled on-air track to community
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);
      expect(broadcastToCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'now_playing',
          trackId: 'demo-fallback',
        })
      );
    });

    it('does NOT broadcast duplicate when Icecast reconciles to a track announced within 60s', async () => {
      // Announce track-101 first
      await markTrackStarted('main', 'track-101');
      vi.mocked(broadcastToCommunity).mockClear();

      // Change in-memory to demo-fallback
      await markTrackStarted('main', 'demo-fallback');
      vi.mocked(broadcastToCommunity).mockClear();

      // Now Icecast status says track-101 is playing again, but it was already announced recently
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

    it('removes item from pendingAirplayItems once markTrackStarted is invoked', async () => {
      const next = await getNextAirplayItem('main', false);
      expect(next).toBeDefined();

      // Start the track once
      await markTrackStarted('main', next.id);

      // Subsequent call without item/title should not resolve the removed item from pending
      const second = await markTrackStarted('main');
      expect(second).toBeDefined();
    });

    it('matches pre-buffered pending item by title case-insensitively with whitespace trim', async () => {
      const next = await getNextAirplayItem('main', false);
      const started = await markTrackStarted('main', undefined, `  ${next.title.toUpperCase()}  `);
      expect(started.id).toBe(next.id);
    });

    it('returns exact fallback metadata when demo-fallback is started', async () => {
      const started = await markTrackStarted('main', 'demo-fallback');
      expect(started.artist).toBe('PromptFM Core');
      expect(started.audio_url).toBe(DEMO_FALLBACK_AUDIO_URL);
      expect(started.audio_url).not.toContain('supabase.co/storage');
    });

    it('does NOT set currentAirplayItem on main stage when non-main channel track starts', async () => {
      await markTrackStarted('main', 'track-101');
      await markTrackStarted('cyberpunk', 'track-102');
      const now = await getNowPlaying('main');
      expect(now.item.id).toBe('track-101');
    });

    it('sets isUnresolvableUnknown and suppresses broadcast when both itemId and title are unresolvable', async () => {
      vi.mocked(broadcastToCommunity).mockClear();
      await markTrackStarted('main', 'unknown-id-999', 'Unknown Title 999');
      expect(broadcastToCommunity).not.toHaveBeenCalled();
    });

    it('resolves track by itemId from database with complete fields', async () => {
      const started = await markTrackStarted('main', 'track-101');
      expect(started.id).toBe('track-101');
      expect(started.artist).toBe('Test Artist');
      expect(started.upvotes_count).toBe(15);
      expect(started.duration_hint_seconds).toBe(210);
    });

    it('clears pendingAirplayItem so subsequent markTrackStarted without parameters does not reuse it', async () => {
      const next = await getNextAirplayItem('main', false);
      await markTrackStarted('main', next.id);

      // Change currentAirplayItem to demo-fallback
      await markTrackStarted('main', 'demo-fallback');

      // Now call markTrackStarted without arguments
      const res = await markTrackStarted('main');
      expect(res.id).toBe('demo-fallback');
    });

    it('deletes pre-buffered item by title once started', async () => {
      const next = await getNextAirplayItem('main', false);
      const started = await markTrackStarted('main', undefined, next.title);
      expect(started.id).toBe(next.id);
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
  });
});
