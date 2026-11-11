// tests/unit/admin-auth.test.ts
// Unit tests for admin authentication helper

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { isAdminAuthorized } from '@/lib/auth/admin-route-auth';

const { mockCreateClient, mockGetUser } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockCreateClient = vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  }));

  return {
    mockCreateClient,
    mockGetUser,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

const TEST_SECRET = 'ultra-secret-admin-token-999';

describe('Admin Authentication Guard (isAdminAuthorized)', () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalEnv = process.env.ADMIN_API_KEY;
  const originalAdminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  const originalNodeEnv = mutableEnv.NODE_ENV;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = TEST_SECRET;
    delete process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    mutableEnv.NODE_ENV = 'test';
    mockCreateClient.mockClear();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_API_KEY = originalEnv;
    } else {
      delete process.env.ADMIN_API_KEY;
    }

    if (originalAdminEmails !== undefined) {
      process.env.NEXT_PUBLIC_ADMIN_EMAILS = originalAdminEmails;
    } else {
      delete process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    }

    if (originalNodeEnv !== undefined) {
      mutableEnv.NODE_ENV = originalNodeEnv;
    } else {
      delete mutableEnv.NODE_ENV;
    }
  });

  it('allows access when ADMIN_API_KEY is not configured (dev mode default)', async () => {
    delete process.env.ADMIN_API_KEY;
    const req = new NextRequest('http://localhost:3000/api/admin/reports');
    await expect(isAdminAuthorized(req)).resolves.toBe(true);
  });

  it('allows access when ADMIN_API_KEY is empty string (dev mode default)', async () => {
    process.env.ADMIN_API_KEY = '';
    const req = new NextRequest('http://localhost:3000/api/admin/reports');
    await expect(isAdminAuthorized(req)).resolves.toBe(true);
  });

  it('denies access when no credentials are provided in headers or query', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stream');
    await expect(isAdminAuthorized(req)).resolves.toBe(false);
  });

  it('allows access when valid Bearer token is passed in Authorization header', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stream', {
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    await expect(isAdminAuthorized(req)).resolves.toBe(true);
  });

  it('denies access when invalid Bearer token is passed', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stream', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    await expect(isAdminAuthorized(req)).resolves.toBe(false);
  });

  it('denies access when Authorization header is malformed (missing Bearer prefix)', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stream', {
      headers: { authorization: TEST_SECRET },
    });
    await expect(isAdminAuthorized(req)).resolves.toBe(false);
  });

  it('allows access when valid x-admin-key header is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/broadcast', {
      headers: { 'x-admin-key': TEST_SECRET },
    });
    await expect(isAdminAuthorized(req)).resolves.toBe(true);
  });

  it('denies access when invalid x-admin-key header is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/broadcast', {
      headers: { 'x-admin-key': 'incorrect-key' },
    });
    await expect(isAdminAuthorized(req)).resolves.toBe(false);
  });

  it('allows access when valid key query param is provided', async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/requests?key=${TEST_SECRET}`);
    await expect(isAdminAuthorized(req)).resolves.toBe(true);
  });

  it('denies access when invalid key query param is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests?key=bogus');
    await expect(isAdminAuthorized(req)).resolves.toBe(false);
  });

  it('works with standard Web API Request objects as well as NextRequest', async () => {
    const standardReq = new Request(`http://localhost:3000/api/admin/requests?key=${TEST_SECRET}`);
    await expect(isAdminAuthorized(standardReq)).resolves.toBe(true);

    const unauthReq = new Request('http://localhost:3000/api/admin/requests');
    await expect(isAdminAuthorized(unauthReq)).resolves.toBe(false);
  });

  it('handles request with malformed URL safely without throwing', async () => {
    const mockReq = {
      headers: new Headers(),
      url: 'http://[invalid-host-bracket',
    } as unknown as Request;

    await expect(isAdminAuthorized(mockReq)).resolves.toBe(false);
  });

  it('handles request without url property safely', async () => {
    const mockReq = {
      headers: new Headers(),
      url: '',
    } as unknown as Request;

    await expect(isAdminAuthorized(mockReq)).resolves.toBe(false);
  });

  it('denies access when key is only a prefix or substring of actual admin key', async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/requests?key=${TEST_SECRET.slice(0, 10)}`);
    await expect(isAdminAuthorized(req)).resolves.toBe(false);
  });

  it('denies access when Bearer token is empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      headers: { authorization: 'Bearer ' },
    });
    await expect(isAdminAuthorized(req)).resolves.toBe(false);
  });

  it('fails closed in production when ADMIN_API_KEY is unset and no admin session is present', async () => {
    mutableEnv.NODE_ENV = 'production';
    delete process.env.ADMIN_API_KEY;

    const req = new NextRequest('http://localhost:3000/api/admin/reports');

    await expect(isAdminAuthorized(req)).resolves.toBe(false);
  });

  it('allows an allowlisted Supabase admin session in production without ADMIN_API_KEY', async () => {
    mutableEnv.NODE_ENV = 'production';
    delete process.env.ADMIN_API_KEY;
    process.env.NEXT_PUBLIC_ADMIN_EMAILS = 'admin@promptfm.live';
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'ADMIN@promptfm.live' } },
      error: null,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/reports', {
      headers: {
        cookie: 'sb-local-auth-token=mock-session-cookie',
      },
    });

    await expect(isAdminAuthorized(req)).resolves.toBe(true);
    expect(mockCreateClient).toHaveBeenCalled();
  });

  it('denies a Supabase session whose email is not in the admin allowlist', async () => {
    mutableEnv.NODE_ENV = 'production';
    delete process.env.ADMIN_API_KEY;
    process.env.NEXT_PUBLIC_ADMIN_EMAILS = 'admin@promptfm.live';
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'listener@promptfm.live' } },
      error: null,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/reports', {
      headers: {
        cookie: 'sb-local-auth-token=mock-session-cookie',
      },
    });

    await expect(isAdminAuthorized(req)).resolves.toBe(false);
  });
});
