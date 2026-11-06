// tests/integration/radio-started-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/radio/started/route';
import { broadcastToCommunity } from '@/lib/chat/bridge';
import { resetAirplayDedupeCache } from '@/lib/dj/rotation';

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
        id: 'track-started-123',
        title: 'Live On Stream Track',
        artist_name: 'AI Artist',
        audio_url: 'https://cdn.example.com/stream.mp3',
        status: 'approved',
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

describe('Liquidsoap /api/radio/started API Endpoint', () => {
  beforeEach(() => {
    resetAirplayDedupeCache();
    vi.clearAllMocks();
  });

  it('accepts track started POST signal from Liquidsoap and returns 200 with airplay item', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/started', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'main',
        item_id: 'track-started-123',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.channel).toBe('main');
    expect(data.now_playing).toBeDefined();
    expect(data.now_playing.id).toBeDefined();
  });

  it('accepts track started GET signal as simple query string from Liquidsoap', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/started?channel=main&item_id=track-started-123');

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.channel).toBe('main');
    expect(data.now_playing.id).toBe('track-started-123');
  });

  it('handles missing item_id with a bad request response', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/started', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'main',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('deduplicates duplicate POST requests for the same track without re-broadcasting', async () => {
    const makeReq = () =>
      new NextRequest('http://localhost:3000/api/radio/started', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'main',
          item_id: 'track-started-123',
        }),
      });

    // First airplay notification
    const res1 = await POST(makeReq());
    expect(res1.status).toBe(200);
    expect(broadcastToCommunity).toHaveBeenCalledTimes(1);

    // Duplicate call (e.g. Liquidsoap retry at 18:59)
    const res2 = await POST(makeReq());
    expect(res2.status).toBe(200);
    // Should NOT call broadcastToCommunity a second time
    expect(broadcastToCommunity).toHaveBeenCalledTimes(1);
  });
});
