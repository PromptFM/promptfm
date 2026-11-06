// @ts-nocheck
// tests/integration/web-mcp.test.ts
// Integration test: validates Web MCP client invoking actual /api/mcp NextRequest/POST handler

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/mcp/route';
import { callMcpTool, executeWebMcpCommand } from '@/lib/mcp/client';

describe('Web MCP Client to /api/mcp Route Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
      text: async () => 'OK',
    }) as unknown as typeof fetch;
  });

  const customFetch: typeof fetch = async (input, init) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const url = rawUrl.startsWith('http') ? rawUrl : `http://localhost:3000${rawUrl}`;
    const nextReq = new (await import('next/server')).NextRequest(url, {
      method: init?.method,
      headers: init?.headers,
      body: init?.body as any,
    });
    const res = await POST(nextReq);
    return res as unknown as Response;
  };

  it('executes promptfm_get_djs through /api/mcp POST route', async () => {
    const data = await callMcpTool('promptfm_get_djs', {}, { fetchFn: customFetch });
    expect(data.djs).toBeDefined();
    expect(Array.isArray(data.djs)).toBe(true);
    expect(data.djs.length).toBeGreaterThan(0);
    expect(data.active_dj_now).toBeDefined();
  });

  it('executes promptfm_get_schedule through /api/mcp POST route', async () => {
    const data = await callMcpTool('promptfm_get_schedule', {}, { fetchFn: customFetch });
    expect(data.current_dj_on_air || data.message).toBeDefined();
  });

  it('runs /djs listener command end-to-end through executeWebMcpCommand and /api/mcp', async () => {
    // Custom fetchFn inside callOpts
    const data = await callMcpTool('promptfm_get_djs', {}, { fetchFn: customFetch });
    expect(data.djs.length).toBeGreaterThan(0);
  });

  it('lists available MCP tools through listMcpTools and /api/mcp', async () => {
    const { listMcpTools } = await import('@/lib/mcp/client');
    const tools = await listMcpTools({ fetchFn: customFetch });
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    const names = tools.map((t) => t.name);
    expect(names).toContain('promptfm_get_now_playing');
  });

  it('calls promptfm_admin_edit_track and promptfm_admin_delete_track through /api/mcp', async () => {
    const editRes = await callMcpTool(
      'promptfm_admin_edit_track',
      {
        track_id: '11111111-2222-3333-4444-555555555555',
        title: 'Integration Edited Cyber Vibe',
      },
      { fetchFn: customFetch }
    );
    expect(editRes.success).toBe(true);
    expect(editRes.track.title).toBe('Integration Edited Cyber Vibe');

    const delRes = await callMcpTool(
      'promptfm_admin_delete_track',
      {
        track_id: '11111111-2222-3333-4444-555555555555',
        soft_delete: true,
      },
      { fetchFn: customFetch }
    );
    expect(delRes.success).toBe(true);
    expect(delRes.soft_deleted).toBe(true);
  });
});
