// tests/unit/batches.test.ts
// Unit tests for Listener Request Batch Scheduler and Consolidated Announcements

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateNextBatchSlot,
  scheduleListenerRequest,
  rejectScheduledRequest,
  synthesizeScheduledRequest,
  synthesizeBatchAnnouncement,
} from '@/lib/dj/batches';
import * as djEngine from '@/lib/dj/engine';
import { getDJById } from '@/lib/dj/roster';

// Mock Supabase admin client
const mockRequestsTable: any[] = [];
const mockQueueTable: any[] = [];

vi.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === 'channel_queue') {
          return {
            insert: (data: any) => {
              mockQueueTable.push(data);
              return {
                select: () => ({
                  single: async () => ({ data, error: null }),
                }),
              };
            },
            select: () => ({
              eq: () => ({
                is: () => ({
                  order: () => ({
                    limit: async () => ({
                      data: mockQueueTable.map((item) => ({
                        ...item,
                        track: { id: item.track_id, title: 'Sunset Grooves' },
                      })),
                      error: null,
                    }),
                  }),
                }),
              }),
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
            select: () => ({
              eq: (field: string, val: any) => ({
                single: async () => {
                  const found = mockRequestsTable.find((r) => r[field] === val);
                  return { data: found || null, error: found ? null : { message: 'Not found' } };
                },
                in: (statusField: string, statuses: string[]) => ({
                  order: () => ({
                    limit: async () => ({
                      data: mockRequestsTable.filter(
                        (r) => r[field] === val && statuses.includes(r[statusField])
                      ),
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            update: (updateData: any) => ({
              eq: (field: string, val: any) => {
                const target = mockRequestsTable.find((r) => r[field] === val);
                if (target) Object.assign(target, updateData);
                return Promise.resolve({ error: null });
              },
              in: (field: string, vals: any[]) => {
                mockRequestsTable
                  .filter((r) => vals.includes(r[field]))
                  .forEach((r) => Object.assign(r, updateData));
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
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

vi.mock('@/lib/dj/engine', () => ({
  createBroadcastDrop: vi.fn().mockResolvedValue({
    script: 'Consolidated radio announcement',
    audioUrl: 'https://example.com/batch-announcement.mp3',
    dj: { id: 'dj_neon', name: 'DJ Neon', title: 'Host' },
  }),
}));

describe('Listener Request Batch Scheduling & Consolidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestsTable.length = 0;
    mockQueueTable.length = 0;
  });

  describe('calculateNextBatchSlot', () => {
    it('rounds up to the next 15-minute radio clock milestone', () => {
      const slot = calculateNextBatchSlot(10);
      expect(slot.batchId).toMatch(/^BATCH-\d{2}:\d{2}$/);
      expect(slot.displayTime).toContain('UTC');
    });
  });

  describe('scheduleListenerRequest', () => {
    it('schedules a valid dedication into the upcoming batch slot', async () => {
      const result = await scheduleListenerRequest({
        platform: 'telegram',
        platform_user_id: '12345',
        platform_user_name: 'alex',
        type: 'dedication',
        content: 'Happy birthday to Maria!',
        target: 'Maria',
      });

      expect(result.batchId).toMatch(/^BATCH-/);
      expect(result.confirmationMessage).toContain('Dedication accepted');
      expect(result.isRejected).toBeFalsy();
    });

    it('enqueues matched track into channel_queue when a listener requests a song via /song', async () => {
      const result = await scheduleListenerRequest({
        platform: 'telegram',
        platform_user_id: '12345',
        platform_user_name: 'alex',
        type: 'song',
        content: 'sunset grooves',
      });

      expect(result.confirmationMessage).toContain('Sunset Grooves');
      expect(mockQueueTable.length).toBe(1);
      expect(mockQueueTable[0].track_id).toBe('track-101');
      expect(mockQueueTable[0].requested_by).toContain('@alex');
    });

    it('handles requests for weather, zodiac, and explicit/unsafe content upfront', async () => {
      const weatherRes = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: '456',
        platform_user_name: 'sarah',
        type: 'weather',
        content: 'London',
      });
      expect(weatherRes.confirmationMessage).toContain('Weather check');

      const zodiacRes = await scheduleListenerRequest({
        platform: 'telegram',
        platform_user_id: '789',
        platform_user_name: 'leo',
        type: 'zodiac',
        content: 'Leo',
      });
      expect(zodiacRes.confirmationMessage).toContain('Cosmic AI Zodiac');
    });
  });

  describe('rejectScheduledRequest', () => {
    it('declines a scheduled request and notifies the community', async () => {
      mockRequestsTable.push({
        id: 'req-to-decline',
        platform: 'telegram',
        platform_user_id: 'user-123',
        platform_user_name: 'spammer',
        content: 'Bad message',
        batch_id: 'BATCH-14:00',
        status: 'scheduled',
      });

      const result = await rejectScheduledRequest('req-to-decline', 'Broadcast standards violation');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Declined request');

      const item = mockRequestsTable.find((r) => r.id === 'req-to-decline');
      expect(item?.status).toBe('rejected');
    });

    it('throws error when request id does not exist', async () => {
      await expect(rejectScheduledRequest('non-existent', 'reason')).rejects.toThrow('Request not found');
    });
  });

  describe('synthesizeScheduledRequest', () => {
    it('synthesizes a single dedication drop and marks it aired', async () => {
      mockRequestsTable.push({
        id: 'req-single',
        platform: 'discord',
        platform_user_name: 'listener1',
        type: 'dedication',
        content: 'Love the stream!',
        target: 'All listeners',
        status: 'scheduled',
      });

      const drop = await synthesizeScheduledRequest('req-single');
      expect(drop.audioUrl).toBe('https://example.com/batch-announcement.mp3');
      expect(drop.script).toBe('Consolidated radio announcement');

      const item = mockRequestsTable.find((r) => r.id === 'req-single');
      expect(item?.status).toBe('aired');
      expect(item?.audio_url).toBe(drop.audioUrl);
    });
  });

  describe('synthesizeBatchAnnouncement (Consolidated Drop)', () => {
    it('batches multiple pending requests into ONE single DJ broadcast announcement', async () => {
      const batchId = 'BATCH-18:45';

      // Insert 2 simulated requests in the same batch
      mockRequestsTable.push(
        {
          id: 'req-1',
          platform: 'telegram',
          platform_user_name: 'alex',
          type: 'dedication',
          content: 'Keep playing the great synthwave!',
          target: 'Night Owls',
          batch_id: batchId,
          status: 'scheduled',
        },
        {
          id: 'req-2',
          platform: 'discord',
          platform_user_name: 'elena',
          type: 'weather',
          content: 'Tokyo',
          target: 'Tokyo',
          batch_id: batchId,
          status: 'scheduled',
        }
      );

      const dropSpy = vi.spyOn(djEngine, 'createBroadcastDrop');

      const result = await synthesizeBatchAnnouncement(batchId);

      // Exactly ONE voice drop generated for the whole batch
      expect(dropSpy).toHaveBeenCalledTimes(1);
      expect(result.count).toBe(2);
      expect(result.audioUrl).toBe('https://example.com/batch-announcement.mp3');

      // All requests in the batch marked as aired
      const req1 = mockRequestsTable.find((r) => r.id === 'req-1');
      const req2 = mockRequestsTable.find((r) => r.id === 'req-2');
      expect(req1?.status).toBe('aired');
      expect(req2?.status).toBe('aired');
      expect(req1?.audio_url).toBe('https://example.com/batch-announcement.mp3');
      expect(req2?.audio_url).toBe('https://example.com/batch-announcement.mp3');
    });

    it('returns empty result if batch has no scheduled items', async () => {
      const result = await synthesizeBatchAnnouncement('BATCH-EMPTY');
      expect(result.count).toBe(0);
      expect(result.audioUrl).toBe('');
    });
  });
});
