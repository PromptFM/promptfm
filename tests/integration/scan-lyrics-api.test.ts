// tests/integration/scan-lyrics-api.test.ts
// Integration tests for POST /api/scan-lyrics

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('POST /api/scan-lyrics API Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('scans clean lyrics and returns allowed channels', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ is_explicit: false, family_friendly: true, flags: [] }) }],
            },
          },
        ],
        usageMetadata: { totalTokenCount: 22 },
      }),
    });
    global.fetch = fakeFetch as unknown as typeof fetch;

    // Dynamic import to allow route creation
    const { POST } = await import('@/app/api/scan-lyrics/route');

    const req = new NextRequest('http://localhost:3000/api/scan-lyrics', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Morning Sunshine',
        lyrics: 'Singing songs of hope and bright new sunny days with friends.',
        description: 'Uplifting synthwave',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scan).toBeDefined();
    expect(data.scan.is_explicit).toBe(false);
    expect(Array.isArray(data.scan.allowed_channels)).toBe(true);
    expect(data.scan.allowed_channels).toContain('main');
    expect(data.scan.allowed_channels).toContain('chillout');
  });

  it('detects profanity immediately via zero-token heuristic', async () => {
    const { POST } = await import('@/app/api/scan-lyrics/route');

    const req = new NextRequest('http://localhost:3000/api/scan-lyrics', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Dark Alley',
        lyrics: 'Get the fuck out of here right now',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scan.is_explicit).toBe(true);
    expect(data.scan.family_friendly).toBe(false);
    expect(data.scan.method).toBe('heuristic_zero_token');
    expect(data.scan.tokens_used).toBe(0);
    expect(data.scan.allowed_channels).toEqual(['main', 'cyberpunk']);
  });

  it('handles empty lyrics as instrumental with 0 tokens', async () => {
    const { POST } = await import('@/app/api/scan-lyrics/route');

    const req = new NextRequest('http://localhost:3000/api/scan-lyrics', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Ambient Chill',
        lyrics: '',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scan.is_explicit).toBe(false);
    expect(data.scan.family_friendly).toBe(true);
    expect(data.scan.tokens_used).toBe(0);
  });
});
