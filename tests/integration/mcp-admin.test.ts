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
    expect(data.resolved_by).toBe('mcp_admin');
    expect(data.resolved_at).toBeDefined();
  });

  it('audits reports via promptfm_admin_audit_reports tool', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-audit-1',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_audit_reports',
          arguments: {
            limit: 25,
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
    expect(data.audit).toBeDefined();
    expect(typeof data.audit.total_reports).toBe('number');
    expect(typeof data.audit.clean).toBe('boolean');
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

  it('creates an 18+ channel with automated guardrails via promptfm_admin_create_channel', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-admin-create-ch',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_create_channel',
          arguments: {
            slug: 'underground',
            name: 'Underground Beats',
            description: 'Unfiltered electronic tracks',
            is_18_plus: true,
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
    expect(data.channel.slug).toBe('underground');
    expect(data.channel.requires_age_gate).toBe(true);
    expect(data.channel.allow_explicit_24_7).toBe(true);
    expect(data.channel.min_age).toBe(18);
    expect(data.channel.age_gate_disclaimer).toContain('18 years of age');
  });

  it('lists channels with guardrail policies via promptfm_admin_list_channels', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-admin-list-ch',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_list_channels',
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
    expect(Array.isArray(data.channels)).toBe(true);
    expect(data.channels.length).toBeGreaterThanOrEqual(4);
  });

  it('starts YouTube stream via promptfm_admin_start_stream', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-start-stream',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_start_stream',
          arguments: {
            platform: 'youtube',
            stream_key: 'xxxx-yyyy-zzzz-aaaa',
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
    expect(data.session.platform).toBe('youtube');
  });

  it('stops a live stream via promptfm_admin_stop_stream', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-stop-stream',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_stop_stream',
          arguments: {
            platform: 'youtube',
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
  });

  it('queries live stream statuses via promptfm_admin_get_stream_status', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-status-stream',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_get_stream_status',
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
    expect(data.sessions).toBeDefined();
  });

  it('updates track metadata via promptfm_admin_edit_track', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-edit-track',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_edit_track',
          arguments: {
            track_id: '11111111-2222-3333-4444-555555555555',
            title: 'Updated Cyber Anthem',
            artist_name: 'Neon DJ 2.0',
            category: 'Cyberpunk & Synth',
            lyrics: 'Neon city lights, midnight rides',
            is_explicit: false,
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
    expect(data.track).toBeDefined();
    expect(data.track.title).toBe('Updated Cyber Anthem');
  });

  it('deletes a track via promptfm_admin_delete_track', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-delete-track',
        method: 'tools/call',
        params: {
          name: 'promptfm_admin_delete_track',
          arguments: {
            track_id: '11111111-2222-3333-4444-555555555555',
            soft_delete: false,
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
    expect(data.deleted_id).toBe('11111111-2222-3333-4444-555555555555');
  });
});

