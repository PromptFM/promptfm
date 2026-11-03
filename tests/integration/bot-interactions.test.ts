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
  });
});
