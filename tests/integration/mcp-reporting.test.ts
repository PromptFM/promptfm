// tests/integration/mcp-reporting.test.ts
// Integration tests for Model Context Protocol (MCP) promptfm_report_content tool

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/mcp/route';

describe('MCP Content Reporting Tool Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
      text: async () => 'OK',
    }) as unknown as typeof fetch;
  });

  it('files a report via promptfm_report_content MCP tool', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-1',
        method: 'tools/call',
        params: {
          name: 'promptfm_report_content',
          arguments: {
            target_type: 'track',
            target_id: 'mcp-track-flagged-uuid',
            reason: 'copyright_dmca',
            details: 'AI generation replicates copyrighted human recording',
            reporter_id: 'AutonomousAuditorAgent',
          },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.result.content).toBeDefined();

    const data = JSON.parse(json.result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.ticket_id).toBeDefined();
    expect(data.ticket_id).toMatch(/^rep_/);
    expect(data.status).toBe('pending_moderation');
  });

  it('rejects MCP report if target_id or reason is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-2',
        method: 'tools/call',
        params: {
          name: 'promptfm_report_content',
          arguments: {
            // Missing target_id
            reason: 'copyright_dmca',
          },
        },
      }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.result).toBeDefined();
    expect(json.result.isError).toBe(true);
    expect(json.result.content[0].text).toContain('required');
  });
});
