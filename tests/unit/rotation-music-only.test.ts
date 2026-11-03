// tests/unit/rotation-music-only.test.ts
// Unit tests verifying that the rotation engine exclusively plays 100% music
// and does not inject news, weather, or prompt-generated AI voice drops.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNextAirplayItem } from '@/lib/dj/rotation';
import * as djEngine from '@/lib/dj/engine';

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
        id: 'track-42',
        title: 'Sunset Grooves',
        artist_name: 'Deep House Collective',
        audio_url: 'https://cdn.example.com/sunset.mp3',
        status: 'approved',
        upvotes_count: 26,
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

vi.mock('@/lib/chat/bridge', () => ({
  broadcastToCommunity: vi.fn().mockResolvedValue({ discord: true, telegram: true }),
}));

vi.mock('@/lib/dj/engine', () => ({
  createBroadcastDrop: vi.fn(),
  fetchLiveHeadlines: vi.fn(),
}));

describe('Rotation Engine (100% Pure Music Guarantee)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never calls createBroadcastDrop or fetchLiveHeadlines for news or weather drops', async () => {
    const createDropSpy = vi.spyOn(djEngine, 'createBroadcastDrop');
    const fetchHeadlinesSpy = vi.spyOn(djEngine, 'fetchLiveHeadlines');

    // Call getNextAirplayItem multiple times
    for (let i = 0; i < 6; i++) {
      const item = await getNextAirplayItem('main', false);
      expect(item.type).toBe('music');
      expect(item.title).toBeDefined();
      expect(item.audio_url).toBeDefined();
    }

    // Must never invoke prompt-generated TTS or headline scrapers
    expect(createDropSpy).not.toHaveBeenCalled();
    expect(fetchHeadlinesSpy).not.toHaveBeenCalled();
  });
});
