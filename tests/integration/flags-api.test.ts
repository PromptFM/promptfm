// tests/integration/flags-api.test.ts
// Integration tests for /api/admin/flags and /api/flags

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getAdminFlags, POST as postAdminFlags, PATCH as patchAdminFlags } from '@/app/api/admin/flags/route';
import { GET as getPublicFlags } from '@/app/api/flags/route';
import { resetFeatureFlagsForTesting, setFeatureFlag } from '@/lib/flags/feature-flags';

const TEST_ADMIN_KEY = 'secret-admin-key-flags-48';

describe('Feature Flags API Routes (/api/admin/flags & /api/flags)', () => {
  const originalAdminKey = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    resetFeatureFlagsForTesting();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalAdminKey !== undefined) {
      process.env.ADMIN_API_KEY = originalAdminKey;
    } else {
      delete process.env.ADMIN_API_KEY;
    }
    resetFeatureFlagsForTesting();
  });

  describe('GET /api/admin/flags', () => {
    it('denies unauthenticated requests with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/flags');
      const res = await getAdminFlags(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('returns all feature flags and metadata when authenticated via Bearer token', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/flags', {
        headers: { authorization: `Bearer ${TEST_ADMIN_KEY}` },
      });
      const res = await getAdminFlags(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.flags)).toBe(true);
      expect(json.flags.length).toBeGreaterThanOrEqual(9);
      expect(json.flags.some((f: { key: string }) => f.key === 'community_requests')).toBe(true);
    });

    it('filters flags by category query parameter', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/flags?category=community', {
        headers: { authorization: `Bearer ${TEST_ADMIN_KEY}` },
      });
      const res = await getAdminFlags(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.flags.every((f: { category: string }) => f.category === 'community')).toBe(true);
    });
  });

  describe('POST /api/admin/flags', () => {
    it('denies unauthenticated POST requests with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'community_requests', enabled: false }),
      });
      const res = await postAdminFlags(req);
      expect(res.status).toBe(401);
    });

    it('validates request payload and rejects invalid inputs with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
        body: JSON.stringify({ key: 'unknown_flag_xyz', enabled: false }),
      });
      const res = await postAdminFlags(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('updates a feature flag successfully with actor attribution and notes', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
        body: JSON.stringify({
          key: 'community_requests',
          enabled: false,
          notes: 'Queue overload incident #48',
          actor: 'oncall@promptfm.live',
        }),
      });
      const res = await postAdminFlags(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.flag.key).toBe('community_requests');
      expect(json.flag.enabled).toBe(false);
      expect(json.flag.updated_by).toBe('oncall@promptfm.live');
      expect(json.flag.notes).toBe('Queue overload incident #48');
    });
  });

  describe('PATCH /api/admin/flags', () => {
    it('toggles a feature flag successfully', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/flags', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
        body: JSON.stringify({
          key: 'ai_dj_speech',
          notes: 'Toggling AI speech for studio live broadcast',
        }),
      });
      const res = await patchAdminFlags(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.flag.enabled).toBe(false);
    });
  });

  describe('GET /api/flags (Public Read Endpoint)', () => {
    it('returns a public dictionary of enabled flags without requiring admin credentials', async () => {
      await setFeatureFlag({
        key: 'community_requests',
        enabled: false,
        actor: 'admin',
      });

      const req = new NextRequest('http://localhost:3000/api/flags');
      const res = await getPublicFlags(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.flags).toBeDefined();
      expect(json.flags.community_requests).toBe(false);
      expect(json.flags.live_audio_stream).toBe(true);
      expect(json.flags.maintenance_mode).toBe(false);
    });
  });
});

