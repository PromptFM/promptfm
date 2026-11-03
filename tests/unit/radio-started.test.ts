// tests/unit/radio-started.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  markTrackStarted,
  getNextAirplayItem,
  getNowPlaying,
  formatLiquidsoapAnnotateUri,
  AirplayItem,
} from '@/lib/dj/rotation';

// Mock Supabase admin client
vi.mock('@/lib/supabase/server', () => {
  const createChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
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
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('handles demo fallback gracefully if liquidsoap signals fallback item', async () => {
      const started = await markTrackStarted('main', 'demo-fallback');
      expect(started.id).toBe('demo-fallback');
      expect(started.title).toContain('PromptFM');

      const nowPlaying = await getNowPlaying('main');
      expect(nowPlaying.item.id).toBe('demo-fallback');
    });

    it('gracefully handles unknown item_id by maintaining or resolving valid airplay item', async () => {
      const started = await markTrackStarted('main', 'non-existent-random-id');
      expect(started).toBeDefined();
      expect(started.title).toBeDefined();
    });
  });
});
