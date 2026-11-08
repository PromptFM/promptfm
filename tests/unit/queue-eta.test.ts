// tests/unit/queue-eta.test.ts
// Test-Driven Development (TDD) tests reproducing and resolving Issue #43:
// /song confirms one schedule but the track plays much later.
// Validates queue position awareness, dynamic ETA calculation, provisional labeling,
// and real-time schedule inspection via /queue.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleListenerRequest, calculateQueueETA } from '@/lib/dj/batches';
import { getUpNext } from '@/lib/dj/rotation';

const mockChannelQueue: any[] = [];
const mockRequestsTable: any[] = [];
let mockStagedItem: any = null;

vi.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === 'channels') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'channel-main', slug: 'main' }, error: null }),
              }),
            }),
          };
        }

        if (table === 'channel_queue') {
          return {
            select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === 'exact') {
                return {
                  eq: (_col: string, _val: any) => ({
                    is: (_field: string, _nullVal: any) =>
                      Promise.resolve({
                        count: mockChannelQueue.filter((q) => q.played_at === null).length,
                        data: null,
                        error: null,
                      }),
                  }),
                };
              }

              return {
                eq: (_col: string, _val: any) => ({
                  is: (_field: string, _nullVal: any) => ({
                    order: (_orderCol: string, _opts: any) => ({
                      limit: (limitNum: number) =>
                        Promise.resolve({
                          data: mockChannelQueue
                            .filter((q) => q.played_at === null)
                            .slice(0, limitNum),
                          error: null,
                        }),
                    }),
                  }),
                }),
              };
            },
            insert: (data: any) => {
              const row = { id: `queue-${Date.now()}-${Math.random()}`, played_at: null, ...data };
              mockChannelQueue.push(row);
              return Promise.resolve({ data: row, error: null });
            },
          };
        }

        if (table === 'tracks') {
          return {
            select: () => ({
              eq: () => ({
                ilike: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: { id: 'track-101', title: 'Sunset Grooves', artist_name: 'Deep House' },
                      error: null,
                    }),
                  }),
                }),
                order: () => ({
                  limit: async () => ({
                    data: [
                      { id: 'track-lib-1', title: 'Library Song 1', artist_name: 'Artist 1', upvotes_count: 10 },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === 'community_requests') {
          return {
            insert: (data: any) => {
              const row = { id: `req-${Date.now()}-${Math.random()}`, ...data };
              mockRequestsTable.push(row);
              return {
                select: () => ({
                  single: async () => ({ data: row, error: null }),
                }),
              };
            },
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
                      id: 'track-playing',
                      title: 'Live Now Track',
                      artist: 'DJ Live',
                      duration_hint_seconds: 180,
                    },
                    staged_item: mockStagedItem,
                    started_at: new Date(Date.now() - 60 * 1000).toISOString(), // 60s elapsed, ~120s remaining
                  },
                  error: null,
                }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
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

vi.mock('@/lib/safety/guardrails', () => ({
  evaluateContentSafety: vi.fn().mockResolvedValue({ safe: true }),
}));

vi.mock('@/lib/dj/rag', () => ({
  findTracksByVibe: vi.fn().mockResolvedValue([
    { id: 'track-101', title: 'Sunset Grooves', artist_name: 'Deep House', similarity: 0.95 },
  ]),
}));

describe('Issue #43 Reproduction & Queue ETA Fix (TDD)', () => {
  beforeEach(() => {
    mockChannelQueue.length = 0;
    mockRequestsTable.length = 0;
    mockStagedItem = null;
    vi.clearAllMocks();
  });

  describe('calculateQueueETA', () => {
    it('calculates queue position #1 dynamic ETA when queue is empty', () => {
      const eta = calculateQueueETA({
        queuePosition: 1,
        remainingSecondsOnCurrentTrack: 120,
        averageTrackSeconds: 210,
      });

      expect(eta.queuePosition).toBe(1);
      expect(eta.estimatedSeconds).toBe(120);
      expect(eta.estimatedMinutes).toBe(2);
      expect(eta.isProvisional).toBe(true);
      expect(eta.displayTime).toContain('UTC');
      expect(eta.batchId).toMatch(/^BATCH-\d{2}:\d{2}$/);
    });

    it('calculates dynamic ETA accounting for tracks ahead in queue', () => {
      const eta = calculateQueueETA({
        queuePosition: 3, // 2 tracks ahead + current track remainder
        remainingSecondsOnCurrentTrack: 90,
        averageTrackSeconds: 210,
      });

      expect(eta.queuePosition).toBe(3);
      // 90s + 2 * 210s = 510s (~8.5 min -> 9 min)
      expect(eta.estimatedSeconds).toBe(510);
      expect(eta.estimatedMinutes).toBe(9);
      expect(eta.isProvisional).toBe(true);
    });

    it('calculates dynamic ETA accounting for staged track duration', () => {
      const eta = calculateQueueETA({
        queuePosition: 1,
        remainingSecondsOnCurrentTrack: 120,
        averageTrackSeconds: 210,
        stagedTrackSeconds: 210,
      });

      expect(eta.queuePosition).toBe(1);
      // 120s remaining + 210s staged track = 330s (~5.5 min -> 6 min)
      expect(eta.estimatedSeconds).toBe(330);
      expect(eta.estimatedMinutes).toBe(6);
      expect(eta.isProvisional).toBe(true);
    });
  });

  describe('scheduleListenerRequest for song requests (Issue #43)', () => {
    it('returns queue position and provisional ETA in confirmation message for first song', async () => {
      const result = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'user-disc-1',
        platform_user_name: 'AlexListener',
        type: 'song',
        content: 'synthwave sunset',
      });

      expect(result.queuePosition).toBe(1);
      expect(result.isProvisional).toBe(true);
      expect(result.confirmationMessage).toContain('queued for live airplay');
      expect(result.confirmationMessage).toContain('Position: Up next (#1 in queue)');
      expect(result.confirmationMessage).toContain('provisional');
      expect(result.confirmationMessage).toContain('/queue');
    });

    it('accurately advances queue position and dynamic ETA when multiple songs are queued', async () => {
      // First song queued
      const res1 = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'user-1',
        platform_user_name: 'ListenerOne',
        type: 'song',
        content: 'synthwave',
      });
      expect(res1.queuePosition).toBe(1);

      // Second song queued
      const res2 = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'user-2',
        platform_user_name: 'ListenerTwo',
        type: 'song',
        content: 'chill lo-fi',
      });
      expect(res2.queuePosition).toBe(2);
      expect(res2.confirmationMessage).toContain('Position: #2 in queue');
      expect(res2.confirmationMessage).toContain('provisional');
      expect(res2.estimatedMinutes).toBeGreaterThanOrEqual(res1.estimatedMinutes || 0);
    });

    it('includes staged track duration in dynamic ETA when a track is pre-buffered in station_state', async () => {
      mockStagedItem = {
        id: 'track-staged-1',
        title: 'Cyber Skyline',
        artist: 'Synth Master',
        duration_hint_seconds: 210,
      };

      const result = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'user-disc-staged',
        platform_user_name: 'StagedListener',
        type: 'song',
        content: 'Sunset Grooves',
      });

      // 120s current remaining + 210s staged = 330s (~6 mins)
      expect(result.estimatedMinutes).toBe(6);
      expect(result.confirmationMessage).toContain('~6m');
      expect(result.confirmationMessage).toContain('provisional');
    });

    it('deduplicates when listener requests a track that is already staged in station_state', async () => {
      mockStagedItem = {
        id: 'track-101',
        title: 'Sunset Grooves',
        artist: 'Deep House',
        duration_hint_seconds: 200,
      };

      const result = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'user-disc-staged-repeat',
        platform_user_name: 'RepeatListener',
        type: 'song',
        content: 'Sunset Grooves',
      });

      // Must not insert a duplicate into channel_queue
      expect(mockChannelQueue.length).toBe(0);
      expect(result.confirmationMessage).toContain('already');
      expect(result.confirmationMessage).toContain('Sunset Grooves');
    });
  });

  describe('getUpNext schedule inspection', () => {
    it('populates queue position, provisional ETA, and requested_by on queued items', async () => {
      // Setup a queued track in mockChannelQueue
      mockChannelQueue.push({
        id: 'q-item-1',
        track_id: 'track-101',
        requested_by: '@AlexListener (discord)',
        played_at: null,
        track: {
          id: 'track-101',
          title: 'Sunset Grooves',
          artist_name: 'Deep House',
          audio_url: 'https://example.com/audio.mp3',
          upvotes_count: 15,
          duration_hint_seconds: 200,
        },
      });

      const upNext = await getUpNext('main', 5);
      expect(upNext.length).toBeGreaterThan(0);
      const queuedTrack = upNext.find((t) => t.id === 'track-101');
      expect(queuedTrack).toBeDefined();
      expect(queuedTrack?.queue_position).toBe(1);
      expect(queuedTrack?.requested_by).toBe('@AlexListener (discord)');
      expect(queuedTrack?.estimated_air_time).toMatch(/^\d{2}:\d{2} UTC$/);

      // Verify library fallback track filling remainder has queue_position and estimated_air_time
      const libTrack = upNext.find((t) => t.id === 'track-lib-1');
      if (libTrack) {
        expect(libTrack.queue_position).toBe(2);
        expect(libTrack.estimated_air_time).toMatch(/^\d{2}:\d{2} UTC$/);
      }
    });

    it('respects limit parameter and stops after requested count', async () => {
      mockChannelQueue.push(
        {
          id: 'q-1',
          track_id: 't-1',
          requested_by: '@User1',
          played_at: null,
          track: { id: 't-1', title: 'Song 1', artist_name: 'A1', audio_url: 'u1', upvotes_count: 5 },
        },
        {
          id: 'q-2',
          track_id: 't-2',
          requested_by: '@User2',
          played_at: null,
          track: { id: 't-2', title: 'Song 2', artist_name: 'A2', audio_url: 'u2', upvotes_count: 5 },
        }
      );

      const upNext = await getUpNext('main', 1);
      expect(upNext.length).toBe(1);
      expect(upNext[0]?.id).toBe('t-1');
      expect(upNext[0]?.queue_position).toBe(1);
    });

    it('places the staged track at position #1 and offsets channel_queue items to position #2 and beyond', async () => {
      mockStagedItem = {
        id: 'track-staged-hero',
        title: 'Hero Staged Track',
        artist: 'Hero DJ',
        audio_url: 'https://example.com/staged.mp3',
        upvotes_count: 50,
        duration_hint_seconds: 200,
      };

      mockChannelQueue.push({
        id: 'q-item-queued',
        track_id: 'track-101',
        requested_by: '@AlexListener (discord)',
        played_at: null,
        track: {
          id: 'track-101',
          title: 'Sunset Grooves',
          artist_name: 'Deep House',
          audio_url: 'https://example.com/audio.mp3',
          upvotes_count: 15,
          duration_hint_seconds: 180,
        },
      });

      const upNext = await getUpNext('main', 5);
      expect(upNext.length).toBeGreaterThanOrEqual(2);
      expect(upNext[0]?.id).toBe('track-staged-hero');
      expect(upNext[0]?.queue_position).toBe(1);
      expect(upNext[1]?.id).toBe('track-101');
      expect(upNext[1]?.queue_position).toBe(2);
    });
  });
});
