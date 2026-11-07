// tests/integration/vercel-flags.test.ts
// Integration tests for Vercel Flags Discovery Endpoint (/.well-known/vercel/flags)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createAccessProof } from 'flags';
import { GET as getVercelFlags } from '@/app/.well-known/vercel/flags/route';

describe('Vercel Flags Discovery Endpoint (Integration)', () => {
  const TEST_SECRET = 'test-secret-32-bytes-flags-secret-key-12345';

  beforeEach(() => {
    process.env.FLAGS_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.FLAGS_SECRET;
  });

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const req = new NextRequest('http://localhost:3000/.well-known/vercel/flags');
    const res = await getVercelFlags(req);
    expect(res.status).toBe(401);
  });

  it('returns valid ApiData definitions when authorized via Vercel Flags proof', async () => {
    const proof = await createAccessProof(TEST_SECRET);
    const req = new NextRequest('http://localhost:3000/.well-known/vercel/flags', {
      headers: {
        Authorization: `Bearer ${proof}`,
      },
    });

    const res = await getVercelFlags(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.definitions).toBeDefined();

    expect(json.definitions.community_requests).toMatchObject({
      defaultValue: true,
      description: expect.any(String),
      origin: 'https://promptfm.live/admin',
    });

    expect(json.definitions.maintenance_mode).toMatchObject({
      defaultValue: false,
    });
  });
});
