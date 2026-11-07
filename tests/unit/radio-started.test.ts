// tests/unit/radio-started.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  markTrackStarted,
  getNextAirplayItem,
  getNowPlaying,
  formatLiquidsoapAnnotateUri,
  resetAirplayDedupeCache,
  AirplayItem,
} from '@/lib/dj/rotation';
import { broadcastToCommunity } from '@/lib/chat/bridge';

// Mock Supabase admin client
vi.mock('@/lib/supabase/server', () => {
  const createChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.ilike = vi.fn(() => chain);
    chain.is = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'track-101',
        title: 'Existing Live Track',
        artist_name: 'Test Artist',
        audio_url: 'https://example.com/live.mp3',
        status: 'approved',
        upvotes_count: 15,
      },
    });
    chain.single = vi.fn().mockResolvedValue({
      data: {
        id: 'track-101',
        title: 'Existing Live Track',
        artist_name: 'Test Artist',
        audio_url: 'https://example.com/live.mp3',
      },
    });
    chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.update = vi.fn(() => chain);
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

  describe('markTrackStarted', () => {
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

    it('matches pending next item by title case-insensitively when liquidsoap passes title', async () => {
      const nextItem = await getNextAirplayItem('main', false);
      expect(nextItem).toBeDefined();

      const started = await markTrackStarted('main', undefined, nextItem.title.toLowerCase());
      expect(started.id).toBe(nextItem.id);
      expect(started.title).toBe(nextItem.title);
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
  });
});
