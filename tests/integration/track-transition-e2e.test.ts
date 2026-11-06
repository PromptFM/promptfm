// tests/integration/track-transition-e2e.test.ts
// End-to-end integration test verifying seamless track transitions on PromptFM:
// 1. Liquidsoap on-air transitions via /api/radio/started.
// 2. Watchdog auto-advance when track finishes, preventing now-playing drift (Issue #33).
// 3. Icecast live stream reconciliation resetting elapsed_seconds to 0.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getNow } from '@/app/api/radio/now/route';
import { POST as postStarted, GET as getStarted } from '@/app/api/radio/started/route';
import { markTrackStarted, getNowPlaying } from '@/lib/dj/rotation';

vi.mock('@/lib/supabase/server', () => {
  const store: Record<string, any> = {
    'track-a': {
      id: 'track-a',
      title: 'Neon Skyline',
      artist_name: 'CyberWave',
      audio_url: 'https://example.com/a.mp3',
      status: 'approved',
      upvotes_count: 50,
      duration_hint_seconds: 210,
    },
    'track-b': {
      id: 'track-b',
      title: 'Midnight Drive',
      artist_name: 'SynthRider',
      audio_url: 'https://example.com/b.mp3',
      status: 'approved',
      upvotes_count: 45,
      duration_hint_seconds: 180,
    },
    'track-c': {
      id: 'track-c',
      title: 'Digital Horizon',
      artist_name: 'PixelForge',
      audio_url: 'https://example.com/c.mp3',
      status: 'approved',
      upvotes_count: 40,
      duration_hint_seconds: 200,
    },
  };

  let stationState: Record<string, any> = {};

  const createChain = (table: string) => {
    let currentFilter: { col?: string; val?: any } = {};
    const chain: Record<string, any> = {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, val: any) => {
        currentFilter = { col, val };
        return chain;
      }),
      ilike: vi.fn((col: string, val: any) => {
        currentFilter = { col, val };
        return chain;
      }),
      gt: vi.fn(() => chain),
      is: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => {
        if (table === 'station_state') {
          return { data: stationState[currentFilter.val] || null };
        }
        if (table === 'tracks') {
          if (currentFilter.col === 'id' && store[currentFilter.val]) {
            return { data: store[currentFilter.val] };
          }
          if (currentFilter.col === 'title') {
            const found = Object.values(store).find(
              (t: any) => t.title.toLowerCase() === String(currentFilter.val).toLowerCase()
            );
            return { data: found || null };
          }
          return { data: Object.values(store)[0] };
        }
        return { data: null };
      }),
      upsert: vi.fn(async (record: any) => {
        if (table === 'station_state') {
          stationState[record.channel_slug] = record;
        }
        return { data: null, error: null };
      }),
      update: vi.fn(() => chain),
    };
    return chain;
  };

  return {
    createAdminClient: vi.fn(() => ({
      from: vi.fn((table: string) => createChain(table)),
    })),
  };
});

vi.mock('@/lib/chat/bridge', () => ({
  broadcastToCommunity: vi.fn().mockResolvedValue({ discord: true, telegram: true }),
}));

describe('End-to-End Track Transition & Drift Prevention (Issue #33)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('status-json.xsl')) {
        return {
          ok: false,
          json: async () => ({}),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('transitions track seamlessly when Liquidsoap notifies /api/radio/started via POST', async () => {
    // 1. Initial track playing
    await markTrackStarted('main', 'track-a');
    const req1 = new NextRequest('http://localhost:3000/api/radio/now?channel=main');
    const res1 = await getNow(req1);
    const json1 = await res1.json();
    expect(json1.now_playing.title).toBe('Neon Skyline');

    // 2. Liquidsoap transitions to Track B
    const startReq = new NextRequest('http://localhost:3000/api/radio/started', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'main', item_id: 'track-b' }),
    });
    const startRes = await postStarted(startReq);
    expect(startRes.status).toBe(200);

    // 3. /api/radio/now reflects Track B with elapsedSeconds 0
    const req2 = new NextRequest('http://localhost:3000/api/radio/now?channel=main');
    const res2 = await getNow(req2);
    const json2 = await res2.json();
    expect(json2.now_playing.title).toBe('Midnight Drive');
    expect(json2.elapsed_seconds).toBeLessThanOrEqual(2);
    expect(json2.duration_seconds).toBe(180);
  });

  it('prevents now-playing drift when track has finished without Liquidsoap started event', async () => {
    // Given track-a is playing with duration 210s
    await markTrackStarted('e2e-drift-channel', 'track-a');

    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      // Fast forward 339s (exact scenario from issue #33: elapsed_seconds 339 for duration 210)
      Date.now = () => realNow + 339 * 1000;

      const req = new NextRequest('http://localhost:3000/api/radio/now?channel=e2e-drift-channel');
      const res = await getNow(req);
      const json = await res.json();

      // Must have auto-advanced and not be stuck at 339 elapsed seconds on finished track
      expect(json.elapsed_seconds).toBeLessThan(339);
      expect(json.now_playing.id).not.toBe('track-a');
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('accepts title parameter in /api/radio/started when item_id is missing', async () => {
    const startReq = new NextRequest('http://localhost:3000/api/radio/started', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'main', title: 'Midnight Drive' }),
    });
    const startRes = await postStarted(startReq);
    expect(startRes.status).toBe(200);

    const data = await startRes.json();
    expect(data.now_playing.title).toBe('Midnight Drive');
  });

  it('transitions track via GET /api/radio/started as invoked by Liquidsoap HTTP hook', async () => {
    const getReq = new NextRequest('http://localhost:3000/api/radio/started?channel=main&item_id=track-c');
    const getRes = await getStarted(getReq);
    expect(getRes.status).toBe(200);

    const json = await getRes.json();
    expect(json.success).toBe(true);
    expect(json.now_playing.title).toBe('Digital Horizon');

    const nowReq = new NextRequest('http://localhost:3000/api/radio/now?channel=main');
    const nowRes = await getNow(nowReq);
    const nowJson = await nowRes.json();
    expect(nowJson.now_playing.title).toBe('Digital Horizon');
    expect(nowJson.elapsed_seconds).toBeLessThanOrEqual(2);
  });

  it('reconciles on-air stream title and resets elapsed_seconds to 0 when Icecast reports new title', async () => {
    await markTrackStarted('main', 'track-a');

    // Simulate elapsed 190s
    const originalDateNow = Date.now;
    try {
      const realNow = originalDateNow();
      Date.now = () => realNow + 190 * 1000;

      // Mock Icecast live status returning new title "Digital Horizon"
      globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('status-json.xsl')) {
          return {
            ok: true,
            json: async () => ({
              icestats: {
                source: {
                  title: 'PixelForge - Digital Horizon',
                },
              },
            }),
          } as unknown as Response;
        }
        return { ok: true, json: async () => ({}) } as unknown as Response;
      });

      const nowReq = new NextRequest('http://localhost:3000/api/radio/now?channel=main');
      const nowRes = await getNow(nowReq);
      const nowJson = await nowRes.json();

      expect(nowJson.now_playing.title).toBe('Digital Horizon');
      expect(nowJson.elapsed_seconds).toBe(0);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('reconciles to ambient fallback anthem if Icecast returns fallback anthem', async () => {
    await markTrackStarted('main', 'track-b');

    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('status-json.xsl')) {
        return {
          ok: true,
          json: async () => ({
            icestats: {
              source: {
                title: 'PromptFM Core - PromptFM Ambient AI Anthem',
              },
            },
          }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    });

    const nowReq = new NextRequest('http://localhost:3000/api/radio/now?channel=main');
    const nowRes = await getNow(nowReq);
    const nowJson = await nowRes.json();

    expect(nowJson.now_playing.title).toBe('PromptFM Ambient AI Anthem');
    expect(nowJson.elapsed_seconds).toBe(0);
  });
});
