// tests/unit/chat-bridge.test.ts
// Unit tests for Discord & Telegram notification bridge, interactive buttons, and in-chat voting

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

import {
  sendDiscordNotification,
  sendTelegramNotification,
  broadcastToCommunity,
  castVoteForTrack,
  resetNowPlayingDedupeCache,
  type BroadcastNotification,
} from '@/lib/chat/bridge';

describe('Community Chat Bridge (Discord & Telegram)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetNowPlayingDedupeCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendDiscordNotification', () => {
    it('handles minimal payload without optional fields and without interactive components', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/123';
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await sendDiscordNotification({
        title: 'Minimal Notification',
        message: 'No author or transcript',
      });

      expect(result).toBe(true);
      const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
      expect(body.embeds[0].footer.text).toContain('PromptFM Live 24/7');
      expect(body.embeds[0].fields).toBeUndefined();
      expect(body.components).toBeUndefined();
    });

    it('returns false immediately when DISCORD_WEBHOOK_URL is not configured', async () => {
      delete process.env.DISCORD_WEBHOOK_URL;
      const result = await sendDiscordNotification({
        title: 'Cyberpunk Synthwave',
        message: 'Neon city vibes live on air',
      });
      expect(result).toBe(false);
    });

    it('dispatches rich embed with default emerald color and metadata fields', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/123';
      process.env.NEXT_PUBLIC_SITE_URL = 'https://promptfm.live';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const payload: BroadcastNotification = {
        title: 'Nightride in Tokyo',
        message: 'Now playing on PromptFM Main Stage',
        author: 'DJ Neon',
        artist: 'Suno Artist',
        toolUsed: 'Suno v3.5',
        upvotesCount: 42,
        transcript: 'Welcome to the late night session!',
        category: 'now_playing',
        trackId: 'track-uuid-123',
      };

      const result = await sendDiscordNotification(payload);
      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, options] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://discord.com/api/webhooks/test/123');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.username).toBe('PromptFM DJ Bot');
      expect(body.embeds[0].title).toBe('📻 Nightride in Tokyo');
      expect(body.embeds[0].color).toBe(0x34d399); // Emerald
      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: '🎤 Artist / AI Model', value: 'Suno Artist (Suno v3.5)' }),
          expect.objectContaining({ name: '🔥 Community Upvotes', value: '42' }),
          expect.objectContaining({ name: '📜 Live Spoken Transcript', value: '> "Welcome to the late night session!"' }),
        ])
      );

      // Verify interactive link buttons for Now Playing
      expect(body.components).toBeDefined();
      expect(body.components[0].components).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: '👍 Vote', url: 'https://promptfm.live/top?vote=track-uuid-123' }),
          expect.objectContaining({ label: '🚩 Report', url: 'https://promptfm.live/top?report=track-uuid-123' }),
          expect.objectContaining({ label: '📻 Listen Live', url: 'https://promptfm.live' }),
        ])
      );
    });

    it('applies specialized embed colors for news, weather, dedication, and ads', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/123';

      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;

      const testColors: Array<[BroadcastNotification['category'], number]> = [
        ['news', 0x3b82f6],
        ['weather', 0x38bdf8],
        ['dedication', 0xf43f5e],
        ['ad', 0xfbbf24],
      ];

      for (const [category, expectedColor] of testColors) {
        await sendDiscordNotification({
          title: `Broadcast ${category}`,
          message: 'Update message',
          category,
        });

        const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
        const body = JSON.parse(lastCall![1].body);
        expect(body.embeds[0].color).toBe(expectedColor);
      }
    });

    it('catches network errors gracefully and returns false', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/123';
      global.fetch = vi.fn().mockRejectedValue(new Error('Discord timeout'));

      const result = await sendDiscordNotification({
        title: 'Test',
        message: 'Timeout test',
      });
      expect(result).toBe(false);
    });

    it('routes now_playing to DISCORD_NOW_PLAYING_WEBHOOK_URL and feeds to DISCORD_FEED_WEBHOOK_URL', async () => {
      process.env.DISCORD_NOW_PLAYING_WEBHOOK_URL = 'https://discord.com/api/webhooks/now_playing';
      process.env.DISCORD_FEED_WEBHOOK_URL = 'https://discord.com/api/webhooks/radio_feed';
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;

      // Now playing routes to now_playing webhook
      await sendDiscordNotification({
        title: 'Song On Air',
        message: 'Playing now',
        category: 'now_playing',
      });
      expect(fetchMock.mock.calls[0]![0]).toBe('https://discord.com/api/webhooks/now_playing');

      // News or announcements route to radio_feed webhook
      await sendDiscordNotification({
        title: 'Station News',
        message: 'Breaking tech drop',
        category: 'news',
      });
      expect(fetchMock.mock.calls[1]![0]).toBe('https://discord.com/api/webhooks/radio_feed');
    });

    it('deduplicates repeated now_playing notifications for the same track sent within dedupe window', async () => {
      process.env.DISCORD_NOW_PLAYING_WEBHOOK_URL = 'https://discord.com/api/webhooks/now_playing';
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;

      const payload: BroadcastNotification = {
        title: 'Dedupe Track A',
        message: 'Playing now',
        category: 'now_playing',
        trackId: 'track-dedupe-1',
      };

      const res1 = await sendDiscordNotification(payload);
      expect(res1).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Repeated immediate call for same now-playing track
      const res2 = await sendDiscordNotification(payload);
      expect(res2).toBe(true);
      // Must not dispatch a second duplicate webhook call
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('resetNowPlayingDedupeCache clears deduplication maps and permits immediate broadcast', async () => {
      process.env.DISCORD_NOW_PLAYING_WEBHOOK_URL = 'https://discord.com/api/webhooks/now_playing';
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;

      const payload: BroadcastNotification = {
        title: 'Cache Reset Track',
        message: 'Playing live',
        category: 'now_playing',
        trackId: 'track-reset-1',
      };

      await sendDiscordNotification(payload);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      resetNowPlayingDedupeCache();

      await sendDiscordNotification(payload);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('deduplicates now_playing notifications using title and artist fallback when trackId is missing', async () => {
      process.env.DISCORD_NOW_PLAYING_WEBHOOK_URL = 'https://discord.com/api/webhooks/now_playing';
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;

      const payload: BroadcastNotification = {
        title: 'Fallback Dedupe Track',
        artist: 'AI Virtuoso',
        message: 'Playing live',
        category: 'now_playing',
      };

      await sendDiscordNotification(payload);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await sendDiscordNotification(payload);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('allows re-broadcasting the same track after the dedupe window expires', async () => {
      process.env.DISCORD_NOW_PLAYING_WEBHOOK_URL = 'https://discord.com/api/webhooks/now_playing';
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;

      const payload: BroadcastNotification = {
        title: 'Cooldown Song',
        message: 'Playing live',
        category: 'now_playing',
        trackId: 'track-cooldown-1',
      };

      const origNow = Date.now;
      try {
        let mockTime = 1_000_000;
        Date.now = () => mockTime;

        await sendDiscordNotification(payload);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Within 60,000ms window -> deduped
        mockTime += 30_000;
        await sendDiscordNotification(payload);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // At or past 60,000ms boundary -> allowed
        mockTime += 30_000;
        await sendDiscordNotification(payload);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = origNow;
      }
    });
  });

  describe('sendTelegramNotification', () => {
    it('handles minimal payload without category or trackId and omits reply_markup', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'token';
      process.env.TELEGRAM_CHAT_ID = 'chat';
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await sendTelegramNotification({
        title: 'Simple Station Notice',
        message: 'System maintenance scheduled.',
      });

      expect(result).toBe(true);
      const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
      expect(body.reply_markup).toBeUndefined();
      expect(body.text).toContain('Simple Station Notice');
      expect(body.text).not.toContain('Live DJ Transcript');
    });

    it('returns false immediately when bot token or chat ID is missing', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;

      const result = await sendTelegramNotification({
        title: 'Morning Chill',
        message: 'Streaming now',
      });
      expect(result).toBe(false);
    });

    it('dispatches telegram message with inline keyboard for voting and reporting', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      process.env.TELEGRAM_CHAT_ID = '-100987654321';
      process.env.NEXT_PUBLIC_SITE_URL = 'https://promptfm.live';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const payload: BroadcastNotification = {
        title: 'Cyberpunk Awakening',
        message: 'Track playing live',
        author: 'DJ Cipher',
        trackId: 'track-cyber-99',
        upvotesCount: 15,
        transcript: 'Jack into the matrix and turn up the volume.',
        category: 'now_playing',
      };

      const result = await sendTelegramNotification(payload);
      expect(result).toBe(true);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
      expect(body.chat_id).toBe('-100987654321');
      expect(body.parse_mode).toBe('Markdown');
      expect(body.text).toContain('Cyberpunk Awakening');
      expect(body.text).toContain('Live DJ Transcript (DJ Cipher)');
      expect(body.text).toContain('> _"Jack into the matrix and turn up the volume."_');

      // Verify Telegram inline keyboard
      expect(body.reply_markup.inline_keyboard).toEqual([
        [
          { text: '👍 Upvote (15)', callback_data: 'vote:track-cyber-99' },
          { text: '🚩 Report', callback_data: 'report:track-cyber-99' },
        ],
        [
          { text: '🌐 View Chart', url: 'https://promptfm.live/top' },
          { text: '📅 24/7 Schedule', url: 'https://promptfm.live/schedule' },
        ],
      ]);
    });

    it('catches network errors gracefully and returns false', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'token';
      process.env.TELEGRAM_CHAT_ID = 'chat';
      global.fetch = vi.fn().mockRejectedValue(new Error('Telegram socket error'));

      const result = await sendTelegramNotification({
        title: 'Test',
        message: 'Error handling',
      });
      expect(result).toBe(false);
    });
  });

  describe('broadcastToCommunity', () => {
    it('dispatches to both Discord and Telegram concurrently via Promise.allSettled', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/webhook';
      process.env.TELEGRAM_BOT_TOKEN = 'token';
      process.env.TELEGRAM_CHAT_ID = 'chat';

      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const results = await broadcastToCommunity({
        title: 'Station ID',
        message: 'PromptFM is online',
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.status).toBe('fulfilled');
      expect(results[1]?.status).toBe('fulfilled');
    });

    it('dispatches to Discord, Telegram, and X when postToX is requested', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/webhook';
      process.env.TELEGRAM_BOT_TOKEN = 'token';
      process.env.TELEGRAM_CHAT_ID = 'chat';

      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const results = await broadcastToCommunity(
        {
          title: 'Station ID',
          message: 'PromptFM is online',
        },
        { postToX: true }
      );

      expect(results).toHaveLength(3);
      expect(results[0]?.status).toBe('fulfilled');
      expect(results[1]?.status).toBe('fulfilled');
      expect(results[2]?.status).toBe('fulfilled');
    });

    it('deduplicates now_playing broadcasts to community channels within dedupe window', async () => {
      process.env.DISCORD_NOW_PLAYING_WEBHOOK_URL = 'https://discord.com/api/webhooks/now_playing';
      process.env.TELEGRAM_BOT_TOKEN = 'token';
      process.env.TELEGRAM_CHAT_ID = 'chat';

      const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      global.fetch = fetchMock as unknown as typeof fetch;

      const payload: BroadcastNotification = {
        title: 'Community Track Dedupe',
        message: 'Playing live',
        category: 'now_playing',
        trackId: 'track-comm-dedupe-1',
      };

      await broadcastToCommunity(payload);
      const callCount = fetchMock.mock.calls.length;
      expect(callCount).toBeGreaterThan(0);

      // Duplicate immediate broadcast
      await broadcastToCommunity(payload);
      expect(fetchMock.mock.calls.length).toBe(callCount);
    });

    it('deduplicates postToX when broadcasting now_playing duplicates', async () => {
      process.env.DISCORD_NOW_PLAYING_WEBHOOK_URL = 'https://discord.com/api/webhooks/now_playing';
      process.env.TELEGRAM_BOT_TOKEN = 'token';
      process.env.TELEGRAM_CHAT_ID = 'chat';

      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;

      const payload: BroadcastNotification = {
        title: 'X Deduped Song',
        message: 'Playing live on PromptFM',
        category: 'now_playing',
        trackId: 'track-x-dedupe-1',
        postToX: true,
      };

      const res1 = await broadcastToCommunity(payload, { postToX: true });
      expect(res1).toHaveLength(3);

      // Second immediate broadcast should omit X task
      const res2 = await broadcastToCommunity(payload, { postToX: true });
      expect(res2).toHaveLength(2);
    });

    it('truncates long tweet to 270 chars and passes url when postToX is requested', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/webhook';
      process.env.TELEGRAM_BOT_TOKEN = 'token';
      process.env.TELEGRAM_CHAT_ID = 'chat';

      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = fetchMock as unknown as typeof fetch;

      const longMessage = 'A'.repeat(300);
      const payload: BroadcastNotification = {
        title: 'Long Announcement',
        message: longMessage,
        url: 'https://promptfm.live/track/special-long-url',
        category: 'announcement',
      };

      const res = await broadcastToCommunity(payload, { postToX: true });
      expect(res).toHaveLength(3);
    });
  });

  describe('castVoteForTrack', () => {
    it('increments vote for demo-fallback track in-memory when database is offline', async () => {
      const res1 = await castVoteForTrack('demo-fallback');
      expect(res1.success).toBe(true);
      expect(res1.title).toBe('PromptFM Ambient AI Anthem');
      expect(res1.newCount).toBeGreaterThan(0);

      const res2 = await castVoteForTrack('demo-fallback');
      expect(res2.newCount).toBe(res1.newCount + 1);
    });

    it('handles database fetch error or missing track gracefully', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: new Error('Track not found') }),
          }),
        }),
      });

      const res = await castVoteForTrack('non-existent-uuid');
      expect(res.success).toBe(false);
      expect(res.newCount).toBe(0);
      expect(res.title).toBe('Unknown Track');
    });

    it('successfully fetches track from Supabase, increments upvotes_count, and saves', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'tracks') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: 'real-track-123', title: 'Neon Horizon', upvotes_count: 50 },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });

      const res = await castVoteForTrack('real-track-123');
      expect(res.success).toBe(true);
      expect(res.newCount).toBe(51);
      expect(res.title).toBe('Neon Horizon');
      expect(mockUpdate).toHaveBeenCalledWith({ upvotes_count: 51 });
    });

    it('handles database update error gracefully and returns current count', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('Database write rejected') }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'tracks') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: 'track-err-456', title: 'Glitch Synth', upvotes_count: 10 },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      });

      const res = await castVoteForTrack('track-err-456');
      expect(res.success).toBe(false);
      expect(res.newCount).toBe(10);
      expect(res.title).toBe('Glitch Synth');
    });
  });
});
