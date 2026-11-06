// tests/integration/mcp-flags.test.ts
// Integration tests for Model Context Protocol (MCP) Feature Flag tools

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/mcp/route';
import { resetFeatureFlagsForTesting, isFeatureEnabled } from '@/lib/flags/feature-flags';

describe('MCP Feature Flag Tools Integration', () => {
  beforeEach(() => {
    resetFeatureFlagsForTesting();
    vi.clearAllMocks();
  });

  it('lists all feature flags via promptfm_admin_list_feature_flags', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'mcp-flags-list-1',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_list_feature_flags',
          arguments: {},
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.result).toBeDefined();

    const data = JSON.parse(json.result.content[0].text);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.flags)).toBe(true);
    expect(data.flags.length).toBeGreaterThanOrEqual(9);
    expect(data.flags.some((f: { key: string }) => f.key === 'community_requests')).toBe(true);
  });

  it('updates a feature flag state via promptfm_admin_set_feature_flag', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'mcp-flags-set-1',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_set_feature_flag',
          arguments: {
            key: 'community_requests',
            enabled: false,
            notes: 'Paused by AI Admin via MCP due to scheduled maintenance',
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
    expect(data.flag.key).toBe('community_requests');
    expect(data.flag.enabled).toBe(false);
    expect(data.flag.updated_by).toBe('mcp_admin');
    expect(isFeatureEnabled('community_requests')).toBe(false);
  });
});

