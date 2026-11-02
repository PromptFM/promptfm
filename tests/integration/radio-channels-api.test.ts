// tests/integration/radio-channels-api.test.ts
// Integration tests for GET /api/radio/channels endpoint

import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/radio/channels/route';
import { NextRequest } from 'next/server';

describe('GET /api/radio/channels API Integration', () => {
  it('returns all official radio channels with success true and active DJ metadata', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/channels');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.channels)).toBe(true);
    expect(json.channels.length).toBeGreaterThanOrEqual(4);

    const main = json.channels.find((c: any) => c.slug === 'main');
    expect(main).toBeDefined();
    expect(main.name).toBe('PromptFM Main Stage');
    expect(main.active_dj).toBeDefined();
    expect(main.active_dj.name).toBe('DJ Neon');

    const cyber = json.channels.find((c: any) => c.slug === 'cyberpunk');
    expect(cyber).toBeDefined();
    expect(cyber.active_dj.name).toBe('DJ Cipher');

    const chill = json.channels.find((c: any) => c.slug === 'chillout');
    expect(chill).toBeDefined();
    expect(chill.active_dj.name).toBe('DJ Luna');

    const kids = json.channels.find((c: any) => c.slug === 'kids');
    expect(kids).toBeDefined();
    expect(kids.active_dj.name).toBe('DJ Pixel');
  });

  it('sets appropriate public caching headers for fast CDN delivery', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/channels');
    const res = await GET(req);
    expect(res.headers.get('Cache-Control')).toContain('public');
  });
});
