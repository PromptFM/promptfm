// tests/integration/unified-song-pathway.test.ts
// Integration tests verifying unified song pathway across Discord, Telegram, MCP, and Admin API (Issue #43)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as botWebhookPOST } from '@/app/api/bot/webhook/route';
import { POST as mcpPOST } from '@/app/api/mcp/route';
import { GET as adminQueueGET, POST as adminQueuePOST, DELETE as adminQueueDELETE } from '@/app/api/admin/queue/route';

// Shared in-memory DB state for integration test
let mockQueue: any[] = [];
let mockRequests: any[] = [];
const mockTracks: any[] = [
  {
    id: 'track-cyber-1',
    title: 'Neon Odyssey',
    artist_name: 'CyberWave 2099',
    tool_used: 'Suno v3.5',
    audio_url: 'https://r2.promptfm.live/audio/neon-odyssey.mp3',
    status: 'approved',
    upvotes_count: 42,
    duration_seconds: 180,
  },
  {
    id: 'track-ambient-2',
    title: 'Midnight Rain',
    artist_name: 'Lofi Automaton',
    tool_used: 'Udio v1.5',
    audio_url: 'https://r2.promptfm.live/audio/midnight-rain.mp3',
    status: 'approved',
    upvotes_count: 19,
    duration_seconds: 210,
  },
];

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'channel_queue') {
        return {
          insert: (data: any) => {
            const row = {
              id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              created_at: new Date().toISOString(),
              played_at: null,
              ...data,
            };
            mockQueue.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          },
          select: () => ({
            eq: (col: string, val: any) => ({
              is: (nullCol: string, nullVal: any) => ({
                order: () => ({
                  limit: async (lim: number) => {
                    const filtered = mockQueue
                      .filter((i) => i[col] === val && i[nullCol] === nullVal)
                      .map((i) => ({
                        ...i,
                        track: mockTracks.find((t) => t.id === i.track_id) || null,
                      }));
                    return { data: filtered.slice(0, lim), error: null };
                  },
                }),
              }),
              eq: (col2: string, val2: any) => ({
                maybeSingle: async () => {
                  const item = mockQueue.find((i) => i[col] === val && i[col2] === val2 && i.played_at === null);
                  return { data: item || null, error: null };
                },
              }),
            }),
          }),
          delete: () => ({
            eq: (_col: string, val: string) => {
              mockQueue = mockQueue.filter((i) => i.id !== val);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      if (table === 'channels') {
        return {
          select: () => ({
            eq: (_col: string, slug: string) => ({
              maybeSingle: async () => ({ data: { id: 'channel-main-id', slug: 'main' }, error: null }),
              single: async () => ({ data: { id: 'channel-main-id', slug: 'main' }, error: null }),
            }),
          }),
        };
      }

      if (table === 'tracks') {
        return {
          select: () => ({
            eq: (col: string, val: any) => ({
              eq: (col2: string, val2: any) => ({
                maybeSingle: async () => {
                  const track = mockTracks.find((t) => t[col] === val && t[col2] === val2);
                  return { data: track || null, error: null };
                },
              }),
              ilike: (col2: string, pattern: string) => ({
                limit: () => ({
                  maybeSingle: async () => {
                    const clean = pattern.replace(/%/g, '').toLowerCase();
                    const track = mockTracks.find((t) => t[col] === val && t[col2].toLowerCase().includes(clean));
                    return { data: track || null, error: null };
                  },
                }),
              }),
              order: () => ({
                limit: () => ({
                  single: async () => ({ data: mockTracks[0], error: null }),
                  maybeSingle: async () => ({ data: mockTracks[0], error: null }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'community_requests') {
        return {
          insert: (data: any) => {
            const row = { id: `req-${Date.now()}`, ...data };
            mockRequests.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          },
        };
      }

      return {};
    },
  }),
}));

vi.mock('@/lib/dj/rag', () => ({
  findTracksByVibe: vi.fn().mockImplementation(async (query: string) => {
    if (query.toLowerCase().includes('cyber') || query.toLowerCase().includes('neon')) {
      return [{ ...mockTracks[0], similarity: 0.95, matchMethod: 'pgvector_semantic' }];
    }
    if (query.toLowerCase().includes('rain') || query.toLowerCase().includes('midnight')) {
      return [{ ...mockTracks[1], similarity: 0.91, matchMethod: 'pgvector_semantic' }];
    }
    return [];
  }),
}));

vi.mock('@/lib/dj/rotation', () => ({
  getNowPlaying: vi.fn().mockResolvedValue({
    item: { id: 'track-live-now', title: 'Live Now', artist: 'Resident' },
    activeDJ: { id: 'dj-sol', name: 'Sol' },
  }),
}));

describe('Unified Song Pathway Integration (Cross-Entrypoint Testing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue = [];
    mockRequests = [];
    process.env.TELEGRAM_BOT_TOKEN = 'mock_tg_token_123';

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      text: async () => 'OK',
    }) as unknown as typeof fetch;
  });

  it('Path 1 (Discord): queues a song via Discord /song interaction and confirms position & ETA', async () => {
    const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2, // Application Command
        id: 'interaction-discord-1',
        data: {
          name: 'song',
          options: [{ name: 'vibe', value: 'neon cyberpunk night' }],
        },
        member: {
          user: { id: 'disc-user-1', username: 'CyberGamer' },
        },
      }),
    });

    const res = await botWebhookPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.type).toBe(4);
    expect(json.data.content).toContain('Neon Odyssey');
    expect(json.data.content).toContain('Position: #1 (Up Next)');
    expect(json.data.content).toContain('Estimated:');

    // Confirm stored in channel_queue
    expect(mockQueue).toHaveLength(1);
    expect(mockQueue[0].track_id).toBe('track-cyber-1');
  });

  it('Path 2 (Telegram): queues a song via Telegram /song and responds with position & ETA', async () => {
    const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          message_id: 888,
          from: { id: 999, username: 'TelegramFan' },
          chat: { id: 777 },
          text: '/song midnight rain ambient',
        },
      }),
    });

    const res = await botWebhookPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.slot.confirmationMessage).toContain('Midnight Rain');
    expect(json.slot.confirmationMessage).toContain('Position: #1 (Up Next)');

    // Verify Telegram sendMessage fetch call
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org/bot'),
      expect.objectContaining({
        body: expect.stringContaining('Position: #1 (Up Next)'),
      })
    );
  });

  it('Path 3 (MCP): queues a song via promptfm_queue_song_request with accurate queue position and ETA', async () => {
    const req = new NextRequest('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'req-mcp-song-1',
        method: 'tools/call',
        params: {
          name: 'promptfm_queue_song_request',
          arguments: {
            prompt: 'neon cyberpunk fast',
            requested_by: 'Claude Code Agent',
            channel: 'main',
          },
        },
      }),
    });

    const res = await mcpPOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    const data = JSON.parse(json.result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.track.title).toBe('Neon Odyssey');
    expect(data.queue_position).toBe(1);
    expect(data.estimated_air_time).toBeDefined();
    expect(data.message).toContain('Position: #1 (Up Next)');
  });

  it('Cross-Path Deduplication: Prevents double-booking across Discord and Telegram', async () => {
    // 1. User queues track via Discord
    const discordReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        id: 'int-disc-dedup',
        data: { name: 'song', options: [{ value: 'Neon Odyssey' }] },
        member: { user: { id: 'u1', username: 'UserOne' } },
      }),
    });
    const dRes = await botWebhookPOST(discordReq);
    expect(dRes.status).toBe(200);
    expect(mockQueue).toHaveLength(1);

    // 2. Another user (or same user) requests same track via Telegram
    const teleReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          message_id: 999,
          from: { id: 222, username: 'UserTwo' },
          chat: { id: 333 },
          text: '/song Neon Odyssey',
        },
      }),
    });
    const tRes = await botWebhookPOST(teleReq);
    const tJson = await tRes.json();

    // Must return already_queued notification without pushing a second item
    expect(tJson.slot.confirmationMessage).toContain('already in the live queue');
    expect(tJson.slot.confirmationMessage).toContain('Position: #1');
    expect(mockQueue).toHaveLength(1); // Crucial: queue length did NOT increase!
  });

  it('Path 4 (Web Admin API): queues track via POST /api/admin/queue and inspects queue with ETAs via GET', async () => {
    // 1. Admin queues track via POST /api/admin/queue
    const postReq = new NextRequest('http://localhost:3000/api/admin/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track_id: 'track-ambient-2',
        channel: 'main',
        requested_by: 'Program Director',
      }),
    });

    const postRes = await adminQueuePOST(postReq);
    expect(postRes.status).toBe(200);
    const postJson = await postRes.json();
    expect(postJson.success).toBe(true);
    expect(postJson.result.track.title).toBe('Midnight Rain');
    expect(postJson.result.position).toBe(1);

    // 2. Admin retrieves queue with accurate live ETAs via GET /api/admin/queue
    const getReq = new NextRequest('http://localhost:3000/api/admin/queue?channel=main');
    const getRes = await adminQueueGET(getReq);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.success).toBe(true);
    expect(getJson.totalQueued).toBe(1);
    expect(getJson.items[0].track.title).toBe('Midnight Rain');
    expect(getJson.items[0].eta.formattedETA).toContain('Up Next');

    // 3. Admin removes item via DELETE /api/admin/queue
    const queueId = getJson.items[0].queueId;
    const delReq = new NextRequest('http://localhost:3000/api/admin/queue', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_id: queueId }),
    });
    const delRes = await adminQueueDELETE(delReq);
    expect(delRes.status).toBe(200);
    const delJson = await delRes.json();
    expect(delJson.success).toBe(true);
    expect(delJson.removed_id).toBe(queueId);
  });
});
