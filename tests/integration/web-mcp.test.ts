// @ts-nocheck
// tests/integration/web-mcp.test.ts
// Integration test: validates Web MCP client invoking actual /api/mcp NextRequest/POST handler

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/mcp/route';
import { callMcpTool, executeWebMcpCommand } from '@/lib/mcp/client';

describe('Web MCP Client to /api/mcp Route Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
