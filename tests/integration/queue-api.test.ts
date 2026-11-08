// tests/integration/queue-api.test.ts
// Integration tests for multi-interface Queue (/q) across Discord, Telegram, Web MCP, and Radio API (Issue #86)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase admin client
const mockRequestsData = [
  {
    id: 'req_discord_1',
    platform: 'discord',
    platform_user_id: 'disc_user_99',
    platform_user_name: 'cyber_listener',
    type: 'song',
    content: 'dark synthwave retro 80s',
    target: null,
    batch_id: 'BATCH-18:15',
    status: 'scheduled',
    estimated_air_time: '2026-11-07T18:15:00.000Z',
    created_at: '2026-11-07T18:00:00.000Z',
  },
  {
    id: 'req_discord_2',
    platform: 'discord',
    platform_user_id: 'disc_user_100',
    platform_user_name: 'neo_coder',
    type: 'dedication',
    content: 'Happy Release Day!',
    target: 'alex',
    batch_id: 'BATCH-18:30',
    status: 'scheduled',
    estimated_air_time: '2026-11-07T18:30:00.000Z',
    created_at: '2026-11-07T18:02:00.000Z',
  },
];

let mockDbRequests: typeof mockRequestsData = [];

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'community_requests') {
        const builder: any = {
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation(async () => ({
            data: mockDbRequests,
            error: null,
          })),
          ilike: vi.fn((col: string, pattern: string) => {
            const raw = pattern.replace(/%/g, '').toLowerCase();
            const found = mockDbRequests.filter((r: any) =>
              String(r[col] || '').toLowerCase().includes(raw)
            );
            return {
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockImplementation(async () => ({
                  data: found,
                  error: null,
                })),
              }),
            };
          }),
          eq: vi.fn((col: string, val: string) => {
            const found = mockDbRequests.find((r: any) => r[col] === val);
            return {
              maybeSingle: vi.fn().mockResolvedValue({ data: found || null, error: null }),
              single: vi.fn().mockResolvedValue({ data: found || null, error: null }),
            };
          }),
          or: vi.fn(() => ({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockDbRequests[0] || null, error: null }),
              }),
            }),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockDbRequests[0] || null, error: null }),
          })),
          maybeSingle: vi.fn().mockResolvedValue({ data: mockDbRequests[0] || null, error: null }),
        };
        return {
          select: vi.fn().mockReturnValue(builder),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  })),
}));

// Mock rotation getUpNext
vi.mock('@/lib/dj/rotation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dj/rotation')>();
  return {
    ...actual,
    getUpNext: vi.fn().mockResolvedValue([
      {
        id: 'track-active-1',
        type: 'music',
        title: 'Neon Skyline',
        artist: 'Pulsewave',
        tool_used: 'Suno v3.5',
        audio_url: 'https://stream.promptfm.live/neon.mp3',
        upvotes_count: 7,
      },
    ]),
    getNowPlaying: vi.fn().mockResolvedValue({
      item: {
        id: 'playing-1',
        title: 'Live Now Track',
        artist: 'PromptFM Resident',
        type: 'music',
        audio_url: 'https://stream.promptfm.live/live.mp3',
        upvotes_count: 10,
      },
      startedAt: new Date().toISOString(),
      elapsedSeconds: 45,
      activeDJ: {
        id: 'dex',
        name: 'Dex',
        title: 'The Synthwave Specialist',
        voiceName: 'en-US-Journey-D',
      },
    }),
  };
});

import { POST as botWebhookPOST } from '@/app/api/bot/webhook/route';
import { POST as mcpPOST } from '@/app/api/mcp/route';
import { GET as radioNowGET } from '@/app/api/radio/now/route';
import { getUpNext } from '@/lib/dj/rotation';

describe('Multi-Interface /q and Queue Integration (Issue #86)', () => {
  beforeEach(() => {
    mockDbRequests = [...mockRequestsData];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true }),
      text: async () => 'OK',
    }) as unknown as typeof fetch;
  });

  describe('Discord Bot /q Slash Command', () => {
    it('returns scheduled community requests and upcoming tracks when listener runs /q', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: { name: 'q' },
          member: { user: { id: 'disc_user_99', username: 'cyber_listener' } },
        }),
      });

      const res = await botWebhookPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.type).toBe(4);
      const content = json.data.content;

      // Assert it contains upcoming music
      expect(content).toContain('Up Next on PromptFM');
      expect(content).toContain('Neon Skyline');
      expect(content).toContain('Pulsewave');

      // Assert it contains scheduled community requests (Fixes #86!)
      expect(content).toContain('Scheduled Community Requests');
      expect(content).toContain('dark synthwave retro 80s');
      expect(content).toContain('@cyber_listener');
      expect(content).toContain('BATCH-18:15');
      expect(content).toContain('18:15 UTC');
      expect(content).toContain('Happy Release Day!');
      expect(content).toContain('@alex');
    });

    it('returns non-blank informative pending/empty state when no tracks or requests are queued', async () => {
      mockDbRequests = [];
      vi.mocked(getUpNext).mockResolvedValueOnce([]);

      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: { name: 'q' },
          member: { user: { id: 'disc_user_99', username: 'cyber_listener' } },
        }),
      });

      const res = await botWebhookPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.type).toBe(4);
      const content = json.data.content;

      expect(content.trim()).not.toBe('⏭️ **Up Next on PromptFM:**');
      expect(content).toContain('No tracks currently queued');
      expect(content).toContain('/song');
    });

    it('handles /queue and /next and /n identically with scheduled request support', async () => {
      for (const cmd of ['queue', 'next', 'n']) {
        const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 2,
            data: { name: cmd },
            member: { user: { id: 'disc_user_99', username: 'cyber_listener' } },
          }),
        });

        const res = await botWebhookPOST(req);
        const json = await res.json();
        expect(json.data.content).toContain('Scheduled Community Requests');
        expect(json.data.content).toContain('dark synthwave retro 80s');
      }
    });
  });

  describe('Telegram Bot /q Text Command', () => {
    it('includes scheduled community requests in Telegram /q response', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 88,
            from: { id: 111, username: 'tg_listener' },
            chat: { id: 222 },
            text: '/q',
          },
        }),
      });

      const res = await botWebhookPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.queue).toBeDefined();
      expect(json.queue.scheduledRequests).toHaveLength(2);
    });
  });

  describe('Web MCP promptfm_get_up_next tool', () => {
    it('returns both upcoming tracks and scheduled community requests', async () => {
      const req = new NextRequest('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'promptfm_get_up_next',
            arguments: { channel: 'main', limit: 5 },
          },
        }),
      });

      const res = await mcpPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.result).toBeDefined();
      const content = JSON.parse(json.result.content[0].text);
      expect(content.upcoming_count).toBeGreaterThanOrEqual(1);
      expect(content.scheduled_count).toBe(2);
      expect(content.scheduled_requests).toHaveLength(2);
      expect(content.scheduled_requests[0].content).toBe('dark synthwave retro 80s');
      expect(content.formatted_discord).toContain('Scheduled Community Requests');
    });

    it('returns request lifecycle status via promptfm_get_request_status tool', async () => {
      const req = new NextRequest('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'promptfm_get_request_status',
            arguments: { query: 'dark synthwave', channel: 'main' },
          },
        }),
      });

      const res = await mcpPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.result).toBeDefined();
      const content = JSON.parse(json.result.content[0].text);
      expect(content.found).toBe(true);
      expect(content.request_id).toBe('req_discord_1');
      expect(content.status).toBeDefined();
      expect(content.message).toBeDefined();
    });
  });

  describe('Radio Now API /api/radio/now', () => {
    it('returns scheduled community requests alongside up_next array', async () => {
      const req = new NextRequest('http://localhost:3000/api/radio/now?channel=main');
      const res = await radioNowGET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.up_next).toBeDefined();
      expect(json.scheduled_requests).toBeDefined();
      expect(json.scheduled_requests).toHaveLength(2);
      expect(json.scheduled_requests[0].batch_id).toBe('BATCH-18:15');
    });
  });
});
