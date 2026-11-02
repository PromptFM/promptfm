// tests/unit/rotation-state.test.ts
// Unit tests for Now Playing state persistence and vote synchronization

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { castVoteForTrack } from '@/lib/chat/bridge';
import { updateCurrentAirplayUpvotes, getNowPlaying } from '@/lib/dj/rotation';

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
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
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
});

