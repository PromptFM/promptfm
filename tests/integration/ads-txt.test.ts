// tests/integration/ads-txt.test.ts
// Integration test for Next.js App Router /ads.txt route.

import { describe, it, expect } from 'vitest';
import { GET } from '@/app/ads.txt/route';

describe('GET /ads.txt Route Integration', () => {
  it('returns 200 OK with text/plain Content-Type and verified Google AdSense record', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    const contentType = res.headers.get('Content-Type');
    expect(contentType).toContain('text/plain');

    const body = await res.text();
    expect(body).toContain('google.com, pub-7299057534028491, DIRECT, f08c47fec0942fa0');
    expect(body).toContain('# PromptFM Authorized Digital Sellers');
  });

  it('includes public cache headers for CDN edge caching', async () => {
    const res = await GET();
    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('public');
    expect(cacheControl).toContain('max-age=86400');
  });
});
