// tests/unit/batches.test.ts
// Unit tests for Listener Request Batch Scheduler and Consolidated Announcements

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateNextBatchSlot,
  calculateQueueETA,
  scheduleListenerRequest,
  rejectScheduledRequest,
  synthesizeScheduledRequest,
  synthesizeBatchAnnouncement,
} from '@/lib/dj/batches';
import { createBroadcastDrop } from '@/lib/dj/engine';
import { broadcastToCommunity } from '@/lib/chat/bridge';
import { evaluateContentSafety } from '@/lib/safety/guardrails';
import { findTracksByVibe } from '@/lib/dj/rag';

// Mock Supabase admin client
const mockRequestsTable: any[] = [];
const mockQueueTable: any[] = [];
let mockStationStateData: any = null;
let mockTracksMatch: any = { id: 'track-101', title: 'Sunset Grooves', artist_name: 'Deep House' };
let mockInsertShouldError = false;

vi.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === 'channel_queue') {
          return {
            select: (cols?: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.head) {
                return {
                  eq: (col: string, val: any) => ({
                    is: (isCol: string, isVal: any) => {
                      if (col !== 'channel_id' || isCol !== 'played_at') {
                        return Promise.resolve({ count: 0, data: [], error: null });
                      }
                      return Promise.resolve({
                        count: mockQueueTable.length,
                        data: null,
                        error: null,
                      });
                    },
                  }),
                };
              }
              return {
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
              };
            },
            insert: (data: any) => {
              mockQueueTable.push(data);
              return {
                select: () => ({
                  single: async () => ({ data, error: null }),
                }),
              };
            },
          };
        }

        if (table === 'channels') {
          return {
            select: (col?: string) => ({
              eq: (eqCol: string, eqVal: any) => ({
                maybeSingle: async () => {
                  if (eqCol !== 'slug' || eqVal !== 'main') {
                    return { data: null, error: null };
                  }
                  return { data: { id: 'channel-main' }, error: null };
                },
              }),
            }),
          };
        }

        if (table === 'tracks') {
          return {
            select: (cols?: string) => ({
              eq: (col: string, val: any) => {
                if (col !== 'status' || val !== 'approved') {
                  return { ilike: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
                }
                return {
                  ilike: (iCol: string, iPattern: string) => {
                    if (iCol !== 'title') {
                      return { limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
                    }
                    return {
                      limit: () => ({
                        maybeSingle: async () => ({
                          data: mockTracksMatch,
                          error: null,
                        }),
                      }),
                    };
                  },
                };
              },
            }),
          };
        }

        if (table === 'station_state') {
          return {
            select: (cols?: string) => ({
              eq: (col: string, val: any) => ({
                maybeSingle: async () => {
                  if (col !== 'channel_slug' || val !== 'main') {
                    return { data: null, error: null };
                  }
                  return {
                    data: mockStationStateData,
                    error: null,
                  };
                },
              }),
            }),
          };
        }

        if (table === 'community_requests') {
          return {
            insert: (data: any) => {
              if (mockInsertShouldError) {
                return {
                  select: () => ({
                    single: async () => ({ data: null, error: { message: 'Database constraint violation' } }),
                  }),
                };
              }
              const row = { id: `req-${Date.now()}-${Math.random()}`, ...data };
              mockRequestsTable.push(row);
              return {
                select: () => ({
                  single: async () => ({ data: row, error: null }),
                }),
              };
            },
            select: (cols?: string) => ({
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
    is18Plus: false,
    category: 'clean',
    reason: 'Content adheres to standards',
  }),
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
  fetchLiveHeadlines: vi.fn().mockResolvedValue([]),
}));

describe('Listener Request Batch Scheduling & Consolidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestsTable.length = 0;
    mockQueueTable.length = 0;
    mockStationStateData = null;
    mockTracksMatch = { id: 'track-101', title: 'Sunset Grooves', artist_name: 'Deep House' };
    mockInsertShouldError = false;
  });

  describe('calculateNextBatchSlot', () => {
    it('rounds up to the next 15-minute radio clock milestone with default 15 min delay', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-05-15T12:05:00.000Z'));
        const slot = calculateNextBatchSlot();
        expect(slot.batchId).toBe('BATCH-12:30');
        expect(slot.displayTime).toBe('12:30 UTC');
        expect(slot.airDate.toISOString()).toBe('2026-05-15T12:30:00.000Z');
      } finally {
        vi.useRealTimers();
      }
    });

    it('handles single-digit hours and minutes with padStart', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-05-15T08:04:00.000Z'));
        const slot = calculateNextBatchSlot(1); // 08:05 -> rounds to 08:15
        expect(slot.batchId).toBe('BATCH-08:15');
        expect(slot.displayTime).toBe('08:15 UTC');
      } finally {
        vi.useRealTimers();
      }
    });

    it('handles custom delayMinutes and rolls over appropriately', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-05-15T12:40:00.000Z'));
        const slot = calculateNextBatchSlot(25); // 12:40 + 25m = 13:05 -> rolls to 13:15
        expect(slot.batchId).toBe('BATCH-13:15');
        expect(slot.displayTime).toBe('13:15 UTC');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('calculateQueueETA', () => {
    it('clamps negative or zero queue position to 1', () => {
      const eta = calculateQueueETA({ queuePosition: 0 });
      expect(eta.queuePosition).toBe(1);
      expect(eta.isProvisional).toBe(true);
      expect(eta.estimatedSeconds).toBe(120);
      expect(eta.estimatedMinutes).toBe(2);
    });

    it('uses defaults when remainingSeconds and averageTrackSeconds are omitted', () => {
      const eta = calculateQueueETA({ queuePosition: 2 });
      expect(eta.estimatedSeconds).toBe(120 + 210); // 330s
      expect(eta.estimatedMinutes).toBe(6);
      expect(eta.batchId).toMatch(/^BATCH-\d{2}:\d{2}$/);
    });

    it('correctly formats single-digit hours and minutes with padStart', () => {
      const baseTime = new Date('2026-06-01T08:04:00.000Z').getTime();
      const eta = calculateQueueETA({
        queuePosition: 1,
        remainingSecondsOnCurrentTrack: 60,
        baseTime,
      });
      expect(eta.batchId).toBe('BATCH-08:05');
      expect(eta.displayTime).toBe('08:05 UTC');
    });

    it('clamps estimatedSeconds to minimum 30s', () => {
      const eta = calculateQueueETA({
        queuePosition: 1,
        remainingSecondsOnCurrentTrack: 10,
      });
      expect(eta.estimatedSeconds).toBe(30);
      expect(eta.estimatedMinutes).toBe(1);
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

      expect(evaluateContentSafety).toHaveBeenCalledWith('Happy birthday to Maria! Maria');
      expect(result.batchId).toMatch(/^BATCH-/);
      expect(result.confirmationMessage).toContain('Dedication accepted for @Maria!');
      expect(result.isRejected).toBeFalsy();
    });

    it('handles dedication without target using default', async () => {
      const result = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: '12345',
        platform_user_name: 'alex',
        type: 'dedication',
        content: 'Good vibes!',
      });
      expect(evaluateContentSafety).toHaveBeenCalledWith('Good vibes!');
      expect(result.confirmationMessage).toContain('@friend');
    });

    it('enqueues matched track into channel_queue when a listener requests a song via /song', async () => {
      const result = await scheduleListenerRequest({
        platform: 'telegram',
        platform_user_id: '12345',
        platform_user_name: 'alex',
        type: 'song',
        content: 'sunset grooves',
      });

      expect(findTracksByVibe).toHaveBeenCalledWith('sunset grooves', { limit: 1 });
      expect(result.confirmationMessage).toContain('Track "Sunset Grooves" by Deep House queued for live airplay!');
      expect(result.confirmationMessage).toContain('Position: Up next (#1 in queue)');
      expect(mockQueueTable.length).toBe(1);
      expect(mockQueueTable[0].channel_id).toBe('channel-main');
      expect(mockQueueTable[0].track_id).toBe('track-101');
      expect(mockQueueTable[0].requested_by).toBe('@alex (telegram)');
      expect(result.queuePosition).toBe(1);
      expect(result.isProvisional).toBe(true);
    });

    it('falls back to rejected default id when rejectedReq row insert returns null', async () => {
      vi.mocked(evaluateContentSafety).mockResolvedValueOnce({
        safe: false,
        is18Plus: false,
        category: 'violence',
        reason: 'Violent content',
      });
      mockInsertShouldError = true; // will cause insert to return data: null

      const res = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'u-rej',
        platform_user_name: 'violent_user',
        type: 'song',
        content: 'attack everyone',
      });

      expect(res.isRejected).toBe(true);
      expect(res.requestId).toBe('rejected');
    });

    it('handles track matched without artist_name', async () => {
      vi.mocked(findTracksByVibe).mockResolvedValueOnce([
        { id: 'track-solo', title: 'Solo Jam', similarity: 0.9 } as any,
      ]);

      const result = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'u-1',
        platform_user_name: 'dave',
        type: 'song',
        content: 'solo jam',
      });

      expect(result.confirmationMessage).toContain('Track "Solo Jam" queued for live airplay!');
      expect(result.confirmationMessage).not.toContain('by undefined');
    });

    it('falls back to direct DB match when findTracksByVibe throws', async () => {
      vi.mocked(findTracksByVibe).mockRejectedValueOnce(new Error('Vibe service offline'));
      mockTracksMatch = { id: 'track-direct', title: 'Direct Vibe', artist_name: 'Synth Master' };

      const result = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'u-2',
        platform_user_name: 'sam',
        type: 'song',
        content: 'direct vibe',
      });

      expect(result.confirmationMessage).toContain('Direct Vibe');
      expect(result.confirmationMessage).toContain('Synth Master');
    });

    it('handles song request when no track is matched at all', async () => {
      vi.mocked(findTracksByVibe).mockResolvedValueOnce([]);
      mockTracksMatch = null;

      const result = await scheduleListenerRequest({
        platform: 'web',
        platform_user_id: 'u-3',
        platform_user_name: 'webby',
        type: 'song',
        content: 'unmatched acoustic guitar melody',
      });

      expect(result.confirmationMessage).toContain('Track request "unmatched acoustic guitar melody" added to airplay queue!');
      expect(result.confirmationMessage).toContain('Position: Up next (#1 in queue)');
    });

    it('reads active station_state duration_hint to adjust remaining current track time', async () => {
      mockStationStateData = {
        channel_slug: 'main',
        airplay_item: { id: 'track-live', title: 'Live Now', duration_hint_seconds: 300 },
        started_at: new Date(Date.now() - 100 * 1000).toISOString(),
      };

      const result = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'u-4',
        platform_user_name: 'timer_user',
        type: 'song',
        content: 'sunset grooves',
      });

      expect(result.queuePosition).toBe(1);
      expect(result.estimatedMinutes).toBeGreaterThanOrEqual(3);
    });

    it('handles station_state where track has exceeded duration hint (clamps to 30s remaining)', async () => {
      mockStationStateData = {
        channel_slug: 'main',
        airplay_item: { id: 'track-live', title: 'Live Now', duration_hint_seconds: 180 },
        started_at: new Date(Date.now() - 250 * 1000).toISOString(),
      };

      const result = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'u-5',
        platform_user_name: 'timer_user_2',
        type: 'song',
        content: 'sunset grooves',
      });

      expect(result.queuePosition).toBe(1);
      expect(result.isProvisional).toBe(true);
    });

    it('handles requests for weather, zodiac, and default unknown type', async () => {
      const weatherRes = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: '456',
        platform_user_name: 'sarah',
        type: 'weather',
        content: 'London',
      });
      expect(weatherRes.confirmationMessage).toContain('Weather check for London');

      const zodiacRes = await scheduleListenerRequest({
        platform: 'telegram',
        platform_user_id: '789',
        platform_user_name: 'leo',
        type: 'zodiac',
        content: 'Leo',
      });
      expect(zodiacRes.confirmationMessage).toContain('Cosmic AI Zodiac reading for Leo');

      const unknownRes = await scheduleListenerRequest({
        platform: 'web',
        platform_user_id: '999',
        platform_user_name: 'guest',
        type: 'news' as any,
        content: 'AI news drop',
      });
      expect(unknownRes.confirmationMessage).toContain('Request scheduled for airplay');
    });

    it('rejects unsafe content upfront via guardrails with custom refusal message', async () => {
      vi.mocked(evaluateContentSafety).mockResolvedValueOnce({
        safe: false,
        is18Plus: false,
        category: 'hate_speech',
        reason: 'Violates hate speech policy',
        refusalMessage: 'Refusal: Your text contains prohibited words.',
      });

      const res = await scheduleListenerRequest({
        platform: 'telegram',
        platform_user_id: 'bad-user',
        platform_user_name: 'bad_actor',
        platform_message_id: 'msg-99',
        target: 'target-person',
        type: 'dedication',
        content: 'Harmful slurs',
      });

      expect(res.isRejected).toBe(true);
      expect(res.batchId).toBe('REJECTED');
      expect(res.estimatedAirTime).toBe('None');
      expect(res.confirmationMessage).toBe('Refusal: Your text contains prohibited words.');
      expect(res.rejectionReason).toBe('Violates hate speech policy');

      // Verify rejected row audit record
      const rejectedRow = mockRequestsTable.find((r) => r.status === 'rejected');
      expect(rejectedRow).toBeDefined();
      expect(rejectedRow?.platform).toBe('telegram');
      expect(rejectedRow?.platform_user_id).toBe('bad-user');
      expect(rejectedRow?.platform_user_name).toBe('bad_actor');
      expect(rejectedRow?.platform_message_id).toBe('msg-99');
      expect(rejectedRow?.target).toBe('target-person');
      expect(rejectedRow?.batch_id).toBeNull();
    });

    it('rejects unsafe content upfront with fallback message if refusalMessage is omitted', async () => {
      vi.mocked(evaluateContentSafety).mockResolvedValueOnce({
        safe: false,
        is18Plus: true,
        category: 'harassment',
        reason: 'Harassing messages not permitted',
      });

      const res = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: 'bad-user-2',
        platform_user_name: 'bad_actor_2',
        type: 'song',
        content: 'Explicit themes',
      });

      expect(res.isRejected).toBe(true);
      expect(res.confirmationMessage).toBe(
        '🚫 Request declined: Your submission violates PromptFM broadcast ethics (harassment). PromptFM operates as a family-safe and inclusive 24/7 radio station.'
      );
    });

    it('throws error when database fails to insert community_requests row', async () => {
      mockInsertShouldError = true;

      await expect(
        scheduleListenerRequest({
          platform: 'telegram',
          platform_user_id: 'u-err',
          platform_user_name: 'err_user',
          type: 'dedication',
          content: 'Test fail',
        })
      ).rejects.toThrow('Failed to log request: Database constraint violation');
    });
  });

  describe('rejectScheduledRequest & notifyUserOfRejection', () => {
    it('declines a scheduled request and notifies via Telegram when bot token is configured', async () => {
      const oldToken = process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_BOT_TOKEN = 'test-tele-token';
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

      try {
        mockRequestsTable.push({
          id: 'req-to-decline',
          platform: 'telegram',
          platform_user_id: '12345678',
          platform_user_name: 'spammer',
          platform_message_id: '99',
          content: 'Bad message',
          batch_id: 'BATCH-14:00',
          status: 'scheduled',
        });

        const result = await rejectScheduledRequest('req-to-decline', 'Broadcast standards violation', 'ModeratorDan');
        expect(result.success).toBe(true);
        expect(result.message).toBe(
          'Declined request "Bad message" from BATCH-14:00 and notified @spammer on telegram. Reason: "Broadcast standards violation"'
        );

        const item = mockRequestsTable.find((r) => r.id === 'req-to-decline');
        expect(item?.status).toBe('rejected');
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.telegram.org/bottest-tele-token/sendMessage',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('BATCH-14:00'),
          })
        );
        expect(broadcastToCommunity).toHaveBeenCalledWith({
          title: 'Broadcast Moderation Notice (BATCH-14:00)',
          message: '❌ The request from **@spammer** (*"Bad message"*) was declined by **ModeratorDan**.\n\n**Reason:** Broadcast standards violation',
          author: 'ModeratorDan',
        });
      } finally {
        process.env.TELEGRAM_BOT_TOKEN = oldToken;
      }
    });

    it('declines request on discord without Telegram API call', async () => {
      mockRequestsTable.push({
        id: 'req-disc-decline',
        platform: 'discord',
        platform_user_id: 'disc-999',
        platform_user_name: 'disc_user',
        content: 'Not suitable',
        batch_id: null,
        status: 'scheduled',
      });

      const result = await rejectScheduledRequest('req-disc-decline', 'Commercial advertising');
      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'Declined request "Not suitable" from queue and notified @disc_user on discord. Reason: "Commercial advertising"'
      );
      expect(broadcastToCommunity).toHaveBeenCalledWith({
        title: 'Broadcast Moderation Notice (Queue)',
        message: '❌ The request from **@disc_user** (*"Not suitable"*) was declined by **Station Admin**.\n\n**Reason:** Commercial advertising',
        author: 'Station Admin',
      });
    });

    it('handles Telegram fetch error gracefully', async () => {
      const oldToken = process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      try {
        mockRequestsTable.push({
          id: 'req-net-err',
          platform: 'telegram',
          platform_user_id: '999',
          platform_user_name: 'listener_999',
          content: 'Test content',
          status: 'scheduled',
        });

        const res = await rejectScheduledRequest('req-net-err', 'Invalid');
        expect(res.success).toBe(true);
      } finally {
        process.env.TELEGRAM_BOT_TOKEN = oldToken;
      }
    });

    it('throws error when request id does not exist', async () => {
      await expect(rejectScheduledRequest('non-existent-id', 'No reason')).rejects.toThrow(
        'Request not found: non-existent-id'
      );
    });
  });

  describe('synthesizeScheduledRequest', () => {
    it('synthesizes a dedication drop and marks it aired', async () => {
      mockRequestsTable.push({
        id: 'req-ded-1',
        platform: 'telegram',
        platform_user_id: 'user-77',
        platform_user_name: 'Elena',
        type: 'dedication',
        content: 'Happy Anniversary!',
        target: 'Marco',
        status: 'scheduled',
      });

      const result = await synthesizeScheduledRequest('req-ded-1');
      expect(result.script).toBe('Consolidated radio announcement');
      expect(result.audioUrl).toBe('https://example.com/batch-announcement.mp3');

      expect(createBroadcastDrop).toHaveBeenCalledWith({
        type: 'custom_prompt',
        topicOrText: expect.stringContaining('Listener shoutout! Listener @Elena on telegram has sent this dedication to Marco: "Happy Anniversary!"'),
        dj: expect.any(Object),
      });

      expect(broadcastToCommunity).toHaveBeenCalledWith({
        title: 'ON AIR NOW: Dedication from @Elena',
        message: '🎙️ "Consolidated radio announcement"\n\nTune in live: https://promptfm.live',
        category: 'dedication',
        author: 'DJ Neon',
      });

      const updated = mockRequestsTable.find((r) => r.id === 'req-ded-1');
      expect(updated?.status).toBe('aired');
      expect(updated?.audio_url).toBe(result.audioUrl);
      expect(updated?.aired_at).toBeDefined();
    });

    it('synthesizes a dedication drop without target using fallback friend prompt', async () => {
      mockRequestsTable.push({
        id: 'req-ded-no-target',
        platform: 'discord',
        platform_user_id: 'user-78',
        platform_user_name: 'Elena',
        type: 'dedication',
        content: 'Rock on!',
        target: null,
        status: 'scheduled',
      });

      await synthesizeScheduledRequest('req-ded-no-target');
      expect(createBroadcastDrop).toHaveBeenCalledWith({
        type: 'custom_prompt',
        topicOrText: expect.stringContaining('sent this dedication to a special friend: "Rock on!"'),
        dj: expect.any(Object),
      });
    });

    it('synthesizes a zodiac drop without target using content', async () => {
      mockRequestsTable.push({
        id: 'req-zod-no-target',
        platform: 'discord',
        platform_user_id: 'user-z2',
        platform_user_name: 'StarGazer',
        type: 'zodiac',
        content: 'Aquarius',
        target: null,
        status: 'scheduled',
      });

      await synthesizeScheduledRequest('req-zod-no-target');
      expect(createBroadcastDrop).toHaveBeenCalledWith({
        type: 'custom_prompt',
        topicOrText: expect.stringContaining('Synthetic Music Horoscope" for the sign of Aquarius, requested by @StarGazer'),
        dj: expect.any(Object),
      });
    });

    it('synthesizes a weather drop without target using content', async () => {
      mockRequestsTable.push({
        id: 'req-wea-no-target',
        platform: 'telegram',
        platform_user_id: 'user-w2',
        platform_user_name: 'RainFan',
        type: 'weather',
        content: 'Paris',
        target: null,
        status: 'scheduled',
      });

      await synthesizeScheduledRequest('req-wea-no-target');
      expect(createBroadcastDrop).toHaveBeenCalledWith({
        type: 'custom_prompt',
        topicOrText: expect.stringContaining('Live listener weather check for'),
        dj: expect.any(Object),
      });
    });

    it('synthesizes a weather drop', async () => {
      mockRequestsTable.push({
        id: 'req-wea-1',
        platform: 'discord',
        platform_user_id: 'user-w',
        platform_user_name: 'WeatherFan',
        type: 'weather',
        content: 'Berlin',
        status: 'scheduled',
      });

      const result = await synthesizeScheduledRequest('req-wea-1');
      expect(result.script).toBeDefined();
      expect(createBroadcastDrop).toHaveBeenCalledWith({
        type: 'custom_prompt',
        topicOrText: expect.stringContaining('Live listener weather check for'),
        dj: expect.any(Object),
      });
    });

    it('synthesizes generic request type drop', async () => {
      mockRequestsTable.push({
        id: 'req-gen-1',
        platform: 'web',
        platform_user_id: 'user-g',
        platform_user_name: 'WebListener',
        type: 'custom_type',
        content: 'Play more ambient',
        status: 'scheduled',
      });

      const result = await synthesizeScheduledRequest('req-gen-1');
      expect(result.script).toBeDefined();
      expect(createBroadcastDrop).toHaveBeenCalledWith({
        type: 'custom_prompt',
        topicOrText: expect.stringContaining('Deliver this listener request from @WebListener: "Play more ambient"'),
        dj: expect.any(Object),
      });
    });

    it('throws when request does not exist', async () => {
      await expect(synthesizeScheduledRequest('missing-req')).rejects.toThrow('Request not found');
    });
  });

  describe('synthesizeBatchAnnouncement', () => {
    it('batches multiple pending requests into ONE single DJ broadcast announcement', async () => {
      mockRequestsTable.push(
        {
          id: 'req-batch-1',
          platform: 'telegram',
          platform_user_id: '111',
          platform_user_name: 'maria',
          type: 'dedication',
          content: 'Keep shining',
          target: 'Team',
          batch_id: 'BATCH-16:00',
          status: 'scheduled',
        },
        {
          id: 'req-batch-2',
          platform: 'discord',
          platform_user_id: '222',
          platform_user_name: 'alex',
          type: 'weather',
          content: 'Tokyo',
          target: 'Tokyo',
          batch_id: 'BATCH-16:00',
          status: 'pending',
        },
        {
          id: 'req-batch-3',
          platform: 'web',
          platform_user_id: '333',
          platform_user_name: 'astrologer',
          type: 'zodiac',
          content: 'Gemini',
          target: 'Gemini',
          batch_id: 'BATCH-16:00',
          status: 'scheduled',
        },
        {
          id: 'req-batch-4',
          platform: 'discord',
          platform_user_id: '444',
          platform_user_name: 'groover',
          type: 'shoutout',
          content: 'Loving the live beats',
          batch_id: 'BATCH-16:00',
          status: 'scheduled',
        }
      );

      const result = await synthesizeBatchAnnouncement('BATCH-16:00');
      expect(result.count).toBe(4);
      expect(result.audioUrl).toBe('https://example.com/batch-announcement.mp3');

      expect(createBroadcastDrop).toHaveBeenCalledWith({
        type: 'custom_prompt',
        topicOrText: 'Here are this hour\'s community listener shoutouts from Telegram & Discord: [@maria dedicates: "Keep shining" to Team; @alex asks for weather in Tokyo; @astrologer requests horoscope for Gemini; @groover: "Loving the live beats"].\nDeliver them warmly together in ONE single seamless radio host announcement. Keep it upbeat, fun, and concise (under 45 words). No brackets.',
        dj: expect.any(Object),
      });

      expect(broadcastToCommunity).toHaveBeenCalledWith({
        title: 'ON AIR NOW: Community Batch Shoutout (BATCH-16:00)',
        message: '🎙️ "Consolidated radio announcement"\n\nFeaturing shoutouts from: @maria, @alex, @astrologer, @groover\nTune in: https://promptfm.live',
        category: 'dedication',
        author: 'DJ Neon',
      });

      // Verify all 4 marked aired
      const aired = mockRequestsTable.filter((r) => r.status === 'aired');
      expect(aired.length).toBe(4);
    });

    it('synthesizes batch announcement when items omit target', async () => {
      mockRequestsTable.push(
        {
          id: 'req-b-1',
          platform: 'telegram',
          platform_user_id: '11',
          platform_user_name: 't1',
          type: 'dedication',
          content: 'Keep jamming',
          target: null,
          batch_id: 'BATCH-18:00',
          status: 'scheduled',
        },
        {
          id: 'req-b-2',
          platform: 'discord',
          platform_user_id: '22',
          platform_user_name: 't2',
          type: 'weather',
          content: 'Madrid',
          target: null,
          batch_id: 'BATCH-18:00',
          status: 'scheduled',
        },
        {
          id: 'req-b-3',
          platform: 'web',
          platform_user_id: '33',
          platform_user_name: 't3',
          type: 'zodiac',
          content: 'Virgo',
          target: null,
          batch_id: 'BATCH-18:00',
          status: 'scheduled',
        }
      );

      const result = await synthesizeBatchAnnouncement('BATCH-18:00');
      expect(result.count).toBe(3);
      expect(createBroadcastDrop).toHaveBeenCalledWith({
        type: 'custom_prompt',
        topicOrText: 'Here are this hour\'s community listener shoutouts from Telegram & Discord: [@t1 dedicates: "Keep jamming" to friends; @t2 asks for weather in Madrid; @t3 requests horoscope for Virgo].\nDeliver them warmly together in ONE single seamless radio host announcement. Keep it upbeat, fun, and concise (under 45 words). No brackets.',
        dj: expect.any(Object),
      });
    });

    it('returns empty result if batch has no scheduled items', async () => {
      const result = await synthesizeBatchAnnouncement('BATCH-EMPTY');
      expect(result.count).toBe(0);
      expect(result.audioUrl).toBe('');
      expect(result.script).toBe('');
    });
  });
});
