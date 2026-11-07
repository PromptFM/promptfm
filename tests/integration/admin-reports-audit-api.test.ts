// tests/integration/admin-reports-audit-api.test.ts
// Integration tests for Station Admin Reports Audit API
// Validates security gates, unauthenticated window audit detection, and metadata persistence.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getReportsAuditEndpoint } from '@/app/api/admin/reports/audit/route';
import { GET as getReportsRoute, POST as postReportsRoute } from '@/app/api/admin/reports/route';
import {
  auditContentReports,
  resolveContentReport,
  clearMemoryReportsForTesting,
  getRecentReports,
} from '@/lib/safety/reports';

vi.mock('@/lib/safety/reports', () => ({
  auditContentReports: vi.fn(),
  resolveContentReport: vi.fn(),
  getRecentReports: vi.fn(),
  clearMemoryReportsForTesting: vi.fn(),
}));

const TEST_ADMIN_KEY = 'promptfm-super-secret-admin-key-audit';

describe('Admin Reports Audit API Integration', () => {
  const originalEnv = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_API_KEY = originalEnv;
    } else {
      delete process.env.ADMIN_API_KEY;
    }
  });

  describe('GET /api/admin/reports/audit', () => {
    it('rejects unauthenticated requests with HTTP 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/reports/audit', {
        method: 'GET',
      });

      const res = await getReportsAuditEndpoint(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
      expect(auditContentReports).not.toHaveBeenCalled();
    });

    it('returns audit report summary when authenticated via Bearer token', async () => {
      const mockAuditResult = {
        total_reports: 10,
        pending_count: 3,
        actioned_count: 4,
        dismissed_count: 3,
        unaudited_count: 2,
        suspicious_count: 1,
        flagged_items: [
          {
            report: {
              id: 'rep_suspicious_1',
              target_type: 'track',
              target_id: 'trk_999',
              reason: 'copyright_dmca',
              reporter_platform: 'web',
              status: 'dismissed',
              created_at: '2026-11-05T12:00:00.000Z',
            },
            severity: 'high',
            issue: 'suspicious_dismissal',
            message: 'DMCA report rep_suspicious_1 was dismissed without actor attribution or timestamp.',
            recommendation: 'Verify copyright claim against target track trk_999 immediately.',
          },
        ],
        clean: false,
        timestamp: '2026-11-06T23:00:00.000Z',
      };
      vi.mocked(auditContentReports).mockResolvedValue(mockAuditResult as any);

      const req = new NextRequest('http://localhost:3000/api/admin/reports/audit?limit=50', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
      });

      const res = await getReportsAuditEndpoint(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.audit).toEqual(mockAuditResult);
      expect(auditContentReports).toHaveBeenCalledWith({ limit: 50 });
    });

    it('returns HTTP 500 when auditContentReports throws an error', async () => {
      vi.mocked(auditContentReports).mockRejectedValue(new Error('Audit RPC query failure'));

      const req = new NextRequest('http://localhost:3000/api/admin/reports/audit', {
        method: 'GET',
        headers: {
          'x-admin-key': TEST_ADMIN_KEY,
        },
      });

      const res = await getReportsAuditEndpoint(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Audit RPC query failure');
    });
  });

  describe('GET /api/admin/reports?audit=true', () => {
    it('returns audit report when ?audit=true parameter is present', async () => {
      const mockAuditResult = {
        total_reports: 5,
        pending_count: 5,
        actioned_count: 0,
        dismissed_count: 0,
        unaudited_count: 0,
        suspicious_count: 0,
        flagged_items: [],
        clean: true,
        timestamp: '2026-11-06T23:00:00.000Z',
      };
      vi.mocked(auditContentReports).mockResolvedValue(mockAuditResult as any);

      const req = new NextRequest('http://localhost:3000/api/admin/reports?audit=true', {
        method: 'GET',
        headers: {
          authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
      });

      const res = await getReportsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.audit).toEqual(mockAuditResult);
      expect(auditContentReports).toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/reports with actor attribution', () => {
    it('passes actor into resolveContentReport when actor is provided in payload', async () => {
      vi.mocked(resolveContentReport).mockResolvedValue({
        success: true,
        reportId: 'rep_100',
        status: 'actioned',
        notes: 'Confirmed infringement',
        resolved_by: 'compliance_officer_alex',
        resolved_at: '2026-11-06T23:00:00.000Z',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/admin/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${TEST_ADMIN_KEY}`,
        },
        body: JSON.stringify({
          reportId: 'rep_100',
          action: 'actioned',
          notes: 'Confirmed infringement',
          actor: 'compliance_officer_alex',
        }),
      });

      const res = await postReportsRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(resolveContentReport).toHaveBeenCalledWith(
        'rep_100',
        'actioned',
        'Confirmed infringement',
        'compliance_officer_alex'
      );
    });
  });
});
