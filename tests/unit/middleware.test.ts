// tests/unit/middleware.test.ts
// Unit tests for Next.js shared middleware guarding /api/admin/*

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware, config } from '@/middleware';

const TEST_SECRET = 'shared-admin-secret-456';

describe('Next.js Middleware Guard (src/middleware.ts)', () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalEnv = process.env.ADMIN_API_KEY;
  const originalNodeEnv = mutableEnv.NODE_ENV;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = TEST_SECRET;
    mutableEnv.NODE_ENV = 'test';
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_API_KEY = originalEnv;
    } else {
      delete process.env.ADMIN_API_KEY;
    }

    if (originalNodeEnv !== undefined) {
      mutableEnv.NODE_ENV = originalNodeEnv;
    } else {
      delete mutableEnv.NODE_ENV;
    }
  });

  it('exports matcher config matching /api/admin/:path*', () => {
    expect(config).toBeDefined();
    expect(config.matcher).toBeDefined();
    expect(config.matcher).toContain('/api/admin/:path*');
  });

  it('blocks unauthenticated GET request to exact /api/admin root endpoint with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin');
    const res = middleware(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('blocks unauthenticated GET request to /api/admin/reports with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/reports');
    const res = middleware(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('blocks unauthenticated POST request to /api/admin/broadcast with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    });
    const res = middleware(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('blocks request with invalid credentials to /api/admin/stream with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stream', {
      headers: { 'x-admin-key': 'bad-key' },
    });
    const res = middleware(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('allows authenticated request with Bearer authorization header to /api/admin/stream', () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stream', {
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it('allows authenticated request with x-admin-key header to /api/admin/requests', () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      headers: { 'x-admin-key': TEST_SECRET },
    });
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it('allows authenticated request with ?key= query param to /api/admin/reports', () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/reports?key=${TEST_SECRET}`);
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it('allows unauthenticated requests when ADMIN_API_KEY is not configured (dev mode fallback)', () => {
    delete process.env.ADMIN_API_KEY;
    const req = new NextRequest('http://localhost:3000/api/admin/reports');
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it('allows requests to non-admin routes without authentication', () => {
    const req = new NextRequest('http://localhost:3000/api/status');
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it('does not falsely block paths like /api/admin-public (proper boundary check)', () => {
    const req = new NextRequest('http://localhost:3000/api/admin-public');
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it('blocks unauthenticated admin requests in production when ADMIN_API_KEY is unset', async () => {
    mutableEnv.NODE_ENV = 'production';
    delete process.env.ADMIN_API_KEY;

    const req = new NextRequest('http://localhost:3000/api/admin/reports');
    const res = middleware(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('lets likely Supabase session-backed admin requests reach route handlers in production', () => {
    mutableEnv.NODE_ENV = 'production';
    delete process.env.ADMIN_API_KEY;

    const req = new NextRequest('http://localhost:3000/api/admin/reports', {
      headers: {
        cookie: 'sb-local-auth-token=mock-session-cookie',
      },
    });
    const res = middleware(req);

    expect(res.status).toBe(200);
  });
});
