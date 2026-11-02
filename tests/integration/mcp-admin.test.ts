// tests/integration/mcp-admin.test.ts
// Integration tests for Model Context Protocol (MCP) admin tools

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/mcp/route';
import { submitContentReport } from '@/lib/safety/reports';

describe('MCP Admin Tools Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
      text: async () => 'OK',
    }) as unknown as typeof fetch;
  });

  it('resolves a report via promptfm_admin_resolve_report tool', async () => {
    const rep = await submitContentReport({
      target_type: 'track',
      target_id: 'mcp-track-to-resolve',
      reason: 'hate_harassment',
      details: 'Offensive speech in AI generation',
      reporter_platform: 'mcp',
    });

    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-admin-1',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_resolve_report',
          arguments: {
            report_id: rep.reportId,
            action: 'actioned',
            notes: 'Quarantined and removed from station airplay',
          },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();

    const data = JSON.parse(json.result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.report_id).toBe(rep.reportId);
    expect(data.action).toBe('actioned');
  });

  it('removes an item from the live queue via promptfm_admin_remove_from_queue', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-admin-2',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_remove_from_queue',
          arguments: {
            queue_id: 'queue-item-uuid-1234',
          },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();

    const data = JSON.parse(json.result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.queue_id).toBe('queue-item-uuid-1234');
  });

  it('lists community requests via promptfm_admin_list_requests', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-admin-3',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_list_requests',
          arguments: {
            limit: 10,
          },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();

    const data = JSON.parse(json.result.content[0].text);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.requests)).toBe(true);
  });
});

