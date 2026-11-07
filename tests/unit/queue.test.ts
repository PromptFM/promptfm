// tests/unit/queue.test.ts
// Unit tests for PromptFM Unified Queue Service & Multi-Interface Formatters (Issue #86)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AirplayItem } from '@/lib/dj/rotation';

// Mock Supabase admin client
const mockSelect = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'community_requests') {
        return {
          select: mockSelect.mockReturnValue({
            in: mockIn.mockReturnValue({
              order: mockOrder.mockReturnValue({
                limit: mockLimit,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
      };
    }),
  })),
}));

// Mock rotation getUpNext
vi.mock('@/lib/dj/rotation', () => ({
  getUpNext: vi.fn(),
}));

import { getUpNext } from '@/lib/dj/rotation';
import {
  getStationQueue,
  getScheduledRequests,
  formatAirTime,
  formatStatus,
  formatQueueForDiscord,
  formatQueueForTelegram,
  formatQueueForCLI,
  type StationQueueResult,
  type ScheduledCommunityRequest,
} from '@/lib/dj/queue';

describe('PromptFM Unified Queue Service (Issue #86)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatAirTime helper', () => {
    it('returns TBD for null, undefined, or empty string', () => {
      expect(formatAirTime(null)).toBe('TBD');
      expect(formatAirTime(undefined)).toBe('TBD');
      expect(formatAirTime('')).toBe('TBD');
    });

    it('formats ISO 8601 strings into HH:MM UTC', () => {
      expect(formatAirTime('2026-11-07T12:05:00.000Z')).toBe('12:05 UTC');
      expect(formatAirTime('2026-11-07T08:30:00.000Z')).toBe('08:30 UTC');
    });

    it('returns original string if string has T but is invalid date', () => {
      expect(formatAirTime('T-invalid-timestamp')).toBe('T-invalid-timestamp');
    });

    it('returns original string if already formatted without T', () => {
      expect(formatAirTime('15:45 UTC')).toBe('15:45 UTC');
    });
  });

  describe('formatStatus helper', () => {
    it('returns Pending for null, undefined, or empty string', () => {
      expect(formatStatus(null)).toBe('Pending');
      expect(formatStatus(undefined)).toBe('Pending');
      expect(formatStatus('')).toBe('Pending');
    });

    it('capitalizes valid status strings', () => {
      expect(formatStatus('scheduled')).toBe('Scheduled');
      expect(formatStatus('SCHEDULED')).toBe('Scheduled');
      expect(formatStatus('pending')).toBe('Pending');
      expect(formatStatus('aired')).toBe('Aired');
      expect(formatStatus('rejected')).toBe('Rejected');
    });
  });

  describe('getScheduledRequests', () => {
    it('fetches scheduled and pending requests with custom limit', async () => {
      mockLimit.mockResolvedValue({
        data: [
          {
            id: 'r-1',
            type: 'song',
            content: 'ambient dream',
            status: 'scheduled',
          },
        ],
        error: null,
      });

      const res = await getScheduledRequests(8);
      expect(mockLimit).toHaveBeenCalledWith(8);
      expect(res).toHaveLength(1);
      expect(res[0]?.content).toBe('ambient dream');
    });

    it('handles database error by returning empty array', async () => {
      mockLimit.mockResolvedValue({ data: null, error: new Error('DB Error') });
      const res = await getScheduledRequests();
      expect(res).toEqual([]);
    });

    it('handles unexpected thrown exception gracefully', async () => {
      mockLimit.mockRejectedValue(new Error('Network crash'));
      const res = await getScheduledRequests();
      expect(res).toEqual([]);
    });
  });

  describe('getStationQueue', () => {
    it('retrieves both upcoming airplay tracks and scheduled community requests', async () => {
      const mockUpcomingTracks: AirplayItem[] = [
        {
          id: 'track-1',
          type: 'music',
          title: 'Cyber Dreams',
          artist: 'Neon Wave',
          audio_url: 'https://stream.promptfm.live/track1.mp3',
          upvotes_count: 12,
          tool_used: 'Suno v3.5',
        },
      ];

      const mockRequests: ScheduledCommunityRequest[] = [
        {
          id: 'req-1',
          platform: 'discord',
          platform_user_name: 'alex_listener',
          type: 'song',
          content: 'synthwave heavy bass',
          batch_id: 'BATCH-12:15',
          status: 'scheduled',
          estimated_air_time: '2026-11-07T12:15:00.000Z',
          created_at: '2026-11-07T12:00:00.000Z',
        },
        {
          id: 'req-2',
          platform: 'discord',
          platform_user_name: 'sara_radio',
          type: 'dedication',
          content: 'Keep pushing your dreams!',
          target: 'developers',
          batch_id: 'BATCH-12:30',
          status: 'scheduled',
          estimated_air_time: '2026-11-07T12:30:00.000Z',
          created_at: '2026-11-07T12:05:00.000Z',
        },
      ];

      vi.mocked(getUpNext).mockResolvedValue(mockUpcomingTracks);
      mockLimit.mockResolvedValue({ data: mockRequests, error: null });

      const queue = await getStationQueue({ channelSlug: 'main', upcomingLimit: 5, scheduledLimit: 5 });

      expect(getUpNext).toHaveBeenCalledWith('main', 5);
      expect(queue.channel).toBe('main');
      expect(queue.upcoming).toHaveLength(1);
      expect(queue.upcoming[0]?.title).toBe('Cyber Dreams');
      expect(queue.scheduledRequests).toHaveLength(2);
      expect(queue.scheduledRequests[0]?.content).toBe('synthwave heavy bass');
      expect(queue.hasItems).toBe(true);
    });

    it('supports custom channel and limit options', async () => {
      vi.mocked(getUpNext).mockResolvedValue([]);
      mockLimit.mockResolvedValue({ data: [], error: null });

      const queue = await getStationQueue({ channelSlug: 'cyberpunk', upcomingLimit: 3, scheduledLimit: 4 });

      expect(getUpNext).toHaveBeenCalledWith('cyberpunk', 3);
      expect(mockLimit).toHaveBeenCalledWith(4);
      expect(queue.channel).toBe('cyberpunk');
    });

    it('handles empty states gracefully when no tracks and no requests exist', async () => {
      vi.mocked(getUpNext).mockResolvedValue([]);
      mockLimit.mockResolvedValue({ data: [], error: null });

      const queue = await getStationQueue();

      expect(queue.channel).toBe('main');
      expect(queue.upcoming).toHaveLength(0);
      expect(queue.scheduledRequests).toHaveLength(0);
      expect(queue.hasItems).toBe(false);
    });

    it('handles getUpNext failure gracefully without crashing', async () => {
      vi.mocked(getUpNext).mockRejectedValue(new Error('Rotation failed'));
      mockLimit.mockResolvedValue({ data: [], error: null });

      const queue = await getStationQueue();
      expect(queue.upcoming).toEqual([]);
      expect(queue.hasItems).toBe(false);
    });

    it('filters out requests that are already aired or rejected', async () => {
      vi.mocked(getUpNext).mockResolvedValue([]);
      mockLimit.mockResolvedValue({
        data: [
          {
            id: 'req-pending',
            platform: 'telegram',
            platform_user_name: 'bot_fan',
            type: 'weather',
            content: 'Tokyo',
            batch_id: 'BATCH-13:00',
            status: 'pending',
            estimated_air_time: '13:00 UTC',
          },
        ],
        error: null,
      });

      const queue = await getStationQueue();

      expect(mockIn).toHaveBeenCalledWith('status', ['pending', 'scheduled']);
      expect(queue.scheduledRequests).toHaveLength(1);
      expect(queue.scheduledRequests[0]?.status).toBe('pending');
    });
  });

  describe('formatQueueForDiscord', () => {
    it('returns an informative empty-state message without siteUrl when queue is empty', () => {
      const emptyQueue: StationQueueResult = {
        channel: 'main',
        upcoming: [],
        scheduledRequests: [],
        hasItems: false,
      };

      const result = formatQueueForDiscord(emptyQueue);

      expect(result).not.toBe('');
      expect(result).toContain('Up Next on PromptFM');
      expect(result).toContain('No tracks currently queued');
      expect(result).toContain('/song');
      expect(result).not.toContain('[Tune in Live]');
    });

    it('returns informative empty-state with siteUrl when provided', () => {
      const emptyQueue: StationQueueResult = {
        channel: 'main',
        upcoming: [],
        scheduledRequests: [],
        hasItems: false,
      };

      const result = formatQueueForDiscord(emptyQueue, 'https://promptfm.live');
      expect(result).toContain('[Tune in Live](https://promptfm.live)');
    });

    it('formats upcoming tracks with and without tool and upvotes count fallback', () => {
      const queue: StationQueueResult = {
        channel: 'main',
        upcoming: [
          {
            id: 't-1',
            type: 'music',
            title: 'Midnight Echoes',
            artist: 'SynthAI',
            tool_used: 'Suno v3.5',
            audio_url: 'https://audio.mp3',
            upvotes_count: 8,
          },
          {
            id: 't-2',
            type: 'music',
            title: 'Solar Flare',
            artist: 'CyberBeats',
            audio_url: 'https://audio2.mp3',
            // upvotes_count undefined
          },
        ],
        scheduledRequests: [],
        hasItems: true,
      };

      const result = formatQueueForDiscord(queue);

      expect(result).toContain('1. **"Midnight Echoes"** by SynthAI (Suno v3.5) — 🔥 8 votes');
      expect(result).toContain('2. **"Solar Flare"** by CyberBeats — 🔥 0 votes');
      expect(result).not.toContain('Scheduled Community Requests');
      expect(result).not.toContain('[Tune in Live]');
    });

    it('formats scheduled requests with missing target, batch_id, and estimated_air_time fallbacks', () => {
      const queue: StationQueueResult = {
        channel: 'main',
        upcoming: [],
        scheduledRequests: [
          {
            id: 'req-minimal',
            platform: 'discord',
            platform_user_name: 'anon_user',
            type: 'song',
            content: 'chill ambient',
            status: 'pending',
            // target, batch_id, estimated_air_time missing
          },
          {
            id: 'req-full',
            platform: 'telegram',
            platform_user_name: 'elena',
            type: 'dedication',
            content: 'Happy birthday!',
            target: 'Alex',
            batch_id: 'BATCH-14:30',
            status: 'scheduled',
            estimated_air_time: '14:30 UTC',
          },
        ],
        hasItems: true,
      };

      const result = formatQueueForDiscord(queue);

      expect(result).toContain('📋 **Scheduled Community Requests:**');
      expect(result).toContain('• **[SONG]** "chill ambient" — requested by @anon_user (discord) (Next Batch • ⏳ Pending)');
      expect(result).toContain('• **[DEDICATION]** "Happy birthday!" for @Alex — requested by @elena (telegram) (BATCH-14:30 ~14:30 UTC • ⏳ Scheduled)');
    });

    it('formats combined upcoming airplay tracks and scheduled requests simultaneously with siteUrl', () => {
      const queue: StationQueueResult = {
        channel: 'main',
        upcoming: [
          {
            id: 't-1',
            type: 'music',
            title: 'Neon Skyline',
            artist: 'Aero',
            audio_url: 'https://audio.mp3',
            upvotes_count: 5,
          },
        ],
        scheduledRequests: [
          {
            id: 'req-1',
            platform: 'discord',
            platform_user_name: 'listener_one',
            type: 'weather',
            content: 'Berlin',
            target: 'Berlin',
            batch_id: 'BATCH-15:00',
            status: 'scheduled',
            estimated_air_time: '15:00 UTC',
          },
        ],
        hasItems: true,
      };

      const result = formatQueueForDiscord(queue, 'https://promptfm.live');

      expect(result).toContain('Up Next on PromptFM');
      expect(result).toContain('1. **"Neon Skyline"** by Aero — 🔥 5 votes');
      expect(result).toContain('Scheduled Community Requests');
      expect(result).toContain('• **[WEATHER]** "Berlin" for @Berlin — requested by @listener_one (discord) (BATCH-15:00 ~15:00 UTC • ⏳ Scheduled)');
      expect(result).toContain('[Tune in Live](https://promptfm.live)');
    });
  });

  describe('formatQueueForTelegram', () => {
    it('returns formatted markdown for Telegram with proper tags and links', () => {
      const queue: StationQueueResult = {
        channel: 'main',
        upcoming: [
          {
            id: 't-1',
            type: 'music',
            title: 'Deep Focus',
            artist: 'MindFlow',
            tool_used: 'Suno',
            audio_url: 'https://audio.mp3',
            upvotes_count: 9,
          },
          {
            id: 't-2',
            type: 'music',
            title: 'No Tool Track',
            artist: 'Solo',
            audio_url: 'https://audio2.mp3',
          },
        ],
        scheduledRequests: [
          {
            id: 'r-1',
            platform: 'telegram',
            platform_user_name: 'alex',
            type: 'zodiac',
            content: 'Scorpio',
            batch_id: 'BATCH-16:00',
            status: 'scheduled',
            estimated_air_time: '16:00 UTC',
          },
          {
            id: 'r-2',
            platform: 'telegram',
            platform_user_name: 'minimal',
            type: 'dedication',
            content: 'Cheers',
            target: 'Team',
            status: 'pending',
          },
        ],
        hasItems: true,
      };

      const result = formatQueueForTelegram(queue, 'https://promptfm.live');

      expect(result).toContain('*Up Next on PromptFM:*');
      expect(result).toContain('1. *"Deep Focus"* by MindFlow (Suno) — 🔥 9 votes');
      expect(result).toContain('2. *"No Tool Track"* by Solo — 🔥 0 votes');
      expect(result).toContain('*Scheduled Community Requests:*');
      expect(result).toContain('• [*ZODIAC*] "Scorpio" — @alex (telegram) (BATCH-16:00 ~16:00 UTC • ⏳ Scheduled)');
      expect(result).toContain('• [*DEDICATION*] "Cheers" for @Team — @minimal (telegram) (Next Batch • ⏳ Pending)');
      expect(result).toContain('[Tune in Live](https://promptfm.live)');
    });

    it('returns empty state text when Telegram queue is empty without siteUrl', () => {
      const emptyQueue: StationQueueResult = {
        channel: 'main',
        upcoming: [],
        scheduledRequests: [],
        hasItems: false,
      };

      const result = formatQueueForTelegram(emptyQueue);
      expect(result).toContain('Continuous community stream loaded. Request a song with /song <prompt>!');
      expect(result).not.toContain('[Tune in Live]');
    });

    it('returns empty state with siteUrl for Telegram', () => {
      const emptyQueue: StationQueueResult = {
        channel: 'main',
        upcoming: [],
        scheduledRequests: [],
        hasItems: false,
      };

      const result = formatQueueForTelegram(emptyQueue, 'https://promptfm.live');
      expect(result).toContain('[Tune in Live](https://promptfm.live)');
    });

    it('formats Telegram queue with only scheduled requests and no upcoming tracks', () => {
      const queue: StationQueueResult = {
        channel: 'main',
        upcoming: [],
        scheduledRequests: [
          {
            id: 'r-only',
            platform: 'telegram',
            platform_user_name: 'alex',
            type: 'song',
            content: 'cyberpunk beats',
            status: 'scheduled',
          },
        ],
        hasItems: true,
      };

      const result = formatQueueForTelegram(queue);
      expect(result).not.toContain('1. *"');
      expect(result).toContain('*Scheduled Community Requests:*');
      expect(result).toContain('• [*SONG*] "cyberpunk beats"');
      expect(result).not.toContain('[Tune in Live]');
    });
  });

  describe('formatQueueForCLI', () => {
    it('formats queue for CLI terminal display with sections and item details', () => {
      const queue: StationQueueResult = {
        channel: 'main',
        upcoming: [
          {
            id: 't-cli',
            type: 'music',
            title: 'Terminal Beat',
            artist: 'CodeMaster',
            tool_used: 'Suno',
            audio_url: 'https://cli.mp3',
            upvotes_count: 15,
          },
          {
            id: 't-cli-notool',
            type: 'music',
            title: 'Raw Beat',
            artist: 'Simple',
            audio_url: 'https://cli.mp3',
          },
        ],
        scheduledRequests: [
          {
            id: 'r-cli',
            platform: 'discord',
            platform_user_name: 'dev_guy',
            type: 'song',
            content: 'lo-fi coding jazz',
            batch_id: 'BATCH-17:00',
            status: 'scheduled',
            estimated_air_time: '17:00 UTC',
          },
          {
            id: 'r-cli-minimal',
            platform: 'telegram',
            platform_user_name: 'sarah',
            type: 'dedication',
            content: 'Good luck!',
            target: 'Alex',
            status: 'pending',
          },
        ],
        hasItems: true,
      };

      const result = formatQueueForCLI(queue);

      expect(result).toContain('PromptFM Active Broadcast Queue (2 upcoming tracks, 2 scheduled requests):');
      expect(result).toContain('Upcoming Tracks:');
      expect(result).toContain('#1 "Terminal Beat" by CodeMaster (Suno) [Votes: 15]');
      expect(result).toContain('#2 "Raw Beat" by Simple [Votes: 0]');
      expect(result).toContain('Scheduled Listener Requests:');
      expect(result).toContain('[SONG] "lo-fi coding jazz" requested by @dev_guy (discord) [BATCH-17:00 ~17:00 UTC | Scheduled]');
      expect(result).toContain('[DEDICATION] "Good luck!" for @Alex requested by @sarah (telegram) [Next Batch | Pending]');
    });

    it('formats CLI queue when only upcoming tracks exist', () => {
      const queue: StationQueueResult = {
        channel: 'main',
        upcoming: [
          {
            id: 't-1',
            type: 'music',
            title: 'Lone Track',
            artist: 'Solo',
            audio_url: 'https://track.mp3',
            upvotes_count: 1,
          },
        ],
        scheduledRequests: [],
        hasItems: true,
      };

      const result = formatQueueForCLI(queue);
      expect(result).toContain('Upcoming Tracks:');
      expect(result).not.toContain('Scheduled Listener Requests:');
    });

    it('formats CLI queue when only scheduled requests exist', () => {
      const queue: StationQueueResult = {
        channel: 'main',
        upcoming: [],
        scheduledRequests: [
          {
            id: 'r-1',
            platform: 'discord',
            platform_user_name: 'sole_requester',
            type: 'song',
            content: 'dream pop',
            status: 'scheduled',
          },
        ],
        hasItems: true,
      };

      const result = formatQueueForCLI(queue);
      expect(result).not.toContain('Upcoming Tracks:');
      expect(result).toContain('Scheduled Listener Requests:');
      expect(result).toContain('dream pop');
    });

    it('returns helpful empty state message for CLI when nothing is queued', () => {
      const emptyQueue: StationQueueResult = {
        channel: 'main',
        upcoming: [],
        scheduledRequests: [],
        hasItems: false,
      };

      const result = formatQueueForCLI(emptyQueue);
      expect(result).toContain('Queue is empty');
      expect(result).toContain('npm run promptfm queue');
    });
  });
});
