// tests/unit/rotation-state.test.ts
// Unit tests for Now Playing state persistence and vote synchronization

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { castVoteForTrack } from '@/lib/chat/bridge';
import { updateCurrentAirplayUpvotes, getNowPlaying, getUpNext } from '@/lib/dj/rotation';

vi.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === 'station_state') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    channel_slug: 'main',
                    airplay_item: {
                      id: 'track-101',
                      title: 'Synthetic Dawn',
                      artist: 'DJ Neon',
                      upvotes_count: 5,
                      type: 'music',
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

        if (table === 'tracks') {
          return {
            select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === 'exact') {
                return {
                  eq: () => ({
                    gt: () => Promise.resolve({ count: 1 }),
                    then: (resolve: any) => resolve({ count: 10 }),
                  }),
                };
              }
              return {
                eq: (_col: string, val: string) => {
                  if (val === 'approved') {
                    return {
                      order: () => ({
                        limit: () => ({
                          maybeSingle: async () => ({
                            data: {
                              id: 'track-101',
                              title: 'Synthetic Dawn',
                              artist_name: 'DJ Neon',
                              audio_url: 'https://cdn.example.com/synth.mp3',
                              tool_used: 'Suno',
                              upvotes_count: 5,
                            },
                          }),
                          then: (resolve: any) =>
                            resolve({
                              data: [
                                {
                                  id: 'track-101',
                                  title: 'Synthetic Dawn',
                                  artist_name: 'DJ Neon',
                                  audio_url: 'https://cdn.example.com/synth.mp3',
                                  tool_used: 'Suno',
                                  upvotes_count: 33,
                                  category: 'Synthwave & Electro',
                                  is_explicit: false,
                                },
                                {
                                  id: 'track-102',
                                  title: 'Hold That Line',
                                  artist_name: 'Letra',
                                  audio_url: 'https://cdn.example.com/letra.mp3',
                                  tool_used: 'Udio',
                                  upvotes_count: 30,
                                  category: 'Synthwave & Electro',
                                  is_explicit: false,
                                },
                                {
                                  id: 'track-kids',
                                  title: 'Alphabet Song',
                                  artist_name: 'Principle345',
                                  audio_url: 'https://cdn.example.com/alpha.mp3',
                                  tool_used: 'Other',
                                  upvotes_count: 28,
                                  category: 'Kids & Family',
                                  is_explicit: false,
                                  family_friendly: true,
                                },
                              ],
                            }),
                        }),
                      }),
                    };
                  }
                  if (val === 'track-101') {
                    return {
                      single: async () => ({
                        data: {
                          id: 'track-101',
                          title: 'Synthetic Dawn',
                          upvotes_count: 5,
                        },
                        error: null,
                      }),
                    };
                  }
                  return {
                    single: async () => ({
                      data: null,
                      error: { message: 'Not found' },
                    }),
                  };
                },
              };
            },
            update: (_fields: Record<string, unknown>) => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
              single: async () => ({ data: null, error: null }),
            }),
          }),
        };
      },
    }),
  };
});

describe('Now Playing & Vote State Synchronization', () => {
  it('retrieves persistent active airplay track from station_state without returning demo fallback', async () => {
    const status = await getNowPlaying('main');

    expect(status.item.id).toBe('track-101');
    expect(status.item.title).toBe('Synthetic Dawn');
    expect(status.item.upvotes_count).toBe(5);
  });

  it('handles voting for fallback demo track gracefully without 404', async () => {
    const result = await castVoteForTrack('demo-fallback', 'listener-ip');

    expect(result.success).toBe(true);
    expect(result.newCount).toBeGreaterThanOrEqual(1);
  });

  it('updates vote count in memory when updateCurrentAirplayUpvotes is triggered', () => {
    expect(() => updateCurrentAirplayUpvotes('track-101', 6)).not.toThrow();
  });

  it('filters out currently playing track and kids-only tracks from getUpNext on main stage', async () => {
    // track-101 is currently on air in station_state
    const upNext = await getUpNext('main', 5);

    // 1. Currently playing track must NEVER appear in Up Next
    const ids = upNext.map((item) => item.id);
    expect(ids).not.toContain('track-101');

    // 2. Alphabet Song / Kids-only track must NEVER appear in Up Next for main stage
    expect(ids).not.toContain('track-kids');

    // 3. Normal track (track-102) should be present
    expect(ids).toContain('track-102');
  });
});

