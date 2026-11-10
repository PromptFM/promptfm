import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/status/route';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

describe('GET /api/status API Integration', () => {
  it('returns HTTP 200 with JSON health report', async () => {
    const req = new Request('http://localhost:3000/api/status');
    const response = await GET(req as any);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toContain('s-maxage=10');

    const data = await response.json();
    expect(data.status).toMatch(/all_operational|degraded_performance|major_outage/);
    expect(data.services).toHaveLength(5);
    expect(data.uptimePercentage).toBeGreaterThan(90);
    expect(data.timestamp).toBeTruthy();
  });

  it('supports format=badge parameter for Shields.io dynamic status badge', async () => {
    const req = new NextRequest('http://localhost:3000/api/status?format=badge');
    const response = await GET(req);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Shields.io endpoint schema
    expect(data.schemaVersion).toBe(1);
    expect(data.label).toBe('PromptFM Status');
    expect(data.message).toBeTruthy();
    expect(data.color).toMatch(/brightgreen|yellow|red/);
  });

  it('supports format=svg parameter returning direct image/svg+xml badge', async () => {
    const req = new NextRequest('http://localhost:3000/api/status?format=svg');
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/svg+xml');
    expect(response.headers.get('cache-control')).toContain('public');
    const body = await response.text();
    expect(body).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(body).toContain('PROMPTFM STATUS');
    expect(body).toMatch(/OPERATIONAL|DEGRADED|OUTAGE/);
  });

  it('returns outage SVG badge with HTTP 200 when checkSystemHealth throws in format=svg mode', async () => {
    const healthChecker = await import('@/lib/status/health-checker');
    const spy = vi.spyOn(healthChecker, 'checkSystemHealth').mockRejectedValueOnce(new Error('Database timeout'));

    const req = new NextRequest('http://localhost:3000/api/status?format=svg');
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/svg+xml');
    const body = await response.text();
    expect(body).toContain('OUTAGE');
    expect(body).toContain('#e05d44');

    spy.mockRestore();
  });

  it('keeps /api/status as the richer smoke endpoint alongside a dedicated /api/healthz readiness route', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/status'));
    const data = await response.json();

    expect(Array.isArray(data.services)).toBe(true);
    expect(data.services.length).toBeGreaterThan(1);
    expect(fs.existsSync(path.resolve(__dirname, '../../src/app/api/healthz/route.ts'))).toBe(true);
  });
});
