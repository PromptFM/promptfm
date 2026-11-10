// tests/integration/radio-next-api.test.ts
// Integration test for /api/radio/next route (used by Liquidsoap and web player)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/radio/next/route';
import * as rotation from '@/lib/dj/rotation';
import * as fs from 'fs';
import * as path from 'path';

describe('GET /api/radio/next API Integration', () => {
  const mockTrack: rotation.AirplayItem = {
    id: 'test-track-123',
    type: 'music',
    title: 'Neon Horizon',
    artist: 'AI Producer',
    audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    tool_used: 'Suno v3.5',
    upvotes_count: 50,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default JSON response when format is omitted', async () => {
    vi.spyOn(rotation, 'getNextAirplayItem').mockResolvedValue(mockTrack);

    const req = new NextRequest('http://localhost:3000/api/radio/next');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('application/json');

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.channel).toBe('main');
    expect(json.item).toBeDefined();
    expect(json.item.id).toBe('test-track-123');
    expect(json.item.audio_url).toBe(mockTrack.audio_url);
  });

  it('returns plain text audio URI directly when format=uri is requested', async () => {
    vi.spyOn(rotation, 'getNextAirplayItem').mockResolvedValue(mockTrack);

    const req = new NextRequest('http://localhost:3000/api/radio/next?format=uri');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('text/plain');

    const text = await res.text();
    expect(text).toBe(mockTrack.audio_url);
  });

  it('passes channel parameter correctly and supports format=raw', async () => {
    const spy = vi.spyOn(rotation, 'getNextAirplayItem').mockResolvedValue(mockTrack);

    const req = new NextRequest('http://localhost:3000/api/radio/next?channel=ambient&format=raw');
    const res = await GET(req);

    expect(spy).toHaveBeenCalledWith('ambient');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(mockTrack.audio_url);
  });

  it('handles rotation errors gracefully for format=uri', async () => {
    vi.spyOn(rotation, 'getNextAirplayItem').mockRejectedValue(new Error('Rotation failed'));

    const req = new NextRequest('http://localhost:3000/api/radio/next?format=uri');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('text/plain');
    const text = await res.text();
    expect(text).toBe('');
  });

  it('handles rotation errors gracefully for default json format', async () => {
    vi.spyOn(rotation, 'getNextAirplayItem').mockRejectedValue(new Error('Rotation failed'));

    const req = new NextRequest('http://localhost:3000/api/radio/next');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Rotation failed');
  });

  it('keeps the Liquidsoap next-track callback origin configurable instead of hard-coding the public apex', () => {
    const liq = fs.readFileSync(
      path.resolve(__dirname, '../../infra/ansible/roles/streamer/templates/radio.liq.j2'),
      'utf8',
    );

    expect(liq).not.toContain('https://promptfm.live/api/radio/next');
    expect(liq).toMatch(/promptfm_api_url|PROMPTFM_API_URL|\{\{ .*promptfm_api_url.* \}\}/);
  });
});
