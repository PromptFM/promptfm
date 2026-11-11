// tests/integration/admin-channels-api.test.ts
// Integration tests for first-party admin channel management API.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockCreateClient, mockGetUser, mockFrom, mockUpsert } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockCreateClient = vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  }));
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn(() => ({
    upsert: mockUpsert,
  }));

  return {
    mockCreateClient,
    mockGetUser,
    mockFrom,
    mockUpsert,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { POST } from '@/app/api/admin/channels/route';

describe('Admin Channels API (/api/admin/channels)', () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalAdminKey = process.env.ADMIN_API_KEY;
  const originalAdminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  const originalNodeEnv = mutableEnv.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    mutableEnv.NODE_ENV = 'production';
    delete process.env.ADMIN_API_KEY;
    process.env.NEXT_PUBLIC_ADMIN_EMAILS = 'admin@promptfm.live';
    mockUpsert.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'admin@promptfm.live' } },
      error: null,
    });
  });

  afterEach(() => {
    if (originalAdminKey !== undefined) {
      process.env.ADMIN_API_KEY = originalAdminKey;
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

  it('rejects unauthenticated requests when production admin auth is not satisfied', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/channels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'set_status', slug: 'main', isActive: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('creates a channel for an allowlisted admin session without requiring ADMIN_API_KEY', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/channels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'sb-local-auth-token=mock-session-cookie',
      },
      body: JSON.stringify({
        action: 'create',
        slug: 'afterhours',
        name: 'After Hours',
        description: 'Late-night uncensored electronic cuts',
        djId: 'dj_cipher',
        is18Plus: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.channel.slug).toBe('afterhours');
    expect(json.channel.requires_age_gate).toBe(true);
    expect(json.channel.allow_explicit_24_7).toBe(true);
    expect(mockGetUser).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('channels');
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('updates channel active status for an allowlisted admin session', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/channels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'sb-local-auth-token=mock-session-cookie',
      },
      body: JSON.stringify({
        action: 'set_status',
        slug: 'cyberpunk',
        isActive: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.slug).toBe('cyberpunk');
    expect(json.is_active).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith({ slug: 'cyberpunk', is_active: true }, { onConflict: 'slug' });
  });
});
