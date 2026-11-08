// tests/unit/listener-queue-integrity.test.ts
// Unit tests for Issue #110: Keep listener queue integrity when duplicate requests match the same track
// and when prefetch consumes queued songs early.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getUpNext,
  getNextAirplayItem,
  markTrackStarted,
  getNowPlaying,
  clearPendingAirplayItems,
  getPendingAirplayItems,
  resetChannelAirplayItems,
  AirplayItem,
} from '@/lib/dj/rotation';

interface MockQueueRow {
  id: string;
  channel_id: string;
  track_id: string;
  prompt_used: string;
  requested_by?: string;
  created_at: string;
  played_at: string | null;
  track?: {
    id: string;
    title: string;
    artist_name: string;
    audio_url: string;
    tool_used: string;
    upvotes_count: number;
    category?: string;
    is_explicit?: boolean;
    family_friendly?: boolean;
    cover_art_url?: string;
  };
}

// In-memory mock database tables for queue and state
let mockQueueRows: MockQueueRow[] = [];
let mockStationState: Record<string, { channel_slug: string; airplay_item: AirplayItem; started_at: string }> = {};
let mockFallbackTracks: any[] = [];

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
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => ({
                  data: mockStationState[val] || null,
                  error: null,
                }),
              }),
            }),
            upsert: async (record: { channel_slug: string; airplay_item: AirplayItem; started_at: string }) => {
              mockStationState[record.channel_slug] = record;
              return { error: null };
            },
            update: async (record: { airplay_item: AirplayItem }) => {
              return {
                eq: (_col: string, val: string) => {
                  if (mockStationState[val]) {
                    mockStationState[val].airplay_item = record.airplay_item;
                  }
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        }

        if (table === 'channel_queue') {
          return {
            select: () => ({
              eq: (channelCol: string, channelVal: string) => {
                const buildQuery = (currentChannelVal: string) => ({
                  eq: (trackCol: string, trackVal: string) => ({
                    is: (_playedCol: string, _playedVal: null) => ({
                      order: () => ({
                        limit: (_cnt: number) => ({
                          maybeSingle: async () => {
                            const found = mockQueueRows.find(
                              (r) =>
                                r.channel_id === currentChannelVal &&
                                r.track_id === trackVal &&
                                r.played_at === null
                            );
                            return { data: found ? { id: found.id, requested_by: found.requested_by } : null, error: null };
                          },
                        }),
                      }),
                    }),
                  }),
                  is: (playedCol: string, playedVal: null) => ({
                    order: () => ({
                      limit: (count: number) => {
                        const unplayed = mockQueueRows.filter(
                          (r) =>
                            (channelCol === 'channel_id' ? r.channel_id === currentChannelVal : true) &&
                            (playedVal === null ? r.played_at === null : true)
                        );
                        const result = unplayed.slice(0, count);
                        return {
                          data: result,
                          error: null,
                          maybeSingle: async () => ({
                            data: result[0] || null,
                            error: null,
                          }),
                        };
                      },
                      maybeSingle: async () => {
                        const unplayed = mockQueueRows.filter(
                          (r) =>
                            (channelCol === 'channel_id' ? r.channel_id === currentChannelVal : true) &&
                            (playedVal === null ? r.played_at === null : true)
                        );
                        return {
                          data: unplayed[0] || null,
                          error: null,
                        };
                      },
                    }),
                  }),
                });
                return buildQuery(channelVal);
              },
            }),
            update: (updateData: Partial<MockQueueRow>) => ({
              eq: (field: string, val: string) => {
                const target = mockQueueRows.find((r) => (r as any)[field] === val);
                if (target) {
                  Object.assign(target, updateData);
                }
                return Promise.resolve({ error: null });
              },
            }),
          };
        }

        if (table === 'tracks') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => {
                if (val === 'approved') {
                  return {
                    order: () => ({
                      limit: (count: number) => {
                        const fallbackTracks = mockFallbackTracks.length > 0 ? mockFallbackTracks : [
                          {
                            id: 'library-track-1',
                            title: 'Library Track 1',
                            artist_name: 'Artist 1',
                            audio_url: 'https://cdn.example.com/lib1.mp3',
                            tool_used: 'Suno',
                            upvotes_count: 50,
                            category: 'Synthwave & Electro',
                            is_explicit: false,
                            family_friendly: true,
                          },
                          {
                            id: 'library-track-2',
                            title: 'Library Track 2',
                            artist_name: 'Artist 2',
                            audio_url: 'https://cdn.example.com/lib2.mp3',
                            tool_used: 'Udio',
                            upvotes_count: 40,
                            category: 'Synthwave & Electro',
                            is_explicit: false,
                            family_friendly: true,
                          },
                          {
                            id: 'track-101',
                            title: 'Sunset Grooves',
                            artist_name: 'Deep House Collective',
                            audio_url: 'https://example.com/sunset.mp3',
                            tool_used: 'Suno',
                            upvotes_count: 35,
                            category: 'Deep House',
                            is_explicit: false,
                            family_friendly: true,
                          },
                        ];
                        return {
                          data: fallbackTracks.slice(0, count),
                          error: null,
                          maybeSingle: async () => ({
                            data: fallbackTracks[0],
                            error: null,
                          }),
                        };
                      },
                    }),
                  };
                }
                return {
                  maybeSingle: async () => {
                    const row = mockQueueRows.find((r) => r.track_id === val)?.track;
                    if (row) {
                      return { data: row, error: null };
                    }
                    if (val === 'track-cold-1') {
                      return {
                        data: {
                          id: 'track-cold-1',
                          title: 'Cold Restart Track',
                          artist_name: 'Rebooted',
                          audio_url: 'https://example.com/reboot.mp3',
                          upvotes_count: 12,
                        },
                        error: null,
                      };
                    }
                    return {
                      data: {
                        id: val,
                        title: `Track ${val}`,
                        artist_name: 'Artist',
                        audio_url: 'https://cdn.example.com/lib.mp3',
                        tool_used: 'Suno',
                        upvotes_count: 20,
                      },
                      error: null,
                    };
                  },
                };
              },
            }),
          };
        }

        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        };
      },
    }),
  };
});

vi.mock('@/lib/chat/bridge', () => ({
  broadcastToCommunity: vi.fn().mockResolvedValue({ discord: true, telegram: true }),
}));

vi.mock('@/lib/dj/engine', () => ({
  createBroadcastDrop: vi.fn().mockResolvedValue({
    script: 'Mock broadcast drop',
    audioUrl: 'https://example.com/drop.mp3',
  }),
  fetchLiveHeadlines: vi.fn().mockResolvedValue(['Headline 1']),
}));

describe('Listener Queue Integrity & Prefetch Synchronicity (Issue #110)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueRows = [];
    mockStationState = {};
    mockFallbackTracks = [];
    clearPendingAirplayItems();
    resetChannelAirplayItems();
  });

  describe('Queue Deduplication & Identity (getUpNext)', () => {
    it('preserves multiple queued requests in Up Next even when they resolve to the exact same track ID', async () => {
      const trackData = {
        id: 'track-101',
        title: 'Sunset Grooves',
        artist_name: 'Deep House Collective',
        audio_url: 'https://example.com/sunset.mp3',
        tool_used: 'Suno',
        upvotes_count: 25,
        category: 'Deep House',
        is_explicit: false,
      };

      mockQueueRows.push(
        {
          id: 'queue-req-alpha',
          channel_id: 'channel-main',
          track_id: 'track-101',
          prompt_used: 'sunset vibes',
          requested_by: '@alice (discord)',
          created_at: new Date(Date.now() - 5000).toISOString(),
          played_at: null,
          track: trackData,
        },
        {
          id: 'queue-req-beta',
          channel_id: 'channel-main',
          track_id: 'track-101',
          prompt_used: 'play sunset grooves please',
          requested_by: '@bob (telegram)',
          created_at: new Date(Date.now() - 1000).toISOString(),
          played_at: null,
          track: trackData,
        }
      );

      const upNext = await getUpNext('main', 5);

      expect(upNext.length).toBeGreaterThanOrEqual(2);
      const queueIds = upNext.map((item) => item.queue_id);
      expect(queueIds).toContain('queue-req-alpha');
      expect(queueIds).toContain('queue-req-beta');

      const requesters = upNext.map((item) => item.requested_by);
      expect(requesters).toContain('@alice (discord)');
      expect(requesters).toContain('@bob (telegram)');
    });

    it('filters out the exact active queue item when currently playing, but retains other queued requests for the same track', async () => {
      // track-101 is currently on air and was initiated from queue-req-alpha
      mockStationState['main'] = {
        channel_slug: 'main',
        airplay_item: {
          id: 'track-101',
          title: 'Sunset Grooves',
          artist: 'Deep House Collective',
          audio_url: 'https://example.com/sunset.mp3',
          type: 'music',
          queue_id: 'queue-req-alpha',
        },
        started_at: new Date().toISOString(),
      };

      // In the queue: alpha is playing, but beta is waiting next for the same track!
      mockQueueRows.push(
        {
          id: 'queue-req-alpha',
          channel_id: 'channel-main',
          track_id: 'track-101',
          prompt_used: 'first request',
          requested_by: '@alice (discord)',
          created_at: new Date(Date.now() - 5000).toISOString(),
          played_at: null,
          track: {
            id: 'track-101',
            title: 'Sunset Grooves',
            artist_name: 'Deep House Collective',
            audio_url: 'https://example.com/sunset.mp3',
            tool_used: 'Suno',
            upvotes_count: 25,
          },
        },
        {
          id: 'queue-req-beta',
          channel_id: 'channel-main',
          track_id: 'track-101',
          prompt_used: 'second request',
          requested_by: '@bob (telegram)',
          created_at: new Date(Date.now() - 1000).toISOString(),
          played_at: null,
          track: {
            id: 'track-101',
            title: 'Sunset Grooves',
            artist_name: 'Deep House Collective',
            audio_url: 'https://example.com/sunset.mp3',
            tool_used: 'Suno',
            upvotes_count: 25,
          },
        }
      );

      const upNext = await getUpNext('main', 5);

      // Alpha is active on air, so it must NOT be in Up Next
      const alpha = upNext.find((item) => item.queue_id === 'queue-req-alpha');
      expect(alpha).toBeUndefined();

      // Beta is queued to play next, so it MUST be in Up Next
      const beta = upNext.find((item) => item.queue_id === 'queue-req-beta');
      expect(beta).toBeDefined();
      expect(beta?.requested_by).toBe('@bob (telegram)');
    });

    it('preserves queued song in Up Next even if the track is currently playing on air from the library', async () => {
      mockStationState['main'] = {
        channel_slug: 'main',
        airplay_item: {
          id: 'track-101',
          title: 'Sunset Grooves',
          artist: 'Deep House Collective',
          audio_url: 'https://example.com/sunset.mp3',
          type: 'music',
        },
        started_at: new Date().toISOString(),
      };

      mockQueueRows.push({
        id: 'queue-req-gamma',
        channel_id: 'channel-main',
        track_id: 'track-101',
        prompt_used: 'encore for sunset grooves',
        requested_by: '@charlie (discord)',
        created_at: new Date().toISOString(),
        played_at: null,
        track: {
          id: 'track-101',
          title: 'Sunset Grooves',
          artist_name: 'Deep House Collective',
          audio_url: 'https://example.com/sunset.mp3',
          tool_used: 'Suno',
          upvotes_count: 25,
          category: 'Deep House',
          is_explicit: false,
        },
      });

      const upNext = await getUpNext('main', 5);

      const charlieItem = upNext.find((item) => item.queue_id === 'queue-req-gamma');
      expect(charlieItem).toBeDefined();
      expect(charlieItem?.requested_by).toBe('@charlie (discord)');
    });

    it('respects the limit argument and clamps results accurately', async () => {
      for (let i = 1; i <= 6; i++) {
        mockQueueRows.push({
          id: `queue-${i}`,
          channel_id: 'channel-main',
          track_id: `track-${i}`,
          prompt_used: `p ${i}`,
          created_at: new Date(Date.now() - (10 - i) * 1000).toISOString(),
          played_at: null,
          track: {
            id: `track-${i}`,
            title: `Title ${i}`,
            artist_name: `Artist ${i}`,
            audio_url: `https://example.com/${i}.mp3`,
            tool_used: 'Suno',
            upvotes_count: i,
          },
        });
      }

      const upNext = await getUpNext('main', 3);
      expect(upNext.length).toBe(3);
      expect(upNext[0]?.queue_id).toBe('queue-1');
      expect(upNext[1]?.queue_id).toBe('queue-2');
      expect(upNext[2]?.queue_id).toBe('queue-3');
      expect(upNext[0]?.type).toBe('music');
      expect(upNext[1]?.type).toBe('music');
      expect(upNext[2]?.type).toBe('music');
    });

    it('defaults cover_art_url to /logo-mark.png when undefined', async () => {
      mockQueueRows.push({
        id: 'queue-cover-test',
        channel_id: 'channel-main',
        track_id: 'track-no-cover',
        prompt_used: 'prompt',
        created_at: new Date().toISOString(),
        played_at: null,
        track: {
          id: 'track-no-cover',
          title: 'No Cover Track',
          artist_name: 'Artist',
          audio_url: 'https://example.com/track.mp3',
          tool_used: 'Suno',
          upvotes_count: 5,
          cover_art_url: undefined,
        },
      });

      const upNext = await getUpNext('main', 1);
      expect(upNext[0]?.cover_art_url).toBe('/logo-mark.png');
    });

    it('fills remainder with library tracks without duplicating queued tracks', async () => {
      mockQueueRows.push({
        id: 'queue-library-dedupe',
        channel_id: 'channel-main',
        track_id: 'library-track-1',
        prompt_used: 'play lib 1',
        created_at: new Date().toISOString(),
        played_at: null,
        track: {
          id: 'library-track-1',
          title: 'Library Track 1',
          artist_name: 'Artist 1',
          audio_url: 'https://cdn.example.com/lib1.mp3',
          tool_used: 'Suno',
          upvotes_count: 50,
        },
      });

      // Request limit of 2: 1 from queue, 1 filled from library
      const upNext = await getUpNext('main', 2);
      expect(upNext.length).toBe(2);
      expect(upNext[0]?.id).toBe('library-track-1');
      expect(upNext[0]?.queue_id).toBe('queue-library-dedupe');

      // The library track filled in position 2 must NOT duplicate library-track-1
      expect(upNext[1]?.id).toBe('library-track-2');
      expect(upNext[0]?.type).toBe('music');
      expect(upNext[1]?.type).toBe('music');
    });

    it('prevents duplicate tracks when library table contains duplicate rows for the same track', async () => {
      mockStationState['main'] = {
        channel_slug: 'main',
        airplay_item: {
          id: 'station-track-xyz',
          title: 'Station Track',
          artist: 'Station',
          audio_url: 'https://cdn.example.com/st.mp3',
          type: 'music',
        },
        started_at: new Date().toISOString(),
      };

      // Mock library tracks containing duplicate rows for track-dup
      mockFallbackTracks = [
        {
          id: 'track-dup',
          title: 'Duplicate Track',
          artist_name: 'Artist Dup',
          audio_url: 'https://cdn.example.com/dup.mp3',
          tool_used: 'Suno',
          upvotes_count: 50,
        },
        {
          id: 'track-dup',
          title: 'Duplicate Track Row 2',
          artist_name: 'Artist Dup',
          audio_url: 'https://cdn.example.com/dup.mp3',
          tool_used: 'Suno',
          upvotes_count: 49,
        },
        {
          id: 'track-unique',
          title: 'Unique Track',
          artist_name: 'Artist Unique',
          audio_url: 'https://cdn.example.com/unique.mp3',
          tool_used: 'Suno',
          upvotes_count: 48,
        },
      ];

      const upNext = await getUpNext('main', 2);
      expect(upNext.length).toBe(2);
      expect(upNext[0]?.id).toBe('track-dup');
      expect(upNext[1]?.id).toBe('track-unique'); // track-dup must NOT be repeated!
    });
  });

  describe('Prefetch & On-Air Synchronicity (getNextAirplayItem & markTrackStarted)', () => {
    it('does NOT mark channel_queue.played_at when Liquidsoap prefetches with autoPromote=false', async () => {
      mockQueueRows.push({
        id: 'queue-req-prefetch-1',
        channel_id: 'channel-main',
        track_id: 'track-202',
        prompt_used: 'cyberpunk beats',
        requested_by: '@neo (discord)',
        created_at: new Date().toISOString(),
        played_at: null,
        track: {
          id: 'track-202',
          title: 'Neon Overdrive',
          artist_name: 'CyberCore',
          audio_url: 'https://example.com/neon.mp3',
          tool_used: 'Udio',
          upvotes_count: 10,
        },
      });

      const prefetched = await getNextAirplayItem('main', false);

      expect(prefetched.id).toBe('track-202');
      expect(prefetched.queue_id).toBe('queue-req-prefetch-1');

      const rowInDb = mockQueueRows.find((r) => r.id === 'queue-req-prefetch-1');
      expect(rowInDb?.played_at).toBeNull();

      const upNext = await getUpNext('main', 5);
      const inUpNext = upNext.find((item) => item.queue_id === 'queue-req-prefetch-1');
      expect(inUpNext).toBeDefined();
    });

    it('marks channel_queue.played_at ONLY when markTrackStarted confirms on-air start', async () => {
      mockQueueRows.push({
        id: 'queue-req-prefetch-2',
        channel_id: 'channel-main',
        track_id: 'track-303',
        prompt_used: 'lo-fi rain',
        requested_by: '@trinity (telegram)',
        created_at: new Date().toISOString(),
        played_at: null,
        track: {
          id: 'track-303',
          title: 'Midnight Rain',
          artist_name: 'ChillAI',
          audio_url: 'https://example.com/midnight.mp3',
          tool_used: 'Suno',
          upvotes_count: 15,
        },
      });

      // 1. Prefetch
      await getNextAirplayItem('main', false);
      expect(mockQueueRows[0]?.played_at).toBeNull();

      // 2. Liquidsoap confirms on-air start
      const started = await markTrackStarted('main', 'track-303');
      expect(started.id).toBe('track-303');
      expect(started.queue_id).toBe('queue-req-prefetch-2');

      // 3. Now channel_queue row MUST be marked played_at
      expect(mockQueueRows[0]?.played_at).toBeTruthy();

      // 4. Now Playing reflects the queued track
      const nowPlaying = await getNowPlaying('main');
      expect(nowPlaying.item.id).toBe('track-303');
      expect(nowPlaying.item.queue_id).toBe('queue-req-prefetch-2');
    });

    it('handles multiple prefetch calls without prematurely consuming multiple queued tracks', async () => {
      mockQueueRows.push(
        {
          id: 'queue-req-multi-1',
          channel_id: 'channel-main',
          track_id: 'track-401',
          prompt_used: 'song 1',
          requested_by: '@user1',
          created_at: new Date(Date.now() - 3000).toISOString(),
          played_at: null,
          track: {
            id: 'track-401',
            title: 'Song 1',
            artist_name: 'Artist 1',
            audio_url: 'https://example.com/s1.mp3',
            tool_used: 'Suno',
            upvotes_count: 5,
          },
        },
        {
          id: 'queue-req-multi-2',
          channel_id: 'channel-main',
          track_id: 'track-402',
          prompt_used: 'song 2',
          requested_by: '@user2',
          created_at: new Date(Date.now() - 1000).toISOString(),
          played_at: null,
          track: {
            id: 'track-402',
            title: 'Song 2',
            artist_name: 'Artist 2',
            audio_url: 'https://example.com/s2.mp3',
            tool_used: 'Suno',
            upvotes_count: 8,
          },
        }
      );

      // Prefetch track 1
      const item1 = await getNextAirplayItem('main', false);
      expect(item1.queue_id).toBe('queue-req-multi-1');

      // Prefetch track 2 (prefetch pipeline buffer ahead)
      const item2 = await getNextAirplayItem('main', false);
      expect(item2.queue_id).toBe('queue-req-multi-2');

      // Neither should be marked played yet
      expect(mockQueueRows[0]?.played_at).toBeNull();
      expect(mockQueueRows[1]?.played_at).toBeNull();

      // Liquidsoap starts track 1
      await markTrackStarted('main', 'track-401');
      expect(mockQueueRows[0]?.played_at).toBeTruthy();
      expect(mockQueueRows[1]?.played_at).toBeNull();

      // Liquidsoap subsequently starts track 2
      await markTrackStarted('main', 'track-402');
      expect(mockQueueRows[1]?.played_at).toBeTruthy();
    });

    it('reconciles unplayed queue row when starting a track after server restart without in-memory pending state', async () => {
      mockQueueRows.push({
        id: 'queue-cold-restart',
        channel_id: 'channel-main',
        track_id: 'track-cold-1',
        prompt_used: 'cold prompt',
        requested_by: '@reboot_listener',
        created_at: new Date().toISOString(),
        played_at: null,
      });

      // Clear all in-memory pending state to simulate complete process restart
      clearPendingAirplayItems();

      // Liquidsoap sends start event for track-cold-1
      const started = await markTrackStarted('main', 'track-cold-1');

      expect(started.id).toBe('track-cold-1');
      expect(started.queue_id).toBe('queue-cold-restart');
      expect(started.requested_by).toBe('@reboot_listener');

      // Database row must be updated to played
      expect(mockQueueRows[0]?.played_at).toBeTruthy();
    });

    it('handles reconciliation of unplayed queue item when requested_by is absent', async () => {
      mockQueueRows.push({
        id: 'queue-no-user',
        channel_id: 'channel-main',
        track_id: 'track-cold-1',
        prompt_used: 'anon prompt',
        created_at: new Date().toISOString(),
        played_at: null,
      });

      clearPendingAirplayItems();

      const started = await markTrackStarted('main', 'track-cold-1');
      expect(started.id).toBe('track-cold-1');
      expect(started.queue_id).toBe('queue-no-user');
      expect(mockQueueRows[0]?.played_at).toBeTruthy();
    });

    it('marks non-queued library track as started without modifying queue rows', async () => {
      clearPendingAirplayItems();

      // Start a track that has no unplayed queue rows
      const started = await markTrackStarted('main', 'library-track-1');
      expect(started.id).toBe('library-track-1');
      expect(started.queue_id).toBeUndefined();
    });

    it('handles demo-fallback in markTrackStarted without attempting queue reconciliation', async () => {
      let channelQueueQueried = false;
      const originalRows = [...mockQueueRows];
      mockQueueRows.push({
        id: 'queue-demo-trap',
        channel_id: 'channel-main',
        track_id: 'demo-fallback',
        prompt_used: 'demo',
        created_at: new Date().toISOString(),
        played_at: null,
      });

      const started = await markTrackStarted('main', 'demo-fallback');
      expect(started.id).toBe('demo-fallback');
      expect(started.queue_id).toBeUndefined();
      // The trap row in queue must NOT have been marked played because demo-fallback should never reconcile queue
      expect(mockQueueRows.find((r) => r.id === 'queue-demo-trap')?.played_at).toBeNull();
    });

    it('updates currentAirplayItem on main channel but leaves it unaffected when starting track on another channel', async () => {
      clearPendingAirplayItems();
      resetChannelAirplayItems();

      // Start on main
      await markTrackStarted('main', 'track-main-1');
      const nowMain = await getNowPlaying('main');
      expect(nowMain.item.id).toBe('track-main-1');

      // Start on ambient
      await markTrackStarted('ambient', 'track-ambient-1');
      const nowAmbient = await getNowPlaying('ambient');
      expect(nowAmbient.item.id).toBe('track-ambient-1');

      // Now playing on main must NOT have been changed to ambient track
      const mainAfter = await getNowPlaying('main');
      expect(mainAfter.item.id).toBe('track-main-1');
    });

    it('isolates pending state across different channels so channels do not overwrite each other', async () => {
      mockQueueRows.push(
        {
          id: 'queue-main-1',
          channel_id: 'channel-main',
          track_id: 'track-main-1',
          prompt_used: 'main vibe',
          requested_by: '@main_listener',
          created_at: new Date().toISOString(),
          played_at: null,
          track: {
            id: 'track-main-1',
            title: 'Main Track',
            artist_name: 'Main Artist',
            audio_url: 'https://example.com/main.mp3',
            tool_used: 'Suno',
            upvotes_count: 10,
          },
        },
        {
          id: 'queue-ambient-1',
          channel_id: 'channel-ambient',
          track_id: 'track-ambient-1',
          prompt_used: 'ambient vibe',
          requested_by: '@ambient_listener',
          created_at: new Date().toISOString(),
          played_at: null,
          track: {
            id: 'track-ambient-1',
            title: 'Ambient Track',
            artist_name: 'Ambient Artist',
            audio_url: 'https://example.com/ambient.mp3',
            tool_used: 'Udio',
            upvotes_count: 10,
          },
        }
      );

      // Prefetch on channel 'main'
      const mainNext = await getNextAirplayItem('main', false);
      expect(mainNext.id).toBe('track-main-1');

      // Prefetch on channel 'ambient'
      const ambientNext = await getNextAirplayItem('ambient', false);
      expect(ambientNext.id).toBe('track-ambient-1');

      // Verify pending items per channel
      expect(getPendingAirplayItems('main').length).toBe(1);
      expect(getPendingAirplayItems('ambient').length).toBe(1);

      // Start main track
      const mainStarted = await markTrackStarted('main', 'track-main-1');
      expect(mainStarted.id).toBe('track-main-1');
      expect(mainStarted.queue_id).toBe('queue-main-1');
      expect(getPendingAirplayItems('main').length).toBe(0);

      // Ambient pending item must NOT have been lost or overwritten by main
      const ambientStarted = await markTrackStarted('ambient', 'track-ambient-1');
      expect(ambientStarted.id).toBe('track-ambient-1');
      expect(ambientStarted.queue_id).toBe('queue-ambient-1');
      expect(getPendingAirplayItems('ambient').length).toBe(0);
    });

    it('immediately marks played_at when autoPromote=true (web player direct play)', async () => {
      mockQueueRows.push({
        id: 'queue-req-direct-1',
        channel_id: 'channel-main',
        track_id: 'track-direct-1',
        prompt_used: 'direct play',
        requested_by: '@web_listener',
        created_at: new Date().toISOString(),
        played_at: null,
        track: {
          id: 'track-direct-1',
          title: 'Direct Track',
          artist_name: 'Direct Artist',
          audio_url: 'https://example.com/direct.mp3',
          tool_used: 'Suno',
          upvotes_count: 10,
        },
      });

      const next = await getNextAirplayItem('main', true);
      expect(next.id).toBe('track-direct-1');
      expect(next.queue_id).toBe('queue-req-direct-1');

      // Since autoPromote was true, played_at must be set immediately
      expect(mockQueueRows[0]?.played_at).toBeTruthy();
      expect(getPendingAirplayItems('main').length).toBe(0);
    });

    it('clears pending items selectively by channel or globally with clearPendingAirplayItems', async () => {
      mockQueueRows.push(
        {
          id: 'q-clear-1',
          channel_id: 'channel-main',
          track_id: 't-clear-1',
          prompt_used: 'p1',
          created_at: new Date().toISOString(),
          played_at: null,
          track: {
            id: 't-clear-1',
            title: 'Track 1',
            artist_name: 'Artist',
            audio_url: 'https://example.com/1.mp3',
            tool_used: 'Suno',
            upvotes_count: 1,
          },
        },
        {
          id: 'q-clear-2',
          channel_id: 'channel-ambient',
          track_id: 't-clear-2',
          prompt_used: 'p2',
          created_at: new Date().toISOString(),
          played_at: null,
          track: {
            id: 't-clear-2',
            title: 'Track 2',
            artist_name: 'Artist',
            audio_url: 'https://example.com/2.mp3',
            tool_used: 'Suno',
            upvotes_count: 1,
          },
        }
      );

      await getNextAirplayItem('main', false);
      await getNextAirplayItem('ambient', false);

      expect(getPendingAirplayItems('main').length).toBe(1);
      expect(getPendingAirplayItems('ambient').length).toBe(1);

      // Clear channel 'main' only
      clearPendingAirplayItems('main');
      expect(getPendingAirplayItems('main').length).toBe(0);
      expect(getPendingAirplayItems('ambient').length).toBe(1);

      // Clear all channels
      clearPendingAirplayItems();
      expect(getPendingAirplayItems('ambient').length).toBe(0);
    });
  });
});
