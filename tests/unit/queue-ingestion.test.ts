// tests/unit/queue-ingestion.test.ts
// Unit tests for PromptFM Queue Song Ingestion & Airplay Engine (Issue #276)
// Verifies track resolution, channel_queue insert without invalid priority column,
// direct PostgreSQL failover, and queue airplay promotion across rotation engine.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  insertChannelQueueDirect,
  fetchPendingChannelQueueDirect,
  markChannelQueueItemPlayedDirect,
  fetchTrackByIdOrTitleDirect,
  type MinimalPgClient,
} from '@/lib/dj/direct-track-queries';
import { queueSong, getSongQueueStatus } from '@/lib/song/pathway';
import { getUpNext, getNextAirplayItem } from '@/lib/dj/rotation';
import { getStationQueue, formatQueueForCLI } from '@/lib/dj/queue';

describe('Queue Song Ingestion & Failover Protocol (Issue #276)', () => {
  describe('Direct PostgreSQL Channel Queue Queries', () => {
    it('insertChannelQueueDirect inserts without invalid priority column', async () => {
      let executedSql = '';
      let executedParams: any[] = [];

      const mockClient: MinimalPgClient = {
        query: vi.fn(async (sql: string, params?: any[]) => {
          executedSql = sql;
          executedParams = params || [];
          return {
            rows: [
              {
                id: 'queue-uuid-1',
                channel_id: 'channel-uuid-1',
                track_id: 'track-uuid-1',
                prompt_used: 'cyberpunk beats',
                requested_by: '@Listener (web)',
                created_at: new Date().toISOString(),
              },
            ],
          };
        }),
        end: vi.fn(async () => {}),
      };

      const result = await insertChannelQueueDirect({
        channelSlug: 'main',
        trackId: 'track-uuid-1',
        promptUsed: 'cyberpunk beats',
        requestedBy: '@Listener (web)',
        client: mockClient,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('queue-uuid-1');
      // Must NOT include priority in insert columns because priority does not exist in schema
      expect(executedSql).not.toMatch(/\bpriority\b/i);
      expect(executedParams).toContain('track-uuid-1');
      expect(executedParams).toContain('cyberpunk beats');
      expect(executedParams).toContain('@Listener (web)');
    });

    it('fetchPendingChannelQueueDirect queries unplayed items joined with tracks', async () => {
      let executedSql = '';
      let executedParams: any[] = [];

      const mockClient: MinimalPgClient = {
        query: vi.fn(async (sql: string, params?: any[]) => {
          executedSql = sql;
          executedParams = params || [];
          return {
            rows: [
              {
                queue_id: 'q-1',
                channel_id: 'c-main',
                track_id: 't-1',
                prompt_used: 'synthwave sunrise',
                requested_by: '@Nova (discord)',
                created_at: '2026-11-21T10:00:00.000Z',
                title: 'Neon Sunrise',
                artist_name: 'Vector',
                audio_url: 'https://cdn.promptfm.live/neon.mp3',
                tool_used: 'Suno',
                upvotes_count: 42,
                cover_art_url: '/covers/neon.png',
                category: 'Synthwave & Electro',
                is_explicit: false,
                family_friendly: true,
              },
            ],
          };
        }),
        end: vi.fn(async () => {}),
      };

      const items = await fetchPendingChannelQueueDirect({
        channelSlug: 'main',
        limit: 5,
        client: mockClient,
      });

      expect(items).toHaveLength(1);
      expect(items[0]!.queue_id).toBe('q-1');
      expect(items[0]!.title).toBe('Neon Sunrise');
      expect(items[0]!.artist_name).toBe('Vector');
      expect(executedSql).toContain('FROM public.channel_queue');
      expect(executedSql).toContain('JOIN public.tracks');
      expect(executedSql).toContain('played_at IS NULL');
      expect(executedParams).toContain('main');
      expect(executedParams).toContain(5);
    });

    it('markChannelQueueItemPlayedDirect updates played_at timestamp', async () => {
      let executedSql = '';
      let executedParams: any[] = [];

      const mockClient: MinimalPgClient = {
        query: vi.fn(async (sql: string, params?: any[]) => {
          executedSql = sql;
          executedParams = params || [];
          return { rows: [{ id: 'q-1', played_at: new Date().toISOString() }] };
        }),
        end: vi.fn(async () => {}),
      };

      const res = await markChannelQueueItemPlayedDirect({
        queueId: 'q-1',
        client: mockClient,
      });

      expect(res).toBe(true);
      expect(executedSql).toContain('UPDATE public.channel_queue');
      expect(executedSql).toContain('played_at =');
      expect(executedParams).toEqual(['q-1']);
    });
  });

  describe('Unified Song Pathway Track Resolution & Queue Ingestion', () => {
    it('queueSong resolves track by trackId via direct PostgreSQL failover when Supabase fails', async () => {
      const mockDirectTrack = {
        id: 'track-library-123',
        title: 'Deep Focus Chill',
        artist_name: 'Echoform',
        audio_url: 'https://cdn.promptfm.live/echoform.mp3',
        tool_used: 'Udio',
        upvotes_count: 88,
        cover_art_url: '/covers/focus.png',
        category: 'Lofi Ambient',
      };

      const fetchTrackSpy = vi.spyOn(await import('@/lib/dj/direct-track-queries'), 'fetchTrackByIdOrTitleDirect')
        .mockResolvedValueOnce(mockDirectTrack as any);

      vi.spyOn(await import('@/lib/dj/direct-track-queries'), 'insertChannelQueueDirect')
        .mockResolvedValueOnce({
          id: 'q-lib-1',
          channel_id: 'channel-main',
          track_id: mockDirectTrack.id,
          prompt_used: mockDirectTrack.title,
          requested_by: '@Listener (web)',
          created_at: new Date().toISOString(),
        });

      // Force Supabase to return error on tracks table
      const supabaseModule = await import('@/lib/supabase/server');
      vi.spyOn(supabaseModule, 'createAdminClient').mockReturnValue({
        from: (table: string) => {
          if (table === 'tracks') {
            const errRes = { data: null, error: { message: 'Supabase REST offline', code: '503' } };
            const b: any = {
              select: () => b,
              eq: () => b,
              ilike: () => b,
              order: () => b,
              limit: () => b,
              maybeSingle: async () => errRes,
              single: async () => errRes,
            };
            return b;
          }
          if (table === 'channel_queue') {
            const errRes = { data: null, error: { message: 'Supabase REST offline', code: '503' } };
            const b: any = {
              select: () => b,
              eq: () => b,
              is: () => b,
              order: () => b,
              limit: () => b,
              insert: () => b,
              maybeSingle: async () => errRes,
              single: async () => errRes,
              then: (resolve: any) => resolve(errRes),
            };
            return b;
          }
          if (table === 'community_requests') {
            const succRes = { data: { id: 'req-1' }, error: null };
            const b: any = {
              insert: () => b,
              select: () => ({ single: async () => succRes }),
              then: (resolve: any) => resolve(succRes),
            };
            return b;
          }
          const okRes = { data: { id: 'channel-main', slug: 'main' }, error: null };
          const b: any = {
            select: () => b,
            eq: () => b,
            maybeSingle: async () => okRes,
            single: async () => okRes,
          };
          return b;
        },
      } as any);

      const result = await queueSong({
        trackId: 'track-library-123',
        source: 'web',
        requestedBy: 'Web Listener',
      });

      expect(result.status).toBe('queued');
      expect(result.track?.id).toBe('track-library-123');
      expect(result.track?.title).toBe('Deep Focus Chill');
      expect(result.confirmationMessage).toContain('Deep Focus Chill');
      expect(fetchTrackSpy).toHaveBeenCalledWith({ id: 'track-library-123' });
    });

    it('getSongQueueStatus retrieves queued items via direct PostgreSQL when Supabase fails', async () => {
      const mockPendingItems = [
        {
          queue_id: 'q-status-1',
          channel_id: 'c-main',
          track_id: 't-status-1',
          prompt_used: 'lofi study',
          requested_by: '@Student (web)',
          created_at: '2026-11-21T11:00:00.000Z',
          title: 'Rainy Window',
          artist_name: 'ChillBot',
          audio_url: 'https://cdn.promptfm.live/rain.mp3',
          tool_used: 'Suno',
          upvotes_count: 50,
          cover_art_url: '/covers/rain.png',
          category: 'Lofi Ambient',
          is_explicit: false,
          family_friendly: true,
        },
      ];

      const fetchPendingSpy = vi.spyOn(await import('@/lib/dj/direct-track-queries'), 'fetchPendingChannelQueueDirect')
        .mockResolvedValueOnce(mockPendingItems);

      const supabaseModule = await import('@/lib/supabase/server');
      vi.spyOn(supabaseModule, 'createAdminClient').mockReturnValue({
        from: (table: string) => {
          const errRes = { data: null, error: { message: 'Supabase offline' } };
          const b: any = {
            select: () => b,
            eq: () => b,
            is: () => b,
            order: () => b,
            limit: () => b,
            maybeSingle: async () => errRes,
            single: async () => errRes,
            then: (resolve: any) => resolve(errRes),
          };
          return b;
        },
      } as any);

      const status = await getSongQueueStatus('main');

      expect(status.channelSlug).toBe('main');
      expect(status.totalQueued).toBe(1);
      expect(status.items).toHaveLength(1);
      expect(status.items[0]!.queueId).toBe('q-status-1');
      expect(status.items[0]!.track?.title).toBe('Rainy Window');
      expect(fetchPendingSpy).toHaveBeenCalledWith({ channelSlug: 'main', limit: 50 });
      expect(status.items[0]!.position).toBe(1);
      expect(status.items[0]!.eta.formattedETA).toContain('Up Next');
    });
  });

  describe('Rotation Engine Queue Airplay & Visibility (Issue #276)', () => {
    it('getUpNext includes queued items from channel_queue', async () => {
      const mockQueueItems = [
        {
          id: 'q-upnext-1',
          channel_id: 'c-main',
          track_id: 't-upnext-1',
          prompt_used: 'cyber dream',
          requested_by: '@Neo (discord)',
          created_at: '2026-11-21T12:00:00.000Z',
          track: {
            id: 't-upnext-1',
            title: 'Matrix Dream',
            artist_name: 'Cipher',
            audio_url: 'https://cdn.promptfm.live/matrix.mp3',
            tool_used: 'Udio',
            upvotes_count: 75,
            cover_art_url: '/covers/matrix.png',
            category: 'Synthwave & Electro',
            is_explicit: false,
            family_friendly: true,
          },
        },
      ];

      const supabaseModule = await import('@/lib/supabase/server');
      vi.spyOn(supabaseModule, 'createAdminClient').mockReturnValue({
        from: (table: string) => {
          if (table === 'channels') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: 'c-main', slug: 'main' }, error: null }),
                }),
              }),
            };
          }
          if (table === 'channel_queue') {
            return {
              select: () => ({
                eq: () => ({
                  is: () => ({
                    order: () => ({
                      limit: () => Promise.resolve({ data: mockQueueItems, error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'station_state') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            };
          }
          const nullRes = { data: null, error: null };
          const b: any = {
            select: () => b,
            eq: () => b,
            is: () => b,
            order: () => b,
            limit: () => b,
            maybeSingle: async () => nullRes,
            single: async () => nullRes,
            then: (resolve: any) => resolve(nullRes),
          };
          return b;
        },
      } as any);

      const upNext = await getUpNext('main', 5);

      expect(upNext.length).toBeGreaterThanOrEqual(1);
      const queuedItem = upNext.find((item) => item.id === 't-upnext-1');
      expect(queuedItem).toBeDefined();
      expect(queuedItem?.title).toBe('Matrix Dream');
      expect(queuedItem?.requested_by).toBe('@Neo (discord)');
      expect(queuedItem?.queue_id).toBe('q-upnext-1');
      expect(queuedItem?.queue_position).toBeDefined();
      expect(queuedItem?.estimated_air_time).toBeDefined();
    });

    it('getNextAirplayItem plays queued track from channel_queue and marks it played', async () => {
      const mockQueueItems = [
        {
          id: 'q-airplay-1',
          channel_id: 'c-main',
          track_id: 't-airplay-1',
          prompt_used: 'future funk groove',
          requested_by: '@Groover (telegram)',
          created_at: '2026-11-21T12:30:00.000Z',
          track: {
            id: 't-airplay-1',
            title: 'Future Funk Odyssey',
            artist_name: 'GrooveBot',
            audio_url: 'https://cdn.promptfm.live/funk.mp3',
            tool_used: 'Suno',
            upvotes_count: 99,
            cover_art_url: '/covers/funk.png',
            category: 'Synthwave & Electro',
            is_explicit: false,
            family_friendly: true,
          },
        },
      ];

      let markedPlayedQueueId: string | null = null;

      const supabaseModule = await import('@/lib/supabase/server');
      vi.spyOn(supabaseModule, 'createAdminClient').mockReturnValue({
        from: (table: string) => {
          if (table === 'channels') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: 'c-main', slug: 'main' }, error: null }),
                }),
              }),
            };
          }
          if (table === 'channel_queue') {
            return {
              select: () => ({
                eq: () => ({
                  is: () => ({
                    order: () => ({
                      limit: () => Promise.resolve({ data: mockQueueItems, error: null }),
                    }),
                  }),
                }),
              }),
              update: (payload: any) => ({
                eq: (_col: string, val: string) => {
                  if (payload.played_at) {
                    markedPlayedQueueId = val;
                  }
                  return Promise.resolve({ data: null, error: null });
                },
              }),
            };
          }
          if (table === 'station_state') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
              upsert: async () => ({ error: null }),
              update: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          }
          if (table === 'play_history') {
            return {
              insert: async () => ({ error: null }),
            };
          }
          const nullRes = { data: null, error: null };
          const b: any = {
            select: () => b,
            eq: () => b,
            is: () => b,
            order: () => b,
            limit: () => b,
            maybeSingle: async () => nullRes,
            single: async () => nullRes,
            then: (resolve: any) => resolve(nullRes),
          };
          return b;
        },
      } as any);

      const airplayItem = await getNextAirplayItem('main', true);

      expect(airplayItem.id).toBe('t-airplay-1');
      expect(airplayItem.title).toBe('Future Funk Odyssey');
      expect(airplayItem.requested_by).toBe('@Groover (telegram)');
      expect(markedPlayedQueueId).toBe('q-airplay-1');
    });

    it('formatQueueForCLI formats station queue displaying queued tracks', () => {
      const stationQueue = {
        channel: 'main',
        hasItems: true,
        upcoming: [
          {
            id: 't-cli-1',
            type: 'music' as const,
            title: 'Electric Starlight',
            artist: 'StarDust',
            audio_url: 'https://cdn.promptfm.live/star.mp3',
            requested_by: '@Listener (discord)',
            upvotes_count: 15,
            queue_position: 1,
            estimated_air_time: '14:45 UTC',
          },
        ],
        scheduledRequests: [],
      };

      const formatted = formatQueueForCLI(stationQueue);
      expect(formatted).toContain('Electric Starlight');
      expect(formatted).toContain('StarDust');
      expect(formatted).toContain('@Listener (discord)');
    });
  });
});
