import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/status/route';
import { NextRequest } from 'next/server';

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
});
