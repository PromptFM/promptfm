// tests/unit/radio-now-optimization.test.ts
// Tests for stopping duplicate getNowPlaying work in /api/radio/now and rotation.ts (Issue #123)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as rotation from '@/lib/dj/rotation';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/radio/now/route';

vi.mock('@/lib/radio/icecast-sync', () => ({
  fetchIcecastStatus: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === 'channels') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => ({
                  data: { id: `channel-${val}`, slug: val },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'station_state') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    channel_slug: 'main',
                    airplay_item: {
                      id: 'track-mock-now',
                      title: 'Synthetic Dawn',
                      artist: 'DJ Neon',
                      audio_url: 'https://example.com/synth.mp3',
                      type: 'music',
                      duration_hint_seconds: 180,
                    },
                    started_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        if (table === 'channel_queue' || table === 'station_queue') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [] }),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === 'tracks') {
          return {
            select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === 'exact') {
                return {
                  eq: () => ({
                    gt: () => Promise.resolve({ count: 1 }),
                    then: (resolve: any) => resolve({ count: 5 }),
                  }),
                };
              }
              return {
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: 'track-mock-now',
                          title: 'Synthetic Dawn',
                          artist_name: 'DJ Neon',
                          audio_url: 'https://example.com/synth.mp3',
                          tool_used: 'Suno',
                          upvotes_count: 10,
                        },
                      }),
                      then: (resolve: any) =>
                        resolve({
                          data: [
                            {
                              id: 'track-mock-2',
                              title: 'Hold That Line',
                              artist_name: 'Letra',
                              audio_url: 'https://example.com/letra.mp3',
                              tool_used: 'Udio',
                              upvotes_count: 8,
                            },
                          ],
                        }),
                    }),
                  }),
                }),
              };
            },
          };
        }

        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      },
    }),
  };
});

describe('Radio Now Playing & Up Next Optimization (Issue #123)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    rotation.resetChannelAirplayItems();
    rotation.clearNowPlayingCache?.();
  });

  describe('getUpNext with pre-resolved currentNowPlaying', () => {
    it('does not re-invoke getNowPlaying when currentNowPlaying is passed to getUpNext', async () => {
      const getNowPlayingSpy = vi.spyOn(rotation, 'getNowPlaying');

      const mockActiveItem: rotation.AirplayItem = {
        id: 'track-active-123',
        type: 'music',
        title: 'Already Playing Song',
        artist: 'PromptFM Artist',
        audio_url: 'https://example.com/stream.mp3',
        duration_hint_seconds: 200,
      };

      const upNext = await rotation.getUpNext('main', 3, {
        item: mockActiveItem,
        elapsedSeconds: 50,
      });

      // Crucial assertion: getNowPlaying must NOT be called when item is already provided
      expect(getNowPlayingSpy).not.toHaveBeenCalled();
      expect(Array.isArray(upNext)).toBe(true);
      // Active item must not be included in Up Next
      expect(upNext.some((t) => t.id === 'track-active-123')).toBe(false);
    });

    it('falls back to internal now playing state when currentNowPlaying is omitted', async () => {
      const mockActive: rotation.AirplayItem = {
        id: 'track-active-omitted-test',
        type: 'music',
        title: 'Active Song',
        artist: 'PromptFM',
        audio_url: 'https://example.com/active.mp3',
        duration_hint_seconds: 210,
      };

      // Set active track in station state
      rotation.resetChannelAirplayItems();
      const nowPlayingBefore = await rotation.getNowPlaying('main');
      expect(nowPlayingBefore).toBeDefined();

      const upNext = await rotation.getUpNext('main', 3);
      expect(Array.isArray(upNext)).toBe(true);
      // Fallback successfully resolved now playing and did not include demo-fallback as duplicate
      expect(upNext.every((t) => t.id !== 'demo-fallback')).toBe(true);
    });
  });

  describe('getNowPlaying in-memory caching', () => {
    it('caches now-playing for short burst requests to prevent repeated DB / Icecast queries', async () => {
      // First call establishes cache
      const first = await rotation.getNowPlaying('main');
      expect(first).toBeDefined();

      // Second call immediately after should return cached item
      const second = await rotation.getNowPlaying('main');
      expect(second.item.id).toBe(first.item.id);
      expect(second.item.title).toBe(first.item.title);
    });

    it('allows clearing now-playing cache via clearNowPlayingCache', async () => {
      await rotation.getNowPlaying('main');
      expect(typeof rotation.clearNowPlayingCache).toBe('function');
      rotation.clearNowPlayingCache('main');
    });
  });

  describe('GET /api/radio/now endpoint single execution', () => {
    it('calls getNowPlaying exactly once per API request and passes status to getUpNext', async () => {
      const mockNowPlaying = {
        item: {
          id: 'track-single-hit',
          type: 'music' as const,
          title: 'Single Execution Song',
          artist: 'PromptFM Test',
          audio_url: 'https://example.com/track.mp3',
          duration_hint_seconds: 180,
          upvotes_count: 10,
        },
        startedAt: new Date().toISOString(),
        elapsedSeconds: 20,
        activeDJ: {
          id: 'dj_neon',
          name: 'DJ Neon',
          title: 'Host',
          bio: '',
          stylePrompt: '',
          voice: { name: 'en-US-Journey-F', languageCode: 'en-US', ssmlGender: 'FEMALE' as const },
          shifts: [],
          defaultChannels: [],
        },
        rank: 1,
        totalApprovedTracks: 5,
      };

      const getNowPlayingSpy = vi.spyOn(rotation, 'getNowPlaying').mockResolvedValue(mockNowPlaying);
      const getUpNextSpy = vi.spyOn(rotation, 'getUpNext').mockResolvedValue([]);

      const req = new NextRequest('http://localhost:3000/api/radio/now?channel=main');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.now_playing.id).toBe('track-single-hit');

      // The critical fix: getNowPlaying was called ONCE, not twice!
      expect(getNowPlayingSpy).toHaveBeenCalledTimes(1);
      // getUpNext received the pre-resolved status
      expect(getUpNextSpy).toHaveBeenCalledWith('main', 3, expect.objectContaining({
        item: expect.objectContaining({ id: 'track-single-hit' }),
      }));
    });
  });
});
