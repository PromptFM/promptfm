// tests/integration/bot-reporting.test.ts
// Integration tests for Discord and Telegram Bot reporting commands and interactive callbacks

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/bot/webhook/route';

describe('Discord & Telegram Bot Reporting Webhook Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
      text: async () => 'OK',
    }) as unknown as typeof fetch;
  });

  it('handles Telegram /report command and registers report ticket', async () => {
    const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          message_id: 888,
          from: { id: 12345, username: 'telegram_listener' },
          chat: { id: 9999 },
          text: '/report track-violating-001 Copyrighted vocal reproduction',
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.report).toBeDefined();
    expect(json.report.id).toMatch(/^rep_/);
    expect(json.report.target_id).toBe('track-violating-001');
  });

  it('handles Telegram inline button click report:<id>', async () => {
    const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query: {
          id: 'cb_query_123',
          from: { id: 54321, username: 'active_voter' },
          data: 'report:track-now-playing-777',
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.report.target_id).toBe('track-now-playing-777');
  });

  it('handles Discord /report application command and returns confirmation', async () => {
    const req = new NextRequest('http://localhost:3000/api/bot/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 2, // ApplicationCommand
        data: {
          name: 'report',
          options: [
            { name: 'target', value: 'discord-track-999' },
            { name: 'reason', value: 'Unlabeled explicit language during family stream' },
          ],
        },
        member: {
          user: { id: 'discord_uid_1', username: 'DiscordMod' },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe(4); // ChannelMessageWithSource
    expect(json.data.content).toContain('Report Logged');
    expect(json.data.content).toContain('discord-track-999');
  });
});
