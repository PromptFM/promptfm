// tests/unit/bot-registration.test.ts
// Unit tests for Telegram & Discord bot registration, webhook setup, and health checks

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerTelegramWebhook,
  getTelegramWebhookInfo,
  registerTelegramBotCommands,
  sendTelegramTestMessage,
  sendDiscordTestMessage,
  broadcastGuideToDiscord,
  broadcastGuideToTelegram,
  TELEGRAM_BOT_COMMANDS,
} from '@/lib/community/bot-registration';

describe('Bot Registration & Webhook Management Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerTelegramWebhook', () => {
    it('throws error when bot token or webhook url is missing or whitespace-only', async () => {
      await expect(registerTelegramWebhook('', 'https://promptfm.live/api/bot/webhook')).rejects.toThrow(
        'Telegram bot token is required'
      );
      await expect(registerTelegramWebhook('   ', 'https://promptfm.live/api/bot/webhook')).rejects.toThrow(
        'Telegram bot token is required'
      );
      await expect(registerTelegramWebhook('valid-token', '')).rejects.toThrow(
        'Webhook URL is required'
      );
      await expect(registerTelegramWebhook('valid-token', '   ')).rejects.toThrow(
        'Webhook URL is required'
      );
    });

    it('successfully calls Telegram setWebhook endpoint with allowed_updates', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: true, description: 'Webhook was set' }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await registerTelegramWebhook(
        '123456:ABC-DEF',
        'https://promptfm.live/api/bot/webhook'
      );

      expect(result.ok).toBe(true);
      expect(result.description).toBe('Webhook was set');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:ABC-DEF/setWebhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://promptfm.live/api/bot/webhook',
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: false,
          }),
        })
      );
    });

    it('returns error details when Telegram API returns failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, error_code: 400, description: 'Bad Request: invalid webhook URL' }),
      });

      const result = await registerTelegramWebhook('token', 'https://invalid-url');
      expect(result.ok).toBe(false);
      expect(result.description).toContain('invalid webhook URL');
    });
  });

  describe('getTelegramWebhookInfo', () => {
    it('throws error when bot token is missing or whitespace', async () => {
      await expect(getTelegramWebhookInfo('')).rejects.toThrow('Telegram bot token is required');
      await expect(getTelegramWebhookInfo('   ')).rejects.toThrow('Telegram bot token is required');
    });

    it('retrieves live webhook status and pending updates count', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            url: 'https://promptfm.live/api/bot/webhook',
            has_custom_certificate: false,
            pending_update_count: 0,
          },
        }),
      });

      const info = await getTelegramWebhookInfo('test-token');
      expect(info.ok).toBe(true);
      expect(info.result?.url).toBe('https://promptfm.live/api/bot/webhook');
      expect(info.result?.pending_update_count).toBe(0);
    });
  });

  describe('registerTelegramBotCommands', () => {
    it('defines the standard 9 commands including help and queue', () => {
      expect(TELEGRAM_BOT_COMMANDS).toEqual([
        { command: 'nowplaying', description: 'Check current on-air track and active AI DJ' },
        { command: 'queue', description: 'View upcoming tracks and listener requests' },
        { command: 'next', description: 'View upcoming tracks in rotation' },
        { command: 'song', description: 'Request an approved AI track into the live queue' },
        { command: 'dedicate', description: 'Dedicate a song on air to a friend' },
        { command: 'weather', description: 'Request live weather report for your city' },
        { command: 'zodiac', description: 'Request your cosmic AI zodiac reading' },
        { command: 'report', description: 'Report a track for safety or copyright review' },
        { command: 'help', description: 'Commands cheat sheet and airplay schedule guide' },
      ]);
    });

    it('throws error when bot token is empty or whitespace', async () => {
      await expect(registerTelegramBotCommands('')).rejects.toThrow('Telegram bot token is required');
      await expect(registerTelegramBotCommands('   ')).rejects.toThrow('Telegram bot token is required');
    });

    it('registers official station command menu with Telegram autocomplete', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: true }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await registerTelegramBotCommands('test-token');
      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-token/setMyCommands',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commands: TELEGRAM_BOT_COMMANDS }),
        })
      );
    });
  });

  describe('sendTelegramTestMessage', () => {
    it('throws error when token or chatId is missing or whitespace', async () => {
      await expect(sendTelegramTestMessage('', '12345')).rejects.toThrow('Telegram bot token is required');
      await expect(sendTelegramTestMessage('   ', '12345')).rejects.toThrow('Telegram bot token is required');
      await expect(sendTelegramTestMessage('token', '')).rejects.toThrow('Chat ID is required');
      await expect(sendTelegramTestMessage('token', '   ')).rejects.toThrow('Chat ID is required');
    });

    it('sends test markdown announcement with custom or default message', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const res1 = await sendTelegramTestMessage('token', '-100987654');
      expect(res1.ok).toBe(true);
      const call1 = fetchMock.mock.calls[0]!;
      const body1 = JSON.parse(call1[1].body);
      expect(body1.text).toContain('PromptFM Bot Test');

      const res2 = await sendTelegramTestMessage('token', '-100987654', 'Special custom broadcast');
      expect(res2.ok).toBe(true);
      const call2 = fetchMock.mock.calls[1]!;
      const body2 = JSON.parse(call2[1].body);
      expect(body2.text).toBe('Special custom broadcast');
    });
  });

  describe('sendDiscordTestMessage', () => {
    it('throws error when webhook URL is missing or whitespace', async () => {
      await expect(sendDiscordTestMessage('')).rejects.toThrow('Discord webhook URL is required');
      await expect(sendDiscordTestMessage('   ')).rejects.toThrow('Discord webhook URL is required');
    });

    it('dispatches rich test embed to Discord channel webhook with default or custom message', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const resDefault = await sendDiscordTestMessage('https://discord.com/api/webhooks/test/123');
      expect(resDefault.ok).toBe(true);
      const callDefault = fetchMock.mock.calls[0]!;
      const bodyDefault = JSON.parse(callDefault[1].body);
      expect(bodyDefault.embeds[0].description).toContain('Connection verified');

      const resCustom = await sendDiscordTestMessage(
        'https://discord.com/api/webhooks/test/123',
        'Custom test broadcast'
      );

      expect(resCustom.ok).toBe(true);
      const callCustom = fetchMock.mock.calls[1]!;
      const bodyCustom = JSON.parse(callCustom[1].body);
      expect(bodyCustom.username).toBe('PromptFM DJ Bot');
      expect(bodyCustom.embeds[0].description).toBe('Custom test broadcast');
      expect(bodyCustom.embeds[0].color).toBe(0x34d399);
    });
  });

  describe('broadcastGuideToDiscord', () => {
    it('throws error when webhook URL is missing', async () => {
      await expect(broadcastGuideToDiscord('')).rejects.toThrow('Discord webhook URL is required');
    });

    it('dispatches a rich commands and schedule guide embed to Discord', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const res = await broadcastGuideToDiscord('https://discord.com/api/webhooks/test/guide');
      expect(res.ok).toBe(true);

      const call = fetchMock.mock.calls[0]!;
      const body = JSON.parse(call[1].body);
      expect(body.embeds[0].title).toContain('Listener Command & Airplay Guide');
      expect(body.embeds[0].description).toContain('/song');
      expect(body.embeds[0].description).toContain(':45');
    });
  });

  describe('broadcastGuideToTelegram', () => {
    it('throws error when token or chatId is missing', async () => {
      await expect(broadcastGuideToTelegram('', '123')).rejects.toThrow('Telegram bot token is required');
      await expect(broadcastGuideToTelegram('token', '')).rejects.toThrow('Chat ID is required');
    });

    it('dispatches guide message with inline keyboard links to Telegram channel', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const res = await broadcastGuideToTelegram('test-tok', '@promptfm_live');
      expect(res.ok).toBe(true);

      const call = fetchMock.mock.calls[0]!;
      const body = JSON.parse(call[1].body);
      expect(body.text).toContain('/song');
      expect(body.text).toContain(':45');
      expect(body.reply_markup.inline_keyboard).toBeDefined();
    });
  });
});
