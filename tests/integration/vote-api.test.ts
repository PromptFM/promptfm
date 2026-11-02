// tests/integration/vote-api.test.ts
// Integration test for POST /api/vote endpoint

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as bridge from '@/lib/chat/bridge';
import { POST } from '@/app/api/vote/route';

describe('POST /api/vote API Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects requests with missing or empty trackId with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/vote', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('trackId');
  });

  it('successfully casts a vote and returns updated upvotes_count', async () => {
    vi.spyOn(bridge, 'castVoteForTrack').mockResolvedValue({
      success: true,
      newCount: 32,
      title: 'Forged in Pain',
    });

    const req = new NextRequest('http://localhost:3000/api/vote', {
      method: 'POST',
      body: JSON.stringify({ trackId: '7dd1c716-733c-4ea7-8e82-dda10684d4e6' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.trackId).toBe('7dd1c716-733c-4ea7-8e82-dda10684d4e6');
    expect(json.upvotes_count).toBe(32);
    expect(json.title).toBe('Forged in Pain');
  });

  it('returns 404 when castVoteForTrack reports failure', async () => {
    vi.spyOn(bridge, 'castVoteForTrack').mockResolvedValue({
      success: false,
      newCount: 0,
      title: 'Unknown Track',
    });

    const req = new NextRequest('http://localhost:3000/api/vote', {
      method: 'POST',
      body: JSON.stringify({ trackId: 'non-existent-id' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain('Could not register vote');
  });
});
