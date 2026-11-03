// tests/integration/schedule-api.test.ts
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/radio/schedule/route';

describe('GET /api/radio/schedule', () => {
  it('returns 200 with full day broadcast schedule for main stage', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/schedule?channel=main');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.channel).toBeDefined();
    expect(data.channel.slug).toBe('main');
    expect(data.blocks).toBeInstanceOf(Array);
    expect(data.blocks.length).toBeGreaterThanOrEqual(4);
    expect(data.current_show).toBeDefined();
  });

  it('supports channel selection parameter (e.g. ?channel=cyberpunk)', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/schedule?channel=cyberpunk');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.channel.slug).toBe('cyberpunk');
  });

  it('returns all channels when ?all=true is supplied', async () => {
    const req = new NextRequest('http://localhost:3000/api/radio/schedule?all=true');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.channels).toBeInstanceOf(Array);
    expect(data.channels.length).toBeGreaterThanOrEqual(4);
  });
});
