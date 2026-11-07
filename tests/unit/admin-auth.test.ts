// tests/unit/admin-auth.test.ts
// Unit tests for admin authentication helper

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { isAdminAuthorized } from '@/lib/auth/admin-auth';

const TEST_SECRET = 'ultra-secret-admin-token-999';

describe('Admin Authentication Guard (isAdminAuthorized)', () => {
  const originalEnv = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = TEST_SECRET;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_API_KEY = originalEnv;
    } else {
      delete process.env.ADMIN_API_KEY;
    }
  });

  it('allows access when ADMIN_API_KEY is not configured (dev mode default)', () => {
    delete process.env.ADMIN_API_KEY;
    const req = new NextRequest('http://localhost:3000/api/admin/reports');
    expect(isAdminAuthorized(req)).toBe(true);
  });

  it('allows access when ADMIN_API_KEY is empty string (dev mode default)', () => {
    process.env.ADMIN_API_KEY = '';
    const req = new NextRequest('http://localhost:3000/api/admin/reports');
    expect(isAdminAuthorized(req)).toBe(true);
  });

  it('denies access when no credentials are provided in headers or query', () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stream');
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it('allows access when valid Bearer token is passed in Authorization header', () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stream', {
      headers: { authorization: `Bearer ${TEST_SECRET}` },
    });
    expect(isAdminAuthorized(req)).toBe(true);
  });

  it('denies access when invalid Bearer token is passed', () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stream', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it('denies access when Authorization header is malformed (missing Bearer prefix)', () => {
    const req = new NextRequest('http://localhost:3000/api/admin/stream', {
      headers: { authorization: TEST_SECRET },
    });
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it('allows access when valid x-admin-key header is provided', () => {
    const req = new NextRequest('http://localhost:3000/api/admin/broadcast', {
      headers: { 'x-admin-key': TEST_SECRET },
    });
    expect(isAdminAuthorized(req)).toBe(true);
  });

  it('denies access when invalid x-admin-key header is provided', () => {
    const req = new NextRequest('http://localhost:3000/api/admin/broadcast', {
      headers: { 'x-admin-key': 'incorrect-key' },
    });
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it('allows access when valid key query param is provided', () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/requests?key=${TEST_SECRET}`);
    expect(isAdminAuthorized(req)).toBe(true);
  });

  it('denies access when invalid key query param is provided', () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests?key=bogus');
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it('works with standard Web API Request objects as well as NextRequest', () => {
    const standardReq = new Request(`http://localhost:3000/api/admin/requests?key=${TEST_SECRET}`);
    expect(isAdminAuthorized(standardReq)).toBe(true);

    const unauthReq = new Request('http://localhost:3000/api/admin/requests');
    expect(isAdminAuthorized(unauthReq)).toBe(false);
  });

  it('handles request with malformed URL safely without throwing', () => {
    const mockReq = {
      headers: new Headers(),
      url: 'http://[invalid-host-bracket',
    } as unknown as Request;

    expect(isAdminAuthorized(mockReq)).toBe(false);
  });

  it('handles request without url property safely', () => {
    const mockReq = {
      headers: new Headers(),
      url: '',
    } as unknown as Request;

    expect(isAdminAuthorized(mockReq)).toBe(false);
  });

  it('denies access when key is only a prefix or substring of actual admin key', () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/requests?key=${TEST_SECRET.slice(0, 10)}`);
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it('denies access when Bearer token is empty', () => {
    const req = new NextRequest('http://localhost:3000/api/admin/requests', {
      headers: { authorization: 'Bearer ' },
    });
    expect(isAdminAuthorized(req)).toBe(false);
  });
});
