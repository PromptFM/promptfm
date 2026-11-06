// tests/unit/dedication-announcements.test.ts
// Unit & Integration tests for Issue #45:
// "Dedications are not announced when the scheduled song airs"

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleListenerRequest } from '@/lib/dj/batches';
import { getNextAirplayItem, markTrackStarted, resetAirplayDedupeCache } from '@/lib/dj/rotation';
import { broadcastToCommunity } from '@/lib/chat/bridge';

// In-memory mock tables for Supabase
const mockQueueTable: any[] = [];
const mockRequestsTable: any[] = [];
const mockStationStateTable: any[] = [];

vi.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === 'channel_queue') {
          return {
            select: (cols?: string, opts?: { count?: string; head?: boolean }) => ({
              eq: (col: string, val: any) => ({
                is: (isCol: string, isVal: any) => {
                  if (opts?.count === 'exact') {
                    return Promise.resolve({ count: mockQueueTable.length, data: null, error: null });
                  }
                  return {
                    order: () => ({
                      limit: () => ({
                        maybeSingle: async () => {
                          const item = mockQueueTable.find((q) => !q.played_at);
                          if (!item) return { data: null, error: null };
                          return {
                            data: {
                              ...item,
                              track: {
                                id: item.track_id,
                                title: 'Sunset Grooves',
                                artist_name: 'Deep House',
                                audio_url: 'https://cdn.example.com/sunset.mp3',
                                tool_used: 'Suno v3.5',
                                upvotes_count: 42,
                              },
                            },
                            error: null,
                          };
                        },
                      }),
                    }),
                  };
                },
              }),
            }),
            insert: async (data: any) => {
              const row = { id: `q-${Date.now()}-${Math.random()}`, ...data, played_at: null };
              mockQueueTable.push(row);
              return { data: row, error: null };
            },
            update: (updateData: any) => ({
              eq: (col: string, val: any) => {
                const target = mockQueueTable.find((q) => q[col] === val);
                if (target) Object.assign(target, updateData);
                return Promise.resolve({ error: null });
              },
            }),
          };
        }

        if (table === 'channels') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: 'channel-main' }, error: null }),
              }),
            }),
          };
        }

        if (table === 'tracks') {
          return {
            select: () => {
              const obj: any = {};
              obj.eq = () => obj;
              obj.order = () => obj;
              obj.limit = () => obj;
              obj.ilike = () => obj;
              obj.maybeSingle = async () => ({
                data: { id: 'track-101', title: 'Sunset Grooves', artist_name: 'Deep House', audio_url: 'https://cdn.example.com/sunset.mp3', tool_used: 'Suno', upvotes_count: 10 },
                error: null,
              });
              return obj;
            },
          };
        }

        if (table === 'community_requests') {
          return {
            insert: (data: any) => {
              const row = { id: `req-${Date.now()}`, ...data };
              mockRequestsTable.push(row);
              return {
                select: () => ({
                  single: async () => ({ data: row, error: null }),
                }),
              };
            },
            update: (updateData: any) => ({
              eq: (col: string, val: any) => {
                const found = mockRequestsTable.find((r) => r[col] === val);
                if (found) Object.assign(found, updateData);
                return Promise.resolve({ error: null });
              },
            }),
          };
        }

        if (table === 'station_state') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: mockStationStateTable[0] || null,
                  error: null,
                }),
              }),
            }),
            upsert: async (data: any) => {
              mockStationStateTable[0] = data;
              return { data, error: null };
            },
            update: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      },
    }),
  };
});

vi.mock('@/lib/chat/bridge', () => ({
  broadcastToCommunity: vi.fn().mockResolvedValue({ discord: true, telegram: true }),
}));

vi.mock('@/lib/safety/guardrails', () => ({
  evaluateContentSafety: vi.fn().mockResolvedValue({
    safe: true,
    category: 'clean',
    reason: 'Approved',
  }),
}));

vi.mock('@/lib/dj/rag', () => ({
  findTracksByVibe: vi.fn().mockResolvedValue([
    { id: 'track-101', title: 'Sunset Grooves', artist_name: 'Deep House' },
  ]),
}));

describe('Issue #45: Dedication On-Air Announcements & Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueTable.length = 0;
    mockRequestsTable.length = 0;
    mockStationStateTable.length = 0;
    resetAirplayDedupeCache();
  });

  describe('scheduleListenerRequest dedication handling', () => {
    it('preserves dedication recipient in channel_queue when submitting a song request with a dedication target', async () => {
      const res = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'user-123',
        platform_user_name: 'alex',
        type: 'song',
        content: 'synthwave sunset',
        target: '@maria',
      });

      expect(res.isRejected).toBeFalsy();
      expect(mockQueueTable.length).toBe(1);
      // Must not drop the dedication!
      expect(mockQueueTable[0].requested_by).toContain('alex');
      expect(mockQueueTable[0].requested_by).toContain('Dedicated to @maria');
    });

    it('enqueues a song and preserves dedication when submitting type "dedication"', async () => {
      const res = await scheduleListenerRequest({
        platform: 'telegram',
        platform_user_id: 'user-456',
        platform_user_name: 'elena',
        type: 'dedication',
        content: 'Happy Birthday to my best friend!',
        target: 'Maria',
      });

      expect(res.isRejected).toBeFalsy();
      expect(mockQueueTable.length).toBe(1);
      expect(mockQueueTable[0].requested_by).toContain('elena');
      expect(mockQueueTable[0].requested_by).toContain('Dedicated to @Maria');
      expect(mockQueueTable[0].requested_by).toContain('Happy Birthday to my best friend!');
      expect(res.confirmationMessage).toContain('Maria');
      expect(res.confirmationMessage).toContain('queue');
    });
  });

  describe('getNextAirplayItem and on-air broadcast', () => {
    it('propagates requested_by dedication to AirplayItem and announces dedication in community broadcast when song airs', async () => {
      // 1. Queue a song with a dedication
      await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'user-789',
        platform_user_name: 'alex',
        type: 'dedication',
        content: 'Sending good vibes to Maria!',
        target: 'Maria',
      });

      // 2. Airplay engine retrieves next item from queue
      const item = await getNextAirplayItem('main', false);
      expect(item.id).toBe('track-101');
      expect(item.requested_by).toBeDefined();
      expect(item.requested_by).toContain('alex');
      expect(item.requested_by).toContain('Dedicated to @Maria');

      // 3. Mark track started on air
      vi.mocked(broadcastToCommunity).mockClear();
      await markTrackStarted('main', item.id);

      // 4. Verify broadcastToCommunity announced the dedication on air
      expect(broadcastToCommunity).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(broadcastToCommunity).mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.message).toContain('Sunset Grooves');
      expect(callArgs?.message).toContain('💝 **Dedication:**');
      expect(callArgs?.message).toContain('Dedicated to @Maria');
    });
  });
});
