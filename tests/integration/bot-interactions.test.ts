// tests/integration/bot-interactions.test.ts
// Integration tests for Discord & Telegram bot commands, voting callbacks, and listener requests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/dj/batches', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dj/batches')>();
  return {
    ...actual,
    scheduleListenerRequest: vi.fn().mockImplementation(async (payload) => ({
      requestId: 'req_test_123',
      batchId: 'BATCH-12:30',
      estimatedAirTime: '12:30 UTC',
      confirmationMessage: `✅ Accepted for ${payload.type}`,
      isRejected: false,
      request: {
        id: 'req_test_123',
        type: payload.type,
        target: payload.target,
        content: payload.content,
      },
    })),
  };
});

import { POST } from '@/app/api/bot/webhook/route';

describe('Discord & Telegram Interactive Bot Commands Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 'req_test_123', success: true }),
      text: async () => 'OK',
    }) as unknown as typeof fetch;
  });

  describe('Telegram Bot Commands', () => {
    it('handles Telegram /nowplaying command and returns current on-air metadata', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 101,
            from: { id: 111, username: 'cyber_listener' },
            chat: { id: 222 },
            text: '/nowplaying',
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.now_playing).toBeDefined();
      expect(json.now_playing.item).toBeDefined();
      expect(json.now_playing.activeDJ).toBeDefined();
    });

    it('handles Telegram /next command and returns upcoming schedule queue', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 102,
            from: { id: 111, username: 'cyber_listener' },
            chat: { id: 222 },
            text: '/next',
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.upcoming)).toBe(true);
    });

    it('handles Telegram inline button click vote:<id> and registers upvote', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query: {
            id: 'cb_vote_888',
            from: { id: 777, username: 'synth_fan' },
            data: 'vote:demo-fallback',
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.voter).toBe('synth_fan');
      expect(json.voteResult.success).toBe(true);
      expect(json.voteResult.title).toBe('PromptFM Ambient AI Anthem');
    });

    it('handles Telegram /dedicate command and queues listener request', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 103,
            from: { id: 333, username: 'romantic_listener' },
            chat: { id: 444 },
            text: '/dedicate @Elena Happy anniversary from PromptFM!',
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.slot).toBeDefined();
      expect(json.slot.batchId).toBe('BATCH-12:30');
      expect(json.slot.confirmationMessage).toContain('dedication');
    });

    it('handles Telegram /song command and schedules track vibe request', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 104,
            from: { id: 555, username: 'bass_head' },
            chat: { id: 666 },
            text: '/song heavy industrial dark synth with punchy kicks',
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.slot).toBeDefined();
      expect(json.slot.batchId).toBe('BATCH-12:30');
      expect(json.slot.confirmationMessage).toContain('song');
    });

    it('handles Telegram /help and /start commands returning interactive commands guide and schedule slots', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 105,
            from: { id: 777, username: 'new_listener' },
            chat: { id: 888 },
            text: '/help',
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.help_text).toBeDefined();
      expect(json.help_text).toContain('/song');
      expect(json.help_text).toContain('/queue');
      expect(json.help_text).toContain(':45'); // Mentions listener showcase slot
    });

    it('handles all shorthand Telegram commands: /np, /q, /n, /s, /d, /w, /z, /r, /h', async () => {
      // /np
      const npReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 201,
            from: { id: 111, username: 'quick_user' },
            chat: { id: 222 },
            text: '/np',
          },
        }),
      });
      const npRes = await POST(npReq);
      expect((await npRes.json()).success).toBe(true);

      // /q
      const qReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 202,
            from: { id: 111, username: 'quick_user' },
            chat: { id: 222 },
            text: '/q',
          },
        }),
      });
      const qRes = await POST(qReq);
      expect((await qRes.json()).success).toBe(true);

      // /n
      const nReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 203,
            from: { id: 111, username: 'quick_user' },
            chat: { id: 222 },
            text: '/n',
          },
        }),
      });
      const nRes = await POST(nReq);
      expect((await nRes.json()).success).toBe(true);

      // /s
      const sReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 204,
            from: { id: 111, username: 'quick_user' },
            chat: { id: 222 },
            text: '/s synthwave beat',
          },
        }),
      });
      const sRes = await POST(sReq);
      const sJson = await sRes.json();
      expect(sJson.success).toBe(true);
      expect(sJson.slot.request.type).toBe('song');

      // /d
      const dReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 205,
            from: { id: 111, username: 'quick_user' },
            chat: { id: 222 },
            text: '/d Alex You rock!',
          },
        }),
      });
      const dRes = await POST(dReq);
      const dJson = await dRes.json();
      expect(dJson.success).toBe(true);
      expect(dJson.slot.request.type).toBe('dedication');

      // /w
      const wReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 206,
            from: { id: 111, username: 'quick_user' },
            chat: { id: 222 },
            text: '/w Paris',
          },
        }),
      });
      const wRes = await POST(wReq);
      const wJson = await wRes.json();
      expect(wJson.success).toBe(true);
      expect(wJson.slot.request.type).toBe('weather');

      // /z
      const zReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 207,
            from: { id: 111, username: 'quick_user' },
            chat: { id: 222 },
            text: '/z Leo',
          },
        }),
      });
      const zRes = await POST(zReq);
      const zJson = await zRes.json();
      expect(zJson.success).toBe(true);
      expect(zJson.slot.request.type).toBe('zodiac');

      // /r
      const rReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 208,
            from: { id: 111, username: 'quick_user' },
            chat: { id: 222 },
            text: '/r track-999 offensive lyrics',
          },
        }),
      });
      const rRes = await POST(rReq);
      const rJson = await rRes.json();
      expect(rJson.success).toBe(true);
      expect(rJson.report).toBeDefined();

      // /h
      const hReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            message_id: 209,
            from: { id: 111, username: 'quick_user' },
            chat: { id: 222 },
            text: '/h',
          },
        }),
      });
      const hRes = await POST(hReq);
      const hJson = await hRes.json();
      expect(hJson.success).toBe(true);
      expect(hJson.help_text).toBeDefined();
    });
  });

  describe('Discord Interactive Components & Slash Commands', () => {
    it('handles Discord Button click vote:<trackId> (Type 3) and returns ephemeral response', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 3, // MessageComponent
          data: {
            custom_id: 'vote:demo-fallback',
          },
          member: {
            user: { id: 'discord_listener_42', username: 'ElectroHead' },
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.type).toBe(4); // ChannelMessageWithSource
      expect(json.data.flags).toBe(64); // Ephemeral
      expect(json.data.content).toContain('You upvoted');
      expect(json.data.content).toContain('PromptFM Ambient AI Anthem');
    });

    it('handles Discord /nowplaying Application Command (Type 2)', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2, // ApplicationCommand
          data: {
            name: 'nowplaying',
          },
          member: {
            user: { id: 'discord_listener_99', username: 'Audiophile' },
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.type).toBe(4);
      expect(json.data.content).toContain('Now Playing on PromptFM');
      expect(json.data.components).toBeDefined();
    });

    it('handles Discord Ping (Type 1) and responds with Pong { type: 1 } for verification', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 1 }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.type).toBe(1);
    });

    it('rejects Discord interaction with 401 if X-Signature-Ed25519 is invalid', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': '00'.repeat(64),
          'X-Signature-Timestamp': '1710000000',
        },
        body: JSON.stringify({ type: 1 }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Invalid request signature');
    });

    it('accepts Discord Ping with 200 { type: 1 } when valid Ed25519 signature headers are provided', async () => {
      const crypto = await import('crypto');
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      const pubKeyHex = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
      const oldKey = process.env.DISCORD_PUBLIC_KEY;
      process.env.DISCORD_PUBLIC_KEY = pubKeyHex;

      try {
        const timestamp = '1710000000';
        const rawBody = JSON.stringify({ type: 1 });
        const message = Buffer.from(timestamp + rawBody);
        const signature = crypto.sign(null, message, privateKey).toString('hex');

        const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Signature-Ed25519': signature,
            'X-Signature-Timestamp': timestamp,
          },
          body: rawBody,
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.type).toBe(1);
      } finally {
        if (oldKey !== undefined) {
          process.env.DISCORD_PUBLIC_KEY = oldKey;
        } else {
          delete process.env.DISCORD_PUBLIC_KEY;
        }
      }
    });

    it('handles Discord /help slash command returning listener guide and schedule details', async () => {
      const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2, // ApplicationCommand
          data: {
            name: 'help',
          },
          member: {
            user: { id: 'discord_listener_55', username: 'RadioExplorer' },
          },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.type).toBe(4);
      expect(json.data.content).toContain('/song');
      expect(json.data.content).toContain('/queue');
      expect(json.data.content).toContain(':45');
    });

    it('handles all shorthand Discord slash commands: np, q, n, s, d, w, z, r, h', async () => {
      // np
      const npReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: { name: 'np' },
          member: { user: { id: 'disc_user_1', username: 'fast_discord' } },
        }),
      });
      const npRes = await POST(npReq);
      expect((await npRes.json()).type).toBe(4);

      // q
      const qReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: { name: 'q' },
          member: { user: { id: 'disc_user_1', username: 'fast_discord' } },
        }),
      });
      const qRes = await POST(qReq);
      expect((await qRes.json()).data.content).toContain('Up Next');

      // n
      const nReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: { name: 'n' },
          member: { user: { id: 'disc_user_1', username: 'fast_discord' } },
        }),
      });
      const nRes = await POST(nReq);
      expect((await nRes.json()).data.content).toContain('Up Next');

      // s
      const sReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: {
            name: 's',
            options: [{ name: 'vibe', value: 'lofi chill piano beat' }],
          },
          member: { user: { id: 'disc_user_1', username: 'fast_discord' } },
        }),
      });
      const sRes = await POST(sReq);
      expect((await sRes.json()).data.content).toContain('Accepted for song');

      // d
      const dReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: {
            name: 'd',
            options: [
              { name: 'to', value: 'Sarah' },
              { name: 'message', value: 'Happy Monday!' },
            ],
          },
          member: { user: { id: 'disc_user_1', username: 'fast_discord' } },
        }),
      });
      const dRes = await POST(dReq);
      expect((await dRes.json()).data.content).toContain('Accepted for dedication');

      // w
      const wReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: {
            name: 'w',
            options: [{ name: 'city', value: 'Berlin' }],
          },
          member: { user: { id: 'disc_user_1', username: 'fast_discord' } },
        }),
      });
      const wRes = await POST(wReq);
      expect((await wRes.json()).data.content).toContain('Accepted for weather');

      // z
      const zReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: {
            name: 'z',
            options: [{ name: 'sign', value: 'Aries' }],
          },
          member: { user: { id: 'disc_user_1', username: 'fast_discord' } },
        }),
      });
      const zRes = await POST(zReq);
      expect((await zRes.json()).data.content).toContain('Accepted for zodiac');

      // r
      const rReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: {
            name: 'r',
            options: [
              { name: 'target', value: 'current-track' },
              { name: 'reason', value: 'copyright infringement' },
            ],
          },
          member: { user: { id: 'disc_user_1', username: 'fast_discord' } },
        }),
      });
      const rRes = await POST(rReq);
      expect((await rRes.json()).data.content).toContain('Report Logged');

      // h
      const hReq = new NextRequest('http://localhost:3000/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 2,
          data: { name: 'h' },
          member: { user: { id: 'disc_user_1', username: 'fast_discord' } },
        }),
      });
      const hRes = await POST(hReq);
      expect((await hRes.json()).data.content).toContain('/song');
    });
  });
});
