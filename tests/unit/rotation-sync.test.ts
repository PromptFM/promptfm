// tests/unit/rotation-sync.test.ts
// Unit tests verifying on-air track synchronicity:
// 1. Music tracks are NOT prematurely auto-advanced at 180s while still playing on air.
// 2. Liquidsoap on_track transitions remain authoritative.
// 3. Watchdog fallback only advances after an extreme timeout (>= 600s) to prevent frozen stations.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getNowPlaying,
  markTrackStarted,
  updateCurrentAirplayUpvotes,
  getConfiguredWeatherRegions,
  fetchLiveWeatherSummary,
  getNextAirplayItem,
} from '@/lib/dj/rotation';

// Mock Supabase admin client
const { mockUpsert, mockState } = vi.hoisted(() => ({
  mockUpsert: vi.fn().mockResolvedValue({ data: null, error: null }),
  mockState: { customSingle: null as any },
}));

vi.mock('@/lib/supabase/server', () => {
  let filterCol: string | null = null;
  let filterVal: any = null;
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((col: string, val: any) => {
    filterCol = col;
    filterVal = val;
    return chain;
  });
  chain.ilike = vi.fn((col: string, val: string) => {
    filterCol = col;
    filterVal = val;
    return chain;
  });
  chain.is = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockImplementation(async () => {
    if (mockState.customSingle !== null) {
      const res = mockState.customSingle;
      mockState.customSingle = null;
      return res;
    }
    if (filterCol === 'title' && filterVal) {
      const title = String(filterVal);
      filterCol = null;
      filterVal = null;
      return {
        data: {
          id: `track-${title.toLowerCase().replace(/\s+/g, '-')}`,
          title,
          artist_name: 'alextrifan',
          audio_url: 'https://cdn.example.com/audio.mp3',
          cover_art_url: '/covers/custom.png',
          category: 'Synthwave',
          description: 'A great synthwave track',
          lyrics: 'City lights shining bright',
          status: 'approved',
          upvotes_count: 33,
          duration_hint_seconds: 220,
        },
      };
    }
    return {
      data: {
        id: 'song-draga-123',
        title: 'Haina-mi este cea mai draga',
        artist_name: 'alextrifan',
        audio_url: 'https://cdn.example.com/haina.mp3',
        status: 'approved',
        upvotes_count: 33,
        duration_hint_seconds: 220,
      },
    };
  });
  chain.upsert = mockUpsert;
  chain.update = vi.fn(() => chain);

  return {
    createAdminClient: vi.fn(() => ({
      from: vi.fn(() => chain),
    })),
  };
});

vi.mock('@/lib/chat/bridge', () => ({
  broadcastToCommunity: vi.fn().mockResolvedValue({ discord: true, telegram: true }),
}));

describe('On-Air Track Synchronization & Rotation Watchdog', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as unknown as Response);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('keeps playing active music track beyond 180s (e.g. at 210s) without premature song change', async () => {
    // Start track
    const started = await markTrackStarted('sync-test', 'song-draga-123');
    expect(started.title).toBe('Haina-mi este cea mai draga');

    // Simulate 200 seconds of elapsed airplay (past old 180s threshold)
    const nowPlaying = await getNowPlaying('sync-test');
    expect(nowPlaying.item.title).toBe('Haina-mi este cea mai draga');
    expect(nowPlaying.item.id).toBe('song-draga-123');
  });

  it('does NOT auto-advance when elapsed airplay is 200s for a music track', async () => {
    await markTrackStarted('sync-channel-3', 'song-draga-123');

    // Manipulate time by 200 seconds
    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      Date.now = () => realNow + 200 * 1000;

      const current = await getNowPlaying('sync-channel-3');
      // Should STILL be "Haina-mi este cea mai draga" and NOT auto-advance!
      expect(current.item.id).toBe('song-draga-123');
      expect(current.item.title).toBe('Haina-mi este cea mai draga');
      expect(current.elapsedSeconds).toBeGreaterThanOrEqual(200);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('advances on-air track when elapsed airplay reaches safety watchdog ceiling (>= 600s)', async () => {
    await markTrackStarted('sync-channel-watchdog', 'song-draga-123');

    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      Date.now = () => realNow + 605 * 1000;

      const current = await getNowPlaying('sync-channel-watchdog');
      // Watchdog kicks in to avoid frozen orphaned station
      expect(current.elapsedSeconds).toBeLessThan(600);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('auto-advances track when elapsed exceeds duration (e.g. at 339s for a 220s track) to prevent now-playing drift', async () => {
    // Issue #33 reproduction: track finished, elapsed is 339s for 220s track
    await markTrackStarted('sync-channel-drift', 'song-draga-123');

    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      Date.now = () => realNow + 339 * 1000;

      const current = await getNowPlaying('sync-channel-drift');
      // Must advance and NOT remain frozen at elapsed_seconds: 339
      expect(current.elapsedSeconds).toBeLessThan(339);
      expect(current.item.id).not.toBe('song-draga-123');
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('resets startedAt and elapsedSeconds to 0 when Icecast live title reconciles to a new track', async () => {
    // Start initial track
    await markTrackStarted('main', 'song-draga-123');

    const originalDateNow = Date.now;
    const originalFetch = globalThis.fetch;
    try {
      const realNow = originalDateNow();
      // Simulate 200s having elapsed
      Date.now = () => realNow + 200 * 1000;

      // Mock Icecast returning a newly on-air title
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          icestats: {
            source: {
              title: 'alextrifan - Neon Skyline',
            },
          },
        }),
      } as unknown as Response);

      const current = await getNowPlaying('main');
      // Reconciliation must reset elapsedSeconds to 0, not inherit the 200s from the previous track!
      expect(current.item.title).toBe('Neon Skyline');
      expect(current.elapsedSeconds).toBe(0);
    } finally {
      Date.now = originalDateNow;
      globalThis.fetch = originalFetch;
    }
  });

  it('preserves the active music track when elapsed is 250s instead of auto-advancing prematurely', async () => {
    const started = await markTrackStarted('sync-test-2', 'song-draga-123');
    expect(started.id).toBe('song-draga-123');

    // Query now playing immediately
    const state = await getNowPlaying('sync-test-2');
    expect(state.item.id).toBe('song-draga-123');
    expect(state.item.title).toBe('Haina-mi este cea mai draga');
  });

  it('does not reconcile when Icecast live title matches current track title (case-insensitive)', async () => {
    await markTrackStarted('main', 'song-draga-123');
    const originalFetch = globalThis.fetch;
    try {
      // Icecast returns same title in uppercase
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          icestats: {
            source: {
              title: 'alextrifan - HAINA-MI ESTE CEA MAI DRAGA',
            },
          },
        }),
      } as unknown as Response);

      const state = await getNowPlaying('main');
      expect(state.item.id).toBe('song-draga-123');
      expect(state.item.title).toBe('Haina-mi este cea mai draga');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('persists advanced track across subsequent getNowPlaying calls after watchdog advance', async () => {
    await markTrackStarted('sync-persist', 'song-draga-123');
    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      Date.now = () => realNow + 300 * 1000;

      const first = await getNowPlaying('sync-persist');
      expect(first.elapsedSeconds).toBeLessThan(300);

      // Call immediately again (e.g. 1 second later)
      Date.now = () => realNow + 301 * 1000;
      const second = await getNowPlaying('sync-persist');
      expect(second.item.id).toBe(first.item.id);
      expect(second.elapsedSeconds).toBe(1);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('auto-advances at exactly duration + buffer (250s for 220s track)', async () => {
    await markTrackStarted('sync-boundary', 'song-draga-123');
    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      // At 249s, track with duration 220 + 30 = 250s should NOT advance
      Date.now = () => realNow + 249 * 1000;
      const before = await getNowPlaying('sync-boundary');
      expect(before.item.id).toBe('song-draga-123');
      expect(before.elapsedSeconds).toBe(249);

      // At exactly 250s (watchdogTimeoutSeconds), must advance
      Date.now = () => realNow + 250 * 1000;
      const atBoundary = await getNowPlaying('sync-boundary');
      expect(atBoundary.elapsedSeconds).toBeLessThan(250);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('reconciles Icecast live stream directly to pendingAirplayItem when pre-buffered', async () => {
    const { getNextAirplayItem } = await import('@/lib/dj/rotation');
    const nextItem = await getNextAirplayItem('main', false);
    expect(nextItem).toBeDefined();

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          icestats: {
            source: {
              title: `Live Host - ${nextItem.title.toLowerCase()}`,
            },
          },
        }),
      } as unknown as Response);

      const reconciled = await getNowPlaying('main');
      expect(reconciled.item.id).toBe(nextItem.id);
      expect(reconciled.item.title).toBe(nextItem.title);
      expect(reconciled.elapsedSeconds).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reconciles Icecast live stream to ambient fallback anthem if stream plays anthem', async () => {
    await markTrackStarted('main', 'song-draga-123');
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          icestats: {
            source: {
              title: 'PromptFM Core - PromptFM Ambient AI Anthem',
            },
          },
        }),
      } as unknown as Response);

      const reconciled = await getNowPlaying('main');
      expect(reconciled.item.id).toBe('demo-fallback');
      expect(reconciled.item.title).toBe('PromptFM Ambient AI Anthem');
      expect(reconciled.item.category).toBe('Ambient & Lo-Fi');
      expect(reconciled.item.tool_used).toBe('Stable Audio');
      expect(reconciled.item.upvotes_count).toBe(20);
      expect(reconciled.item.duration_hint_seconds).toBe(210);
      expect(reconciled.elapsedSeconds).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reconciles Icecast live stream to custom live item when not found in tracks DB', async () => {
    await markTrackStarted('main', 'song-draga-123');
    mockState.customSingle = { data: null };
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          icestats: {
            source: {
              title: 'Custom Live Band - Live Jam Special',
            },
          },
        }),
      } as unknown as Response);

      const reconciled = await getNowPlaying('main');
      expect(reconciled.item.title).toBe('Live Jam Special');
      expect(reconciled.item.artist).toBe('Custom Live Band');
      expect(reconciled.item.audio_url).toBe('https://stream.promptfm.live/stream.mp3');
      expect(reconciled.item.duration_hint_seconds).toBe(210);
      expect(reconciled.item.cover_art_url).toBe('/logo-mark.png');
      expect(reconciled.elapsedSeconds).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('marks track started by title matching pendingAirplayItem (case-insensitive)', async () => {
    const { getNextAirplayItem } = await import('@/lib/dj/rotation');
    const nextItem = await getNextAirplayItem('main', false);
    const started = await markTrackStarted('main', undefined, nextItem.title.toUpperCase());
    expect(started.id).toBe(nextItem.id);
    expect(started.title).toBe(nextItem.title);
  });

  it('marks track started with demo fallback by title', async () => {
    const started = await markTrackStarted('main', undefined, 'PromptFM Ambient AI Anthem');
    expect(started.id).toBe('demo-fallback');
    expect(started.title).toBe('PromptFM Ambient AI Anthem');
    expect(started.category).toBe('Ambient & Lo-Fi');
    expect(started.duration_hint_seconds).toBe(210);
    expect(started.tool_used).toBe('Stable Audio');
  });

  it('auto-advances spoken drop when elapsed reaches duration + 15s buffer', async () => {
    // Start a spoken drop (type: 'weather', duration_hint_seconds: 20)
    mockState.customSingle = {
      data: {
        id: 'drop-weather-1',
        type: 'weather',
        title: 'DJ Weather Drop',
        artist_name: 'DJ Neon',
        audio_url: 'https://cdn.example.com/drop.mp3',
        status: 'approved',
        duration_hint_seconds: 20,
      },
    };
    await markTrackStarted('sync-spoken', 'drop-weather-1');

    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      // At 30s: 20 + 15 = 35s timeout. 30 < 35, so does NOT auto-advance yet
      Date.now = () => realNow + 30 * 1000;
      const before = await getNowPlaying('sync-spoken');
      expect(before.item.id).toBe('drop-weather-1');
      expect(before.elapsedSeconds).toBe(30);

      // At 35s: reaches watchdog timeout (20 + 15 = 35) -> auto-advances
      Date.now = () => realNow + 35 * 1000;
      const after = await getNowPlaying('sync-spoken');
      expect(after.elapsedSeconds).toBeLessThan(35);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('does not overwrite main channel currentAirplayItem when auto-advancing non-main channel', async () => {
    await markTrackStarted('cyberpunk', 'song-draga-123');

    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      // Main track started at realNow + 100s so it has only elapsed 200s (under 250s watchdog)
      Date.now = () => realNow + 100 * 1000;
      await markTrackStarted('main', 'song-draga-123');

      // At realNow + 300s:
      // cyberpunk is at 300s (exceeds 250s watchdog) -> auto-advances
      // main is at 200s (under 250s watchdog) -> does not auto-advance
      Date.now = () => realNow + 300 * 1000;

      // Auto-advance cyberpunk
      const cyberState = await getNowPlaying('cyberpunk');
      expect(cyberState.item.title).not.toBe('Haina-mi este cea mai draga');

      // Query main channel: must not have been overwritten with cyberpunk
      const mainState = await getNowPlaying('main');
      expect(mainState.item.title).toBe('Haina-mi este cea mai draga');
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('does not overwrite main currentAirplayItem when starting track on non-main channel', async () => {
    await markTrackStarted('main', 'song-draga-123');
    await markTrackStarted('chillout', 'song-draga-123');

    const mainState = await getNowPlaying('main');
    expect(mainState.item.title).toBe('Haina-mi este cea mai draga');
  });

  it('reconciles Icecast title with PromptFM Live artist when stream title has no artist delimiter', async () => {
    await markTrackStarted('main', 'song-draga-123');
    mockState.customSingle = { data: null };
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          icestats: {
            source: {
              title: 'Solitary Track Title Without Artist',
            },
          },
        }),
      } as unknown as Response);

      const reconciled = await getNowPlaying('main');
      expect(reconciled.item.title).toBe('Solitary Track Title Without Artist');
      expect(reconciled.item.artist).toBe('PromptFM Live');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('parses live Icecast title format accurately', async () => {
    const { getIcecastLiveTitle } = await import('@/lib/dj/rotation');
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          icestats: {
            source: {
              title: 'alextrifan - Haina-mi este cea mai draga',
            },
          },
        }),
      } as unknown as Response);

      const result = await getIcecastLiveTitle();
      expect(result).toEqual({
        artist: 'alextrifan',
        title: 'Haina-mi este cea mai draga',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles Icecast errors or missing sources gracefully', async () => {
    const { getIcecastLiveTitle } = await import('@/lib/dj/rotation');
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const result = await getIcecastLiveTitle();
      expect(result).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  describe('In-Memory Upvotes & Station State Sync', () => {
    it('updates vote count in currentAirplayItem and channelAirplayItems when trackId matches', async () => {
      await markTrackStarted('main', 'song-draga-123');
      const before = await getNowPlaying('main');
      expect(before.item.upvotes_count).toBe(33);

      updateCurrentAirplayUpvotes('song-draga-123', 55);

      const after = await getNowPlaying('main');
      expect(after.item.upvotes_count).toBe(55);
    });

    it('ignores vote count update when trackId does not match current track', async () => {
      await markTrackStarted('main', 'song-draga-123');
      updateCurrentAirplayUpvotes('non-existent-track', 99);

      const current = await getNowPlaying('main');
      expect(current.item.upvotes_count).toBe(33);
    });
  });

  describe('Configured Weather Regions & Live Weather Summary', () => {
    it('returns configured weather regions including San Francisco, Tokyo, and London', () => {
      const regions = getConfiguredWeatherRegions();
      expect(regions.length).toBeGreaterThanOrEqual(4);
      const cities = regions.map((r) => r.city);
      expect(cities).toContain('San Francisco');
      expect(cities).toContain('Tokyo');
      expect(cities).toContain('London');
    });

    it('fetches live weather summary with temperature unit formatting', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            current: {
              temperature_2m: 68,
              weather_code: 0,
            },
          }),
        } as unknown as Response);

        const summary = await fetchLiveWeatherSummary('San Francisco');
        expect(summary.city).toBe('San Francisco');
        expect(summary.text).toContain('San Francisco');
        expect(summary.text).toContain('°F');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('falls back to clear skies summary when weather API returns non-ok status', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        } as unknown as Response);

        const summary = await fetchLiveWeatherSummary('Tokyo');
        expect(summary.city).toBe('Tokyo');
        expect(summary.text).toBe('Clear skies in Tokyo');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('falls back to mild temperatures summary when weather API throws network error', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Weather API unreachable'));

        const summary = await fetchLiveWeatherSummary('Berlin');
        expect(summary.city).toBe('Berlin');
        expect(summary.text).toBe('Mild temperatures in Berlin');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('handles rotating region selection when targetCity is not provided', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            current: {
              temperature_2m: 18,
            },
          }),
        } as unknown as Response);

        const summary = await fetchLiveWeatherSummary();
        expect(summary.text).toBeTruthy();
        expect(summary.city).toBeTruthy();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Community Airplay Broadcast Notifications', () => {
    it('notifies community with now_playing for music track', async () => {
      const { broadcastToCommunity } = await import('@/lib/chat/bridge');
      vi.clearAllMocks();

      await markTrackStarted('main', 'song-draga-123');

      expect(broadcastToCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'now_playing',
          trackId: 'song-draga-123',
        })
      );
    });

    it('notifies community for spoken drops, ads, news, and banter', async () => {
      const { broadcastToCommunity } = await import('@/lib/chat/bridge');

      // Test news drop
      mockState.customSingle = {
        data: {
          id: 'news-brief-1',
          type: 'news',
          title: 'Daily AI Update',
          transcript: 'Latest news in AI',
        },
      };
      await markTrackStarted('main', 'news-brief-1');
      expect(broadcastToCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'news',
          transcript: 'Latest news in AI',
        })
      );

      // Test weather drop
      mockState.customSingle = {
        data: {
          id: 'weather-drop-1',
          type: 'weather',
          title: 'Sunny in SF',
          transcript: 'Pleasant weather ahead',
        },
      };
      await markTrackStarted('main', 'weather-drop-1');
      expect(broadcastToCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'weather',
          transcript: 'Pleasant weather ahead',
        })
      );

      // Test sponsor ad
      mockState.customSingle = {
        data: {
          id: 'ad-drop-1',
          type: 'ad',
          title: 'Claude 3.7',
          artist: 'Anthropic',
          transcript: 'Try Claude now',
        },
      };
      await markTrackStarted('main', 'ad-drop-1');
      expect(broadcastToCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'ad',
          transcript: 'Try Claude now',
        })
      );

      // Test dj_banter
      mockState.customSingle = {
        data: {
          id: 'banter-1',
          type: 'dj_banter',
          title: 'DJ Chatter',
          transcript: 'Welcome back listeners',
        },
      };
      await markTrackStarted('main', 'banter-1');
      expect(broadcastToCommunity).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'announcement',
          transcript: 'Welcome back listeners',
        })
      );
    });
  });

  describe('Pending Airplay & Auto-Promote Control', () => {
    it('sets pendingAirplayItem without promoting when autoPromote is false', async () => {
      const beforeState = await getNowPlaying('main');
      const item = await getNextAirplayItem('main', false);
      expect(item).toBeDefined();

      // Station state should NOT have auto-promoted this item yet
      const afterState = await getNowPlaying('main');
      expect(afterState.item.id).toBe(beforeState.item.id);
    });

    it('does not reconcile to pendingAirplayItem when Icecast title does not match pending title', async () => {
      // First generate a pending item
      await getNextAirplayItem('main', false);

      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            icestats: {
              source: {
                title: 'Completely Different On-Air Song',
              },
            },
          }),
        } as unknown as Response);

        const reconciled = await getNowPlaying('main');
        expect(reconciled.item.title).toBe('Completely Different On-Air Song');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('promotes track immediately and upserts station_state when autoPromote is true in getNextAirplayItem', async () => {
      mockUpsert.mockClear();
      const item = await getNextAirplayItem('main', true);
      const nowPlaying = await getNowPlaying('main');
      expect(nowPlaying.item.id).toBe(item.id);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_slug: 'main',
          airplay_item: expect.any(Object),
          started_at: expect.any(String),
        })
      );
    });

    it('upserts station_state with airplay_item and started_at on markTrackStarted', async () => {
      mockUpsert.mockClear();
      await markTrackStarted('main', 'song-draga-123');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_slug: 'main',
          airplay_item: expect.objectContaining({ id: 'song-draga-123' }),
          started_at: expect.any(String),
        })
      );
    });

    it('restores station state from database when channel is not yet in memory', async () => {
      const pastStart = new Date(Date.now() - 45000).toISOString();
      mockState.customSingle = {
        data: {
          airplay_item: {
            id: 'track-db-restored',
            title: 'Restored From DB',
            artist: 'Database DJ',
            audio_url: 'https://example.com/audio.mp3',
            type: 'music',
            duration_hint_seconds: 200,
            upvotes_count: 10,
          },
          started_at: pastStart,
        },
      };

      const result = await getNowPlaying('db-restored-channel');
      expect(result.item.title).toBe('Restored From DB');
      expect(result.elapsedSeconds).toBeGreaterThanOrEqual(44);
    });

    it('falls back to top approved track when station_state has no airplay_item', async () => {
      mockState.customSingle = { data: null };
      mockUpsert.mockClear();

      const result = await getNowPlaying('db-empty-state-channel');
      expect(result.item).toBeDefined();
      expect(result.item.title).toBe('Haina-mi este cea mai draga');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_slug: 'db-empty-state-channel',
        })
      );
    });
  });
});
