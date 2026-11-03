// tests/unit/rotation-music-only.test.ts
// Unit tests verifying that the rotation engine is strictly schedule-driven:
// when the schedule contains only music, it exclusively plays 100% music without voice drops;
// when the schedule includes news or weather milestones, it honors and triggers them.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNextAirplayItem } from '@/lib/dj/rotation';
import * as djEngine from '@/lib/dj/engine';
import * as scheduleService from '@/lib/radio/schedule';
import { OFFICIAL_CHANNELS } from '@/lib/radio/channels';
import { getDJById } from '@/lib/dj/roster';

// Mock Supabase admin client
vi.mock('@/lib/supabase/server', () => {
  const createChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.is = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'track-42',
        title: 'Sunset Grooves',
        artist_name: 'Deep House Collective',
        audio_url: 'https://cdn.example.com/sunset.mp3',
        status: 'approved',
        upvotes_count: 26,
      },
    });
    chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.update = vi.fn(() => chain);
    return chain;
  };

  return {
    createAdminClient: vi.fn(() => ({
      from: vi.fn(() => createChain()),
    })),
  };
});

vi.mock('@/lib/chat/bridge', () => ({
  broadcastToCommunity: vi.fn().mockResolvedValue({ discord: true, telegram: true }),
}));

vi.mock('@/lib/dj/engine', () => ({
  createBroadcastDrop: vi.fn(),
  fetchLiveHeadlines: vi.fn(),
}));

describe('Schedule-Driven Rotation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('plays 100% music without calling news or weather drops when schedule has only music', async () => {
    const createDropSpy = vi.spyOn(djEngine, 'createBroadcastDrop');
    const fetchHeadlinesSpy = vi.spyOn(djEngine, 'fetchLiveHeadlines');

    // Call getNextAirplayItem multiple times
    for (let i = 0; i < 6; i++) {
      const item = await getNextAirplayItem('main', false);
      expect(item.type).toBe('music');
      expect(item.title).toBeDefined();
      expect(item.audio_url).toBeDefined();
    }

    // Must never invoke prompt-generated TTS or headline scrapers
    expect(createDropSpy).not.toHaveBeenCalled();
    expect(fetchHeadlinesSpy).not.toHaveBeenCalled();
  });

  it('triggers news drops when a news milestone is present in the active schedule', async () => {
    const djNeon = getDJById('dj_neon');
    vi.spyOn(djEngine, 'fetchLiveHeadlines').mockResolvedValue(['Breakthrough AI Music Model Released']);
    vi.spyOn(djEngine, 'createBroadcastDrop').mockResolvedValue({
      script: 'Here is the hourly news briefing',
      audioUrl: 'https://example.com/news-drop.mp3',
      dj: djNeon,
    });

    vi.spyOn(scheduleService, 'getStationSchedule').mockReturnValue({
      channel: OFFICIAL_CHANNELS[0]!,
      current_show: {
        id: 'news-show',
        time_utc: '00:00 - 01:00 UTC',
        start_hour_utc: 0,
        end_hour_utc: 1,
        show: 'Hourly News & Beats',
        dj: djNeon,
        genre: 'Synth',
        ai_tools: ['Suno'],
        dj_prompt_style: 'Upbeat',
        is_live: true,
        clock_milestones: [
          { minute: 0, title: 'Top of Hour News', type: 'news', icon: 'Radio', description: 'News' },
        ],
      },
      upcoming_shows: [],
      blocks: [],
      generated_at_utc: new Date().toISOString(),
    });

    // Mock Date to top of the hour (minute 0)
    const originalDate = global.Date;
    const mockDate = new Date('2026-11-03T12:00:00Z');
    global.Date = class extends originalDate {
      constructor(...args: any[]) {
        if (args.length > 0) {
          super(...(args as [any]));
        } else {
          super(mockDate.getTime());
        }
      }
      static override now() {
        return mockDate.getTime();
      }
    } as any;

    try {
      const item = await getNextAirplayItem('main', false);
      expect(item.type).toBe('news');
      expect(item.audio_url).toBe('https://example.com/news-drop.mp3');
    } finally {
      global.Date = originalDate;
    }
  });

  it('triggers weather drops when a weather milestone is present in the active schedule', async () => {
    const djLuna = getDJById('dj_luna');
    vi.spyOn(djEngine, 'createBroadcastDrop').mockResolvedValue({
      script: 'Here is the weather forecast',
      audioUrl: 'https://example.com/weather-drop.mp3',
      dj: djLuna,
    });

    vi.spyOn(scheduleService, 'getStationSchedule').mockReturnValue({
      channel: OFFICIAL_CHANNELS[0]!,
      current_show: {
        id: 'weather-show',
        time_utc: '00:00 - 01:00 UTC',
        start_hour_utc: 0,
        end_hour_utc: 1,
        show: 'Weather & Chill',
        dj: djLuna,
        genre: 'Ambient',
        ai_tools: ['Stable Audio'],
        dj_prompt_style: 'Calm',
        is_live: true,
        clock_milestones: [
          { minute: 15, title: 'Global Weather Check', type: 'weather', icon: 'CloudSun', description: 'Weather' },
        ],
      },
      upcoming_shows: [],
      blocks: [],
      generated_at_utc: new Date().toISOString(),
    });

    // Mock Date to minute 15
    const originalDate = global.Date;
    const mockDate = new Date('2026-11-03T12:15:00Z');
    global.Date = class extends originalDate {
      constructor(...args: any[]) {
        if (args.length > 0) {
          super(...(args as [any]));
        } else {
          super(mockDate.getTime());
        }
      }
      static override now() {
        return mockDate.getTime();
      }
    } as any;

    try {
      // Warm up tracksSinceLastInterstitial counter to >= 3
      for (let i = 0; i < 3; i++) {
        await getNextAirplayItem('main', false);
      }
      const item = await getNextAirplayItem('main', false);
      expect(item.type).toBe('weather');
      expect(item.audio_url).toBe('https://example.com/weather-drop.mp3');
    } finally {
      global.Date = originalDate;
    }
  });
});

