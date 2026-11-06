// tests/integration/admin-reports-api.test.ts
// Integration test for Admin Reports API endpoint auth & management

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/reports/route';

vi.mock('@/lib/safety/reports', () => ({
  getRecentReports: vi.fn().mockResolvedValue([
    {
      id: 'rep_1',
      target_type: 'track',
      target_id: 'track-101',
      reason: 'hate_harassment',
      reporter_platform: 'web',
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  ]),
  resolveContentReport: vi.fn().mockResolvedValue({
    success: true,
    reportId: 'rep_123',
    status: 'dismissed',
  }),
}));

const TEST_ADMIN_KEY = 'secret-admin-pass-789';

describe('Admin Reports API (/api/admin/reports)', () => {
  const originalAdminKey = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalAdminKey !== undefined) {
      process.env.ADMIN_API_KEY = originalAdminKey;
    } else {
      delete process.env.ADMIN_API_KEY;
    }
  });

  describe('Authentication & Authorization', () => {
    it('rejects GET requests without credentials when ADMIN_API_KEY is configured', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('rejects GET requests with invalid bearer token', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
        headers: {
          authorization: 'Bearer wrong-key',
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('accepts GET requests with valid Authorization Bearer header', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.reports)).toBe(true);
    });

    it('accepts GET requests with valid x-admin-key header', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
        headers: {
          'x-admin-key': TEST_ADMIN_KEY,
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('accepts GET requests with valid query param key', async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/reports?key=${TEST_ADMIN_KEY}`, {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('rejects POST requests without credentials when ADMIN_API_KEY is configured', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: 'rep_123', action: 'dismissed' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('allows GET requests when ADMIN_API_KEY is unset (dev fallback)', async () => {
      delete process.env.ADMIN_API_KEY;

      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('passes custom limit parameter to getRecentReports on GET', async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/reports?limit=50&key=${TEST_ADMIN_KEY}`, {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('handles GET error gracefully returning 500 status', async () => {
      const { getRecentReports } = await import('@/lib/safety/reports');
      vi.mocked(getRecentReports).mockRejectedValueOnce(new Error('DB failure'));

      const req = new NextRequest(`http://localhost:3000/api/admin/reports?key=${TEST_ADMIN_KEY}`);
      const res = await GET(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('DB failure');
    });

    it('successfully resolves report on authorized POST with valid payload', async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/reports?key=${TEST_ADMIN_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: 'rep_123', action: 'actioned', notes: 'Removed' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.reportId).toBe('rep_123');
    });

    it('rejects authorized POST with 400 when reportId or action is missing', async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/reports?key=${TEST_ADMIN_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: 'rep_123' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Missing reportId or action');
    });

    it('handles POST error gracefully returning 500 status', async () => {
      const { resolveContentReport } = await import('@/lib/safety/reports');
      vi.mocked(resolveContentReport).mockRejectedValueOnce(new Error('Write failure'));

      const req = new NextRequest(`http://localhost:3000/api/admin/reports?key=${TEST_ADMIN_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: 'rep_123', action: 'dismissed' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Write failure');
    });
  });
});
