// tests/integration/admin-reports-api.test.ts
// Integration tests for Station Admin Reports API (GET/POST /api/admin/reports)
// Verifies security boundaries, ADMIN_API_KEY authentication, input validation, and error handling.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, dynamic } from '@/app/api/admin/reports/route';
import { getRecentReports, resolveContentReport } from '@/lib/safety/reports';

vi.mock('@/lib/safety/reports', () => ({
  getRecentReports: vi.fn(),
  resolveContentReport: vi.fn(),
}));

const TEST_ADMIN_KEY = 'promptfm-secret-admin-key-xyz';

describe('Station Admin Reports API (/api/admin/reports)', () => {
  const originalEnv = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    vi.mocked(getRecentReports).mockResolvedValue([
      {
        id: 'rep_1',
        target_type: 'track',
        target_id: 'track-101',
        reason: 'hate_harassment',
        reporter_platform: 'web',
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(resolveContentReport).mockResolvedValue({
      success: true,
      reportId: 'rep_123',
      status: 'actioned',
      resolved_by: 'system_admin',
      resolved_at: '2026-11-06T23:00:00.000Z',
    });
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_API_KEY = originalEnv;
    } else {
      delete process.env.ADMIN_API_KEY;
    }
  });

  it('exports force-dynamic configuration for Next.js runtime', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  describe('Authentication Gate (ADMIN_API_KEY protection)', () => {
    it('GET: rejects unauthenticated requests with 401 when ADMIN_API_KEY is configured', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
      expect(getRecentReports).not.toHaveBeenCalled();
    });

    it('GET: rejects requests with invalid x-admin-key header', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
        headers: {
          'x-admin-key': 'wrong-key-value',
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
      expect(getRecentReports).not.toHaveBeenCalled();
    });

    it('GET: rejects requests with invalid Authorization Bearer token', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
        headers: {
          authorization: 'Bearer wrong-token',
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
      expect(getRecentReports).not.toHaveBeenCalled();
    });

    it('GET: rejects requests with invalid query parameter key', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports?key=wrong-key', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
      expect(getRecentReports).not.toHaveBeenCalled();
    });

    it('POST: rejects unauthenticated requests with 401 when ADMIN_API_KEY is configured', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: 'rep-1', action: 'dismissed' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
      expect(resolveContentReport).not.toHaveBeenCalled();
    });

    it('POST: rejects requests with invalid credentials', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports?key=bad-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: 'rep-1', action: 'actioned' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
      expect(resolveContentReport).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/reports (Authenticated)', () => {
    it('authorizes via x-admin-key header and returns reports', async () => {
      const mockReports = [
        {
          id: 'rep-101',
          target_type: 'track' as const,
          target_id: 'trk-1',
          reason: 'copyright_dmca' as const,
          reporter_platform: 'web' as const,
          status: 'pending' as const,
          created_at: '2026-03-01T12:00:00Z',
        },
      ];
      vi.mocked(getRecentReports).mockResolvedValue(mockReports);

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
      expect(json.reports).toEqual(mockReports);
      expect(getRecentReports).toHaveBeenCalledWith(30);
    });

    it('authorizes via Authorization: Bearer <key> header and custom limit param', async () => {
      vi.mocked(getRecentReports).mockResolvedValue([]);

      const req = new NextRequest('http://localhost:3000/api/admin/reports?limit=15', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(getRecentReports).toHaveBeenCalledWith(15);
    });

    it('authorizes via query parameter ?key=<key>', async () => {
      vi.mocked(getRecentReports).mockResolvedValue([]);

      const req = new NextRequest(`http://localhost:3000/api/admin/reports?key=${TEST_ADMIN_KEY}`, {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('allows access in local development when ADMIN_API_KEY is not set', async () => {
      delete process.env.ADMIN_API_KEY;
      vi.mocked(getRecentReports).mockResolvedValue([]);

      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it('returns HTTP 500 when getRecentReports throws an Error instance', async () => {
      vi.mocked(getRecentReports).mockRejectedValue(new Error('Database connectivity issue'));

      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
        headers: { 'x-admin-key': TEST_ADMIN_KEY },
      });

      const res = await GET(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Database connectivity issue');
    });

    it('returns HTTP 500 with String error when getRecentReports throws a non-Error object', async () => {
      vi.mocked(getRecentReports).mockRejectedValue('Fatal internal failure');

      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'GET',
        headers: { 'x-admin-key': TEST_ADMIN_KEY },
      });

      const res = await GET(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Fatal internal failure');
    });
  });

  describe('POST /api/admin/reports (Authenticated)', () => {
    it('authorizes via x-admin-key and returns 400 if reportId is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': TEST_ADMIN_KEY,
        },
        body: JSON.stringify({ action: 'actioned' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Missing reportId or action');
    });

    it('authorizes via x-admin-key and returns 400 if action is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': TEST_ADMIN_KEY,
        },
        body: JSON.stringify({ reportId: 'rep-99' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Missing reportId or action');
    });

    it('authorizes via Bearer token and successfully actions a report', async () => {
      const mockResult = {
        success: true,
        reportId: 'rep-500',
        status: 'actioned',
        notes: 'Track removed for DMCA',
        resolved_by: 'system_admin',
        resolved_at: '2026-11-06T23:00:00.000Z',
      };
      vi.mocked(resolveContentReport).mockResolvedValue(mockResult);

      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
        body: JSON.stringify({
          reportId: 'rep-500',
          action: 'actioned',
          notes: 'Track removed for DMCA',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(mockResult);
      expect(resolveContentReport).toHaveBeenCalledWith(
        'rep-500',
        'actioned',
        'Track removed for DMCA'
      );
    });

    it('authorizes via query key parameter and resolves report', async () => {
      const mockResult = {
        success: true,
        reportId: 'rep-501',
        status: 'dismissed',
        notes: undefined,
        resolved_by: 'system_admin',
        resolved_at: '2026-11-06T23:00:00.000Z',
      };
      vi.mocked(resolveContentReport).mockResolvedValue(mockResult);

      const req = new NextRequest(`http://localhost:3000/api/admin/reports?key=${TEST_ADMIN_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: 'rep-501',
          action: 'dismissed',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(resolveContentReport).toHaveBeenCalledWith('rep-501', 'dismissed', undefined);
    });

    it('allows POST in local dev when ADMIN_API_KEY is not configured', async () => {
      delete process.env.ADMIN_API_KEY;
      vi.mocked(resolveContentReport).mockResolvedValue({
        success: true,
        reportId: 'rep-dev',
        status: 'dismissed',
        resolved_by: 'system_admin',
        resolved_at: '2026-11-06T23:00:00.000Z',
      });

      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: 'rep-dev', action: 'dismissed' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it('returns HTTP 500 when resolveContentReport throws an Error instance', async () => {
      vi.mocked(resolveContentReport).mockRejectedValue(new Error('Supabase write failure'));

      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': TEST_ADMIN_KEY,
        },
        body: JSON.stringify({ reportId: 'rep-err', action: 'actioned' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Supabase write failure');
    });

    it('returns HTTP 500 with String error when resolveContentReport throws a non-Error object', async () => {
      vi.mocked(resolveContentReport).mockRejectedValue('Critical RPC crash');

      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': TEST_ADMIN_KEY,
        },
        body: JSON.stringify({ reportId: 'rep-err', action: 'actioned' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Critical RPC crash');
    });
  });
});
