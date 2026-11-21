// tests/integration/unified-queue-ingestion.test.ts
// Integration tests verifying unified queueing, visibility, and airplay playback (Issue #276)
// Covers all 5 access axes: Web Song Library, WebMCP / MCP, Discord Bot, Telegram Bot, Terminal CLI.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as handleLibraryQueue } from '@/app/api/library/queue/route';
import { POST as handleMcpRequest } from '@/app/api/mcp/route';
import { POST as handleBotWebhook } from '@/app/api/bot/webhook/route';
import { GET as handleRadioNow } from '@/app/api/radio/now/route';
import { getStationQueue, formatQueueForCLI } from '@/lib/dj/queue';
import { getNextAirplayItem } from '@/lib/dj/rotation';
import { NextRequest } from 'next/server';

let testQueueItems: any[] = [];
let testTracks: any[] = [
  {
    id: 'track-cyberpunk-001',
    title: 'Neon Skyline Horizon',
    artist_name: 'SynthRider',
    audio_url: 'https://cdn.promptfm.live/cyber.mp3',
    tool_used: 'Suno',
    status: 'approved',
    upvotes_count: 55,
    cover_art_url: '/covers/cyber.png',
    category: 'Synthwave & Electro',
    is_explicit: false,
    family_friendly: true,
  },
  {
    id: 'track-lofi-002',
    title: 'Midnight Coffee Steam',
    artist_name: 'LofiHermit',
    audio_url: 'https://cdn.promptfm.live/coffee.mp3',
    tool_used: 'Udio',
    status: 'approved',
    upvotes_count: 40,
    cover_art_url: '/covers/coffee.png',
    category: 'Lofi Ambient',
    is_explicit: false,
    family_friendly: true,
  },
];

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => {
    const client = {
      rpc: async () => ({ data: [], error: null }),
      from: (table: string) => {
        if (table === 'tracks') {
          let filterId: string | null = null;
          let filterStatus: string | null = null;
          let filterIlike: string | null = null;

          const queryObj: any = {
            select: () => queryObj,
            eq: (col: string, val: any) => {
              if (col === 'id') filterId = val;
              if (col === 'status') filterStatus = val;
              return queryObj;
            },
            ilike: (col: string, pattern: string) => {
              filterIlike = pattern.replace(/%/g, '').toLowerCase();
              return queryObj;
            },
            order: () => queryObj,
            limit: () => queryObj,
            maybeSingle: async () => {
              let res = testTracks;
              if (filterId) res = res.filter((t) => t.id === filterId);
              if (filterStatus) res = res.filter((t) => t.status === filterStatus);
              if (filterIlike) res = res.filter((t) => t.title.toLowerCase().includes(filterIlike!));
              return { data: res[0] || null, error: null };
            },
            single: async () => {
              let res = testTracks;
              if (filterId) res = res.filter((t) => t.id === filterId);
              if (filterStatus) res = res.filter((t) => t.status === filterStatus);
              if (filterIlike) res = res.filter((t) => t.title.toLowerCase().includes(filterIlike!));
              return { data: res[0] || null, error: null };
            },
          };
          return queryObj;
        }

      if (table === 'channels') {
        return {
          select: () => ({
            eq: (_col: string, slug: string) => ({
              maybeSingle: async () => ({
                data: { id: `channel-${slug}`, slug, name: `${slug} Stage` },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'channel_queue') {
        return {
          insert: (data: any) => {
            const row = {
              id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              created_at: new Date().toISOString(),
              played_at: null,
              ...data,
            };
            testQueueItems.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          },
          select: () => ({
            eq: (_col: string, val: string) => ({
              is: (_nullCol: string, _nullVal: any) => ({
                order: (_orderCol: string, { ascending }: { ascending: boolean }) => ({
                  limit: async (lim: number) => {
                    const mapped = testQueueItems
                      .filter((item) => item.channel_id === val && item.played_at === null)
                      .map((item) => ({
                        ...item,
                        track: testTracks.find((t) => t.id === item.track_id) || null,
                      }));
                    return { data: mapped.slice(0, lim), error: null };
                  },
                }),
              }),
            }),
          }),
          update: (updates: any) => ({
            eq: (_col: string, val: string) => {
              const item = testQueueItems.find((i) => i.id === val);
              if (item) Object.assign(item, updates);
              return Promise.resolve({ data: item, error: null });
            },
          }),
        };
      }

      if (table === 'community_requests') {
        return {
          insert: (data: any) => ({
            select: () => ({
              single: async () => ({ data: { id: 'req-mock', ...data }, error: null }),
            }),
          }),
          select: () => ({
            in: () => ({
              not: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'station_state') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  airplay_item: { id: 'now-playing-default', title: 'Default', duration_hint_seconds: 180 },
                  staged_item: null,
                  started_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
          upsert: async () => ({ error: null }),
        };
      }

      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      };
    },
  };
  return client;
},
}));

describe('Unified Queue Ingestion Across All 5 Axes (Issue #276)', () => {
  beforeEach(() => {
    testQueueItems = [];
  });

  it('Axis 1: Web Song Library (/library/queue) queues track and displays in Up Next & Station Queue', async () => {
    // 1. Post request to /api/library/queue with trackId
    const req = new NextRequest('http://localhost/api/library/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: 'track-cyberpunk-001' }),
    });

    const res = await handleLibraryQueue(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.trackId).toBe('track-cyberpunk-001');
    expect(json.message).toContain('Neon Skyline Horizon');

    // 2. Verify track is in channel_queue
    expect(testQueueItems).toHaveLength(1);
    expect(testQueueItems[0].track_id).toBe('track-cyberpunk-001');

    // 3. Verify it is visible via /api/radio/now (telemetry feeder for web UpNextSection & AudioPlayer)
    const nowReq = new NextRequest('http://localhost/api/radio/now?channel=main');
    const nowRes = await handleRadioNow(nowReq);
    expect(nowRes.status).toBe(200);
    const nowJson = await nowRes.json();
    expect(nowJson.up_next).toBeDefined();
    expect(nowJson.up_next.length).toBeGreaterThanOrEqual(1);
    const queuedInUpNext = nowJson.up_next.find((item: any) => item.id === 'track-cyberpunk-001');
    expect(queuedInUpNext).toBeDefined();
    expect(queuedInUpNext.title).toBe('Neon Skyline Horizon');
    expect(queuedInUpNext.queue_position).toBe(1);

    // 4. Verify terminal station queue sees it
    const stationQueue = await getStationQueue({ channelSlug: 'main' });
    expect(stationQueue.hasItems).toBe(true);
    expect(stationQueue.upcoming[0]?.title).toBe('Neon Skyline Horizon');
    const cliOutput = formatQueueForCLI(stationQueue);
    expect(cliOutput).toContain('Neon Skyline Horizon');

    // 5. Verify rotation engine plays it next
    const playedItem = await getNextAirplayItem('main', true);
    expect(playedItem.id).toBe('track-cyberpunk-001');
    expect(playedItem.title).toBe('Neon Skyline Horizon');
    expect(testQueueItems[0].played_at).toBeDefined();
  });

  it('Axis 2 & 3: WebMCP & MCP tools queue song and verify upcoming queue', async () => {
    // 1. Queue song via promptfm_queue_song_request tool call
    const mcpQueueReq = new NextRequest('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-mcp-1',
        method: 'tools/call',
        params: {
          name: 'promptfm_queue_song_request',
          arguments: {
            prompt: 'cyberpunk skyline',
            requested_by: 'MCP Listener',
          },
        },
      }),
    });

    const mcpRes = await handleMcpRequest(mcpQueueReq);
    expect(mcpRes.status).toBe(200);
    const mcpJson = await mcpRes.json();
    expect(mcpJson.result).toBeDefined();
    const resultObj = JSON.parse(mcpJson.result.content[0].text);
    expect(resultObj.success).toBe(true);
    expect(resultObj.queue_position).toBe(1);

    // 2. Query up next via promptfm_get_up_next
    const mcpUpNextReq = new NextRequest('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-mcp-2',
        method: 'tools/call',
        params: {
          name: 'promptfm_get_up_next',
          arguments: { channel: 'main' },
        },
      }),
    });

    const upNextRes = await handleMcpRequest(mcpUpNextReq);
    expect(upNextRes.status).toBe(200);
    const upNextJson = await upNextRes.json();
    const upNextData = JSON.parse(upNextJson.result.content[0].text);
    expect(upNextData.upcoming_count).toBeGreaterThanOrEqual(1);
    expect(upNextData.up_next[0].title).toBe('Neon Skyline Horizon');
  });

  it('Axis 4: Discord /song slash command queues track and /queue inspects it', async () => {
    // 1. Submit Discord /song interaction
    const discordReq = new NextRequest('http://localhost/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2, // APPLICATION_COMMAND
        data: {
          name: 'song',
          options: [{ name: 'prompt', value: 'cyberpunk skyline' }],
        },
        member: { user: { username: 'DiscordGamer', id: 'disc-123' } },
      }),
    });

    const discordRes = await handleBotWebhook(discordReq);
    expect(discordRes.status).toBe(200);
    const discordJson = await discordRes.json();
    expect(discordJson.type).toBe(4);
    expect(discordJson.data.content).toContain('Neon Skyline Horizon');

    // 2. Discord /queue interaction
    const queueReq = new NextRequest('http://localhost/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2,
        data: { name: 'queue' },
        member: { user: { username: 'DiscordGamer', id: 'disc-123' } },
      }),
    });

    const queueRes = await handleBotWebhook(queueReq);
    expect(queueRes.status).toBe(200);
    const queueJson = await queueRes.json();
    expect(queueJson.data.content).toContain('Neon Skyline Horizon');
  });

  it('Axis 5: Telegram /song message queues track and /q inspects it', async () => {
    // 1. Submit Telegram /song message
    const tgReq = new NextRequest('http://localhost/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          message_id: 999,
          chat: { id: 112233 },
          from: { username: 'TelegramFan', id: 445566 },
          text: '/song cyberpunk skyline',
        },
      }),
    });

    const tgRes = await handleBotWebhook(tgReq);
    expect(tgRes.status).toBe(200);
    const tgJson = await tgRes.json();
    expect(tgJson.success).toBe(true);
    expect(tgJson.slot.confirmationMessage).toContain('Neon Skyline Horizon');

    // 2. Telegram /q message
    const tgQueueReq = new NextRequest('http://localhost/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          message_id: 1000,
          chat: { id: 112233 },
          from: { username: 'TelegramFan', id: 445566 },
          text: '/q',
        },
      }),
    });

    const tgQueueRes = await handleBotWebhook(tgQueueReq);
    expect(tgQueueRes.status).toBe(200);
    const tgQueueJson = await tgQueueRes.json();
    expect(tgQueueJson.success).toBe(true);
    expect(tgQueueJson.upcoming[0].title).toBe('Neon Skyline Horizon');
  });
});
