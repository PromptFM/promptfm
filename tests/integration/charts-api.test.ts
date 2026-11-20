// tests/integration/charts-api.test.ts
// Integration test for GET /api/charts endpoint

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as chartsService from '@/lib/charts/charts-service';
import { GET } from '@/app/api/charts/route';

describe('GET /api/charts API Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with chart items using limit from query param', async () => {
    const mockTracks = [
      {
        id: 't-1',
        title: 'Rank 1 Song',
        artist_name: 'Artist 1',
        audio_url: 'https://r2.dev/t1.mp3',
        tool_used: 'Suno' as const,
        status: 'approved' as const,
        upvotes_count: 100,
        created_at: new Date().toISOString(),
        user_id: null,
      },
    ];

    const spy = vi.spyOn(chartsService, 'fetchTopApprovedTracks').mockResolvedValue(mockTracks);

    const req = new NextRequest('http://localhost:3000/api/charts?limit=15');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe('Rank 1 Song');
    expect(spy).toHaveBeenCalledWith({ limit: 15 });
  });

  it('returns 500 when fetchTopApprovedTracks throws error', async () => {
    vi.spyOn(chartsService, 'fetchTopApprovedTracks').mockRejectedValue(new Error('Fatal charts error'));

    const req = new NextRequest('http://localhost:3000/api/charts');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Fatal charts error');
  });
});
