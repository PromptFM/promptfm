// tests/integration/report-api.test.ts
// Integration tests for the Content Reporting API endpoint

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/report/route';

describe('POST /api/report API Integration', () => {
  it('returns 400 Bad Request if target_id is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'copyright_dmca',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('target_id');
  });

  it('returns 400 Bad Request if reason is invalid', async () => {
    const req = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_id: 'track-123',
        reason: 'invalid_reason_code',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid report reason');
  });

  it('successfully creates report with valid payload and returns ticket ID', async () => {
    const req = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_type: 'track',
        target_id: 'test-track-api-success',
        reason: 'copyright_dmca',
        details: 'Copyright sample infringement reported via web integration',
        reporter_platform: 'web',
        reporter_id: 'integration_tester',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.reportId).toBeDefined();
    expect(json.reportId).toMatch(/^rep_/);
    expect(json.message).toContain('Report received');
  });
});

