// tests/unit/main-stage-rotation.test.ts
// Unit tests for Issue #41:
// 1. Main stage everyday rotation pulls from full approved songs with anti-repeat logic.
// 2. Top 20 and Top 40 are only used for explicit scheduled shows and play in order.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getNextAirplayItem,
  getRecentlyPlayed,
  clearRecentlyPlayed,
  getCountdownPosition,
  resetCountdownPosition,
  resolveCountdownConfig,
} from '@/lib/dj/rotation';
import * as scheduleService from '@/lib/radio/schedule';
import { OFFICIAL_CHANNELS } from '@/lib/radio/channels';
import { getDJById } from '@/lib/dj/roster';

// Helper to generate N mock tracks
function createMockTracks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `track-${i + 1}`,
    title: `Song ${i + 1}`,
    artist_name: `Artist ${i + 1}`,
    audio_url: `https://cdn.example.com/track-${i + 1}.mp3`,
    tool_used: 'Suno',
    upvotes_count: (count - i) * 10, // track-1 has highest, track-count has lowest
    status: 'approved',
    is_explicit: false,
    family_friendly: true,
  }));
}

let mockTracksDb: any[] = [];
let lastQueryLimit: number | null = null;

vi.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === 'channels') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 'channel-main', slug: 'main' },
                  error: null,
                }),
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
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
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
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        if (table === 'tracks') {
          return {
            select: (cols: string) => {
              if (
                !cols ||
                !cols.includes('id') ||
                !cols.includes('title') ||
                !cols.includes('artist_name') ||
                !cols.includes('upvotes_count')
              ) {
                return {
                  eq: () => ({
                    order: () => ({
                      limit: () => Promise.resolve({ data: null, error: null }),
                      then: (r: any) => r({ data: null, error: null }),
                    }),
                  }),
                };
              }
              return {
                eq: (field: string, value: string) => {
                  if (field !== 'status' || value !== 'approved') {
                    return {
                      order: () => ({
                        limit: () => Promise.resolve({ data: null, error: null }),
                        then: (r: any) => r({ data: null, error: null }),
                      }),
                    };
                  }
                  return {
                    order: (col: string, opts: { ascending: boolean }) => {
                      if (col !== 'upvotes_count' || opts.ascending !== false) {
                        return {
                          limit: () => Promise.resolve({ data: null, error: null }),
                          then: (r: any) => r({ data: null, error: null }),
                        };
                      }
                      return {
                        limit: (num: number) => {
                          lastQueryLimit = num;
                          return Promise.resolve({
                            data: mockTracksDb.slice(0, num),
                            error: null,
                          });
                        },
                        then: (resolve: any) => {
                          lastQueryLimit = null;
                          return resolve({
                            data: mockTracksDb,
                            error: null,
                          });
                        },
                      };
                    },
                  };
                },
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

vi.mock('@/lib/chat/bridge', () => ({
  broadcastToCommunity: vi.fn().mockResolvedValue({ discord: true, telegram: true }),
}));

vi.mock('@/lib/dj/engine', () => ({
  createBroadcastDrop: vi.fn(),
  fetchLiveHeadlines: vi.fn(),
}));

describe('Main Stage Rotation & Scheduled Countdown Shows (#41)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRecentlyPlayed();
    resetCountdownPosition();
    lastQueryLimit = null;
    mockTracksDb = createMockTracks(60); // 60 approved tracks
  });

  describe('Everyday Rotation (No Countdown Show Active)', () => {
    beforeEach(() => {
      const djNeon = getDJById('dj_neon');
      vi.spyOn(scheduleService, 'getStationSchedule').mockReturnValue({
        channel: OFFICIAL_CHANNELS[0]!,
        current_show: {
          id: 'main-morning-beats',
          time_utc: '06:00 - 10:00 UTC',
          start_hour_utc: 6,
          end_hour_utc: 10,
          show: 'Morning Beats & Sunrise Synth',
          dj: djNeon,
          genre: 'Upbeat Electro',
          ai_tools: ['Suno'],
          dj_prompt_style: 'High morning energy',
          is_live: true,
          clock_milestones: [
            {
              minute: 0,
              title: 'Community Headliners & Vault Rotation',
              type: 'music',
              icon: 'Radio',
              description: 'Everyday rotation across the catalog',
            },
          ],
        },
        upcoming_shows: [],
        blocks: [],
        generated_at_utc: new Date().toISOString(),
      });
    });

    it('does not limit track selection pool to 40 in everyday rotation', async () => {
      const item = await getNextAirplayItem('main', false);
      expect(item.type).toBe('music');

      // Query limit should NOT be 40. It should either be unbounded or high capacity (e.g. >= 200)
      if (lastQueryLimit !== null) {
        expect(lastQueryLimit).toBeGreaterThanOrEqual(100);
      }
    });

    it('can select songs from beyond rank 40 so the broader catalog is not starved', async () => {
      // Pick multiple songs and verify tracks beyond the top 40 can be chosen
      // In our mock, tracks 41 to 60 represent the broader catalog
      const pickedIds = new Set<string>();

      // With anti-repeat, successive picks will explore different parts of the library
      for (let i = 0; i < 45; i++) {
        const item = await getNextAirplayItem('main', true);
        pickedIds.add(item.id);
      }

      const hasTracksBeyondTop40 = Array.from(pickedIds).some((id) => {
        const num = parseInt(id.replace('track-', ''), 10);
        return num > 40;
      });

      expect(hasTracksBeyondTop40).toBe(true);
    });

    it('applies anti-repeat logic so recently played tracks are not immediately repeated', async () => {
      const firstItem = await getNextAirplayItem('main', true);
      const recentAfterFirst = getRecentlyPlayed('main');
      expect(recentAfterFirst).toContain(firstItem.id);

      const secondItem = await getNextAirplayItem('main', true);
      expect(secondItem.id).not.toBe(firstItem.id);

      const recentAfterSecond = getRecentlyPlayed('main');
      expect(recentAfterSecond).toContain(secondItem.id);
    });

    it('falls back to candidate pool excluding currently playing track when all tracks are in recent history', async () => {
      // Library with only 2 tracks
      mockTracksDb = createMockTracks(2);

      // Play 1st track
      const item1 = await getNextAirplayItem('main', true);
      expect(['track-1', 'track-2']).toContain(item1.id);

      // Play 2nd track (must not repeat item1)
      const item2 = await getNextAirplayItem('main', true);
      expect(item2.id).not.toBe(item1.id);

      // Both tracks are now in recent history; 3rd track should still succeed by picking unplayed / non-current
      const item3 = await getNextAirplayItem('main', true);
      expect(['track-1', 'track-2']).toContain(item3.id);
      expect(item3.id).not.toBe(item2.id); // Must not repeat currently playing item2
    });

    it('falls back to /logo-mark.png when track has no custom cover art', async () => {
      mockTracksDb = [
        {
          id: 'track-nocover',
          title: 'No Cover Song',
          artist_name: 'Artist X',
          audio_url: 'https://cdn.example.com/nocover.mp3',
          upvotes_count: 50,
          status: 'approved',
          cover_art_url: undefined,
        },
      ];

      const item = await getNextAirplayItem('main', true);
      expect(item.id).toBe('track-nocover');
      expect(item.cover_art_url).toBe('/logo-mark.png');
    });

    it('manages channel-specific clearRecentlyPlayed and resetCountdownPosition', async () => {
      // Test default parameter 'main'
      expect(getRecentlyPlayed()).toBeDefined();
      expect(getCountdownPosition()).toBe(0);

      // Play on main and on cyberpunk to populate recent history
      await getNextAirplayItem('main', true);
      await getNextAirplayItem('cyberpunk', true);

      expect(getRecentlyPlayed('main').length).toBeGreaterThan(0);
      expect(getRecentlyPlayed('cyberpunk').length).toBeGreaterThan(0);

      // Clear main only
      clearRecentlyPlayed('main');
      expect(getRecentlyPlayed('main')).toEqual([]);
      expect(getRecentlyPlayed('cyberpunk').length).toBeGreaterThan(0);

      // Clear all
      clearRecentlyPlayed();
      expect(getRecentlyPlayed('cyberpunk')).toEqual([]);

      // Countdown positions: advance main
      resetCountdownPosition();
      expect(getCountdownPosition('main')).toBe(0);
      expect(getCountdownPosition('cyberpunk')).toBe(0);

      // Clear specific channel position
      resetCountdownPosition('main');
      expect(getCountdownPosition('main')).toBe(0);
    });

    it('falls back to all tracks when library has only 1 track and it is currently playing', async () => {
      // 1-track library
      mockTracksDb = createMockTracks(1);

      // Play 1st time
      const item1 = await getNextAirplayItem('main', true);
      expect(item1.id).toBe('track-1');

      // Play 2nd time: candidates.length is 0, tracks.filter is 0, falls back to tracks
      const item2 = await getNextAirplayItem('main', true);
      expect(item2.id).toBe('track-1');
    });

    it('deduplicates track in recent history when re-picked', async () => {
      // 10-track library -> maxHistory is 5
      mockTracksDb = createMockTracks(10);

      // Play tracks sequentially
      const played: string[] = [];
      for (let i = 0; i < 6; i++) {
        const item = await getNextAirplayItem('main', true);
        played.push(item.id);
      }

      const recentsBefore = getRecentlyPlayed('main');
      expect(recentsBefore.length).toBe(5);

      // Pick the oldest item in recents to re-play
      const oldestInHistory = recentsBefore[0]!;
      // Force candidates to pick oldestInHistory
      const targetTrack = mockTracksDb.find((t) => t.id === oldestInHistory)!;
      // Put targetTrack as the first available candidate
      mockTracksDb = [
        targetTrack,
        ...mockTracksDb.filter((t) => t.id !== oldestInHistory),
      ];

      // Simulate a pick of targetTrack
      // Clear current playing to allow targetTrack
      clearRecentlyPlayed('main');
      // Set recent to 4 other items + targetTrack
      for (let i = 1; i <= 5; i++) {
        await getNextAirplayItem('main', true);
      }
      const recents = getRecentlyPlayed('main');
      expect(recents.length).toBe(5);
      const uniqueCount = new Set(recents).size;
      expect(uniqueCount).toBe(5);
    });
  });

  describe('Scheduled Countdown Shows (Top 20 and Top 40 In Order)', () => {
    it('resolves countdown config correctly from show attributes or show title', () => {
      const djVance = getDJById('dj_vance');

      // 1. Explicit properties
      const explicitTop20 = resolveCountdownConfig({
        id: 'c-20',
        time_utc: '18:00 - 19:00 UTC',
        start_hour_utc: 18,
        end_hour_utc: 19,
        show: 'Weekly Chart Show',
        dj: djVance,
        genre: 'Top Hits',
        ai_tools: ['Suno'],
        dj_prompt_style: 'Smooth',
        is_live: true,
        clock_milestones: [],
        is_countdown: true,
        countdown_size: 20,
        countdown_order: 'desc',
      });
      expect(explicitTop20.isCountdown).toBe(true);
      expect(explicitTop20.size).toBe(20);
      expect(explicitTop20.order).toBe('desc');

      // 1b. Explicit countdown with default order
      const explicitDefaultOrder = resolveCountdownConfig({
        id: 'c-20-def',
        time_utc: '18:00 - 19:00 UTC',
        start_hour_utc: 18,
        end_hour_utc: 19,
        show: 'Top 20 Countdown',
        dj: djVance,
        genre: 'Top Hits',
        ai_tools: ['Suno'],
        dj_prompt_style: 'Smooth',
        is_live: true,
        clock_milestones: [],
        is_countdown: true,
        countdown_size: 20,
      });
      expect(explicitDefaultOrder.order).toBe('desc');

      // 2. Inferred from show title 'Weekly Top 20 Countdown'
      const titleTop20 = resolveCountdownConfig({
        id: 'c-20-title',
        time_utc: '18:00 - 19:00 UTC',
        start_hour_utc: 18,
        end_hour_utc: 19,
        show: 'The Official Weekly Top 20 Countdown',
        dj: djVance,
        genre: 'Top Hits',
        ai_tools: ['Suno'],
        dj_prompt_style: 'Smooth',
        is_live: true,
        clock_milestones: [],
      });
      expect(titleTop20.isCountdown).toBe(true);
      expect(titleTop20.size).toBe(20);
      expect(titleTop20.order).toBe('desc');

      // 3. Inferred from show title 'Weekly Top 40 Countdown'
      const titleTop40 = resolveCountdownConfig({
        id: 'c-40-title',
        time_utc: '18:00 - 20:00 UTC',
        start_hour_utc: 18,
        end_hour_utc: 20,
        show: 'PromptFM Weekly Top 40 Countdown Show',
        dj: djVance,
        genre: 'Top Hits',
        ai_tools: ['Suno'],
        dj_prompt_style: 'Smooth',
        is_live: true,
        clock_milestones: [],
      });
      expect(titleTop40.isCountdown).toBe(true);
      expect(titleTop40.size).toBe(40);
      expect(titleTop40.order).toBe('desc');

      // 3b. Inferred without 'countdown' in title -> defaults to asc
      const nonCountdownTop40 = resolveCountdownConfig({
        id: 'c-40-asc',
        time_utc: '18:00 - 20:00 UTC',
        start_hour_utc: 18,
        end_hour_utc: 20,
        show: 'Top 40 Power',
        dj: djVance,
        genre: 'Top Hits',
        ai_tools: ['Suno'],
        dj_prompt_style: 'Smooth',
        is_live: true,
        clock_milestones: [],
      });
      expect(nonCountdownTop40.isCountdown).toBe(true);
      expect(nonCountdownTop40.size).toBe(40);
      expect(nonCountdownTop40.order).toBe('asc');

      const nonCountdownTop20 = resolveCountdownConfig({
        id: 'c-20-asc',
        time_utc: '18:00 - 19:00 UTC',
        start_hour_utc: 18,
        end_hour_utc: 19,
        show: 'Weekly Top 20',
        dj: djVance,
        genre: 'Top Hits',
        ai_tools: ['Suno'],
        dj_prompt_style: 'Smooth',
        is_live: true,
        clock_milestones: [],
      });
      expect(nonCountdownTop20.isCountdown).toBe(true);
      expect(nonCountdownTop20.size).toBe(20);
      expect(nonCountdownTop20.order).toBe('asc');

      // 4. Inferred from active milestones
      const milestoneTop40 = resolveCountdownConfig(
        {
          id: 'show-with-milestone',
          time_utc: '18:00 - 19:00 UTC',
          start_hour_utc: 18,
          end_hour_utc: 19,
          show: 'Evening Block',
          dj: djVance,
          genre: 'Hits',
          ai_tools: ['Suno'],
          dj_prompt_style: 'Smooth',
          is_live: true,
          clock_milestones: [],
        },
        [
          {
            minute: 0,
            title: 'Top 40 Countdown Show',
            type: 'music',
            icon: 'Radio',
            description: 'Top 40',
          },
        ]
      );
      expect(milestoneTop40.isCountdown).toBe(true);
      expect(milestoneTop40.size).toBe(40);

      const milestoneTop20 = resolveCountdownConfig(
        {
          id: 'show-with-milestone-20',
          time_utc: '18:00 - 19:00 UTC',
          start_hour_utc: 18,
          end_hour_utc: 19,
          show: 'Evening Block',
          dj: djVance,
          genre: 'Hits',
          ai_tools: ['Suno'],
          dj_prompt_style: 'Smooth',
          is_live: true,
          clock_milestones: [],
        },
        [
          {
            minute: 0,
            title: 'Top 20 Countdown Show',
            type: 'music',
            icon: 'Radio',
            description: 'Top 20',
          },
        ]
      );
      expect(milestoneTop20.isCountdown).toBe(true);
      expect(milestoneTop20.size).toBe(20);

      // 5. Regular show is NOT a countdown
      const regularShow = resolveCountdownConfig({
        id: 'morning',
        time_utc: '06:00 - 10:00 UTC',
        start_hour_utc: 6,
        end_hour_utc: 10,
        show: 'Morning Beats & Sunrise Synth',
        dj: djVance,
        genre: 'Synth',
        ai_tools: ['Suno'],
        dj_prompt_style: 'Energy',
        is_live: true,
        clock_milestones: [],
      });
      expect(regularShow.isCountdown).toBe(false);
    });

    it('plays Top 20 countdown show tracks strictly in order', async () => {
      const djVance = getDJById('dj_vance');
      vi.spyOn(scheduleService, 'getStationSchedule').mockReturnValue({
        channel: OFFICIAL_CHANNELS[0]!,
        current_show: {
          id: 'main-top-20',
          time_utc: '18:00 - 19:00 UTC',
          start_hour_utc: 18,
          end_hour_utc: 19,
          show: 'The Weekly Top 20 Countdown',
          dj: djVance,
          genre: 'Chart Hits',
          ai_tools: ['All'],
          dj_prompt_style: 'Velvet radio host',
          is_live: true,
          clock_milestones: [],
          is_countdown: true,
          countdown_size: 20,
          countdown_order: 'desc', // countdown counts from #20 down to #1
        },
        upcoming_shows: [],
        blocks: [],
        generated_at_utc: new Date().toISOString(),
      });

      // The top 20 tracks in DB are track-1 (#1) down to track-20 (#20)
      // When counting down in order ('desc'):
      // 1st play: track-20 (#20)
      // 2nd play: track-19 (#19)
      // 3rd play: track-18 (#18)
      // ...
      // 20th play: track-1 (#1)

      const playedSequence: string[] = [];
      for (let i = 0; i < 20; i++) {
        const item = await getNextAirplayItem('main', true);
        playedSequence.push(item.id);
        expect(getCountdownPosition('main')).toBe((i + 1) % 20);
      }

      expect(playedSequence[0]).toBe('track-20');
      expect(playedSequence[1]).toBe('track-19');
      expect(playedSequence[18]).toBe('track-2');
      expect(playedSequence[19]).toBe('track-1'); // The #1 song finishes the countdown!

      // Loops sequentially back to beginning of countdown
      const nextCycleItem = await getNextAirplayItem('main', true);
      expect(nextCycleItem.id).toBe('track-20');
    });

    it('plays Top 40 countdown show tracks strictly in order', async () => {
      const djVance = getDJById('dj_vance');
      vi.spyOn(scheduleService, 'getStationSchedule').mockReturnValue({
        channel: OFFICIAL_CHANNELS[0]!,
        current_show: {
          id: 'main-top-40',
          time_utc: '18:00 - 20:00 UTC',
          start_hour_utc: 18,
          end_hour_utc: 20,
          show: 'Weekly Top 40 Countdown',
          dj: djVance,
          genre: 'Chart Hits',
          ai_tools: ['All'],
          dj_prompt_style: 'Classic host',
          is_live: true,
          clock_milestones: [],
          is_countdown: true,
          countdown_size: 40,
          countdown_order: 'desc',
        },
        upcoming_shows: [],
        blocks: [],
        generated_at_utc: new Date().toISOString(),
      });

      const first = await getNextAirplayItem('main', true);
      expect(first.id).toBe('track-40'); // #40 plays first in Top 40 countdown

      const second = await getNextAirplayItem('main', true);
      expect(second.id).toBe('track-39');
    });

    it('supports ascending order (rank 1 to N) if explicitly configured', async () => {
      const djVance = getDJById('dj_vance');
      vi.spyOn(scheduleService, 'getStationSchedule').mockReturnValue({
        channel: OFFICIAL_CHANNELS[0]!,
        current_show: {
          id: 'main-top-20-asc',
          time_utc: '18:00 - 19:00 UTC',
          start_hour_utc: 18,
          end_hour_utc: 19,
          show: 'Top 20 In Order',
          dj: djVance,
          genre: 'Chart Hits',
          ai_tools: ['All'],
          dj_prompt_style: 'Classic host',
          is_live: true,
          clock_milestones: [],
          is_countdown: true,
          countdown_size: 20,
          countdown_order: 'asc', // rank 1 to 20
        },
        upcoming_shows: [],
        blocks: [],
        generated_at_utc: new Date().toISOString(),
      });

      const first = await getNextAirplayItem('main', true);
      expect(first.id).toBe('track-1'); // #1 plays first in ascending order

      const second = await getNextAirplayItem('main', true);
      expect(second.id).toBe('track-2');
    });
  });
});
