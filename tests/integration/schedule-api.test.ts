// tests/integration/schedule-api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as rotation from '@/lib/dj/rotation';
import { GET } from '@/app/api/radio/schedule/route';

describe('GET /api/radio/schedule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(rotation, 'getNowPlaying').mockResolvedValue({
      item: {
        id: 'track-schedule-1',
        type: 'music',
        title: 'Neon Drift',
        artist: 'PromptFM Resident',
        audio_url: 'https://example.com/drift.mp3',
        upvotes_count: 25,
      },
      startedAt: new Date().toISOString(),
      elapsedSeconds: 20,
      activeDJ: {
        id: 'dj_neon',
        name: 'DJ Neon',
        title: 'Electric Host',
        bio: 'Bio',
        stylePrompt: 'Style',
        voice: { name: 'en-US-Journey-F', languageCode: 'en-US', ssmlGender: 'FEMALE' },
        shifts: ['06:00 - 10:00'],
        defaultChannels: ['main'],
      },
    });
  });

  it('returns 200 with full day broadcast schedule for main stage', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/schedule?channel=main');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=30');
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.channel).toBeDefined();
    expect(data.channel.slug).toBe('main');
    expect(data.blocks).toBeInstanceOf(Array);
    expect(data.blocks.length).toBeGreaterThanOrEqual(4);
    expect(data.current_show).toBeDefined();
    expect(data.now_playing).toBeDefined();
    expect(data.now_playing.title).toBe('Neon Drift');
  });

  it('supports channel selection parameter (e.g. ?channel=cyberpunk)', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/schedule?channel=cyberpunk');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=30');
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.channel.slug).toBe('cyberpunk');
  });

  it('returns all channels when ?all=true is supplied', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/schedule?all=true');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=30');
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.channels).toBeInstanceOf(Array);
    expect(data.channels.length).toBeGreaterThanOrEqual(4);
  });
});

