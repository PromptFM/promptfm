// src/lib/community/bot-registration.ts
// Programmatic Telegram & Discord Bot Setup, Webhook Registration, and Health Verification

import { getBotHelpText } from './commands';

export interface TelegramWebhookResult {
  ok: boolean;
  description?: string;
  result?: boolean;
}

export interface TelegramWebhookInfo {
  ok: boolean;
  result?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
    max_connections?: number;
  };
  description?: string;
}

export interface TelegramCommand {
  command: string;
  description: string;
}

export const TELEGRAM_BOT_COMMANDS: TelegramCommand[] = [
  { command: 'nowplaying', description: 'Check current on-air track and active AI DJ' },
  { command: 'queue', description: 'View upcoming tracks and listener requests' },
  { command: 'next', description: 'View upcoming tracks in rotation' },
  { command: 'song', description: 'Request an approved AI track into the live queue' },
  { command: 'dedicate', description: 'Dedicate a song on air to a friend' },
  { command: 'weather', description: 'Request live weather report for your city' },
  { command: 'zodiac', description: 'Request your cosmic AI zodiac reading' },
  { command: 'report', description: 'Report a track for safety or copyright review' },
  { command: 'help', description: 'Commands cheat sheet and airplay schedule guide' },
];

/**
 * Registers PromptFM's webhook with the Telegram Bot API.
 */
export async function registerTelegramWebhook(
  botToken: string,
  webhookUrl: string
): Promise<TelegramWebhookResult> {
  if (!botToken || !botToken.trim()) {
    throw new Error('Telegram bot token is required');
  }
  if (!webhookUrl || !webhookUrl.trim()) {
    throw new Error('Webhook URL is required');
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    }),
  });

  const json = (await res.json()) as TelegramWebhookResult;
  return json;
}

/**
 * Checks the live status of the Telegram webhook.
 */
export async function getTelegramWebhookInfo(botToken: string): Promise<TelegramWebhookInfo> {
  if (!botToken || !botToken.trim()) {
    throw new Error('Telegram bot token is required');
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const json = (await res.json()) as TelegramWebhookInfo;
  return json;
}

/**
 * Registers PromptFM slash commands with Telegram's autocomplete menu.
 */
export async function registerTelegramBotCommands(
  botToken: string
): Promise<TelegramWebhookResult> {
  if (!botToken || !botToken.trim()) {
    throw new Error('Telegram bot token is required');
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: TELEGRAM_BOT_COMMANDS }),
  });

  const json = (await res.json()) as TelegramWebhookResult;
  return json;
}

/**
 * Dispatches a test announcement message to a Telegram channel or chat.
 */
export async function sendTelegramTestMessage(
  botToken: string,
  chatId: string,
  message?: string
): Promise<TelegramWebhookResult> {
  if (!botToken || !botToken.trim()) {
    throw new Error('Telegram bot token is required');
  }
  if (!chatId || !chatId.trim()) {
    throw new Error('Chat ID is required');
  }

  const text = message || '📻 *PromptFM Bot Test*: Telegram connection established successfully! Live stream running at https://promptfm.live';

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  const json = (await res.json()) as TelegramWebhookResult;
  return json;
}

/**
 * Dispatches a test embed to a Discord channel via incoming webhook.
 */
export async function sendDiscordTestMessage(
  webhookUrl: string,
  message?: string
): Promise<{ ok: boolean; status: number }> {
  if (!webhookUrl || !webhookUrl.trim()) {
    throw new Error('Discord webhook URL is required');
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'PromptFM DJ Bot',
      avatar_url: 'https://promptfm.live/logo-mark.png',
      embeds: [
        {
          title: '📻 PromptFM Discord Webhook Verified',
          description: message || 'Connection verified! Your Discord channel will now receive live on-air Now Playing cards, spoken DJ transcripts, and listener dedication alerts.',
          color: 0x34d399,
          url: 'https://promptfm.live',
          timestamp: new Date().toISOString(),
          footer: { text: 'PromptFM Autonomous Radio Network' },
        },
      ],
    }),
  });

  return { ok: res.ok, status: res.status };
}

/**
 * Dispatches a formatted Listener Command & Airplay Guide embed to Discord.
 */
export async function broadcastGuideToDiscord(
  webhookUrl: string
): Promise<{ ok: boolean; status: number }> {
  if (!webhookUrl || !webhookUrl.trim()) {
    throw new Error('Discord webhook URL is required');
  }

  const guideContent = getBotHelpText('discord');
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'PromptFM DJ Bot',
      avatar_url: 'https://promptfm.live/logo-mark.png',
      embeds: [
        {
          title: '📻 PromptFM Listener Command & Airplay Guide',
          description: guideContent,
          color: 0x34d399,
          url: 'https://promptfm.live/schedule',
          footer: { text: 'PromptFM Autonomous Radio • Type /help in chat' },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: '📻 Tune In Live',
              url: 'https://promptfm.live',
            },
            {
              type: 2,
              style: 5,
              label: '📅 24/7 Schedule',
              url: 'https://promptfm.live/schedule',
            },
          ],
        },
      ],
    }),
  });

  return { ok: res.ok, status: res.status };
}

/**
 * Dispatches the Listener Command & Airplay Guide to Telegram channel / chat.
 */
export async function broadcastGuideToTelegram(
  botToken: string,
  chatId: string
): Promise<TelegramWebhookResult> {
  if (!botToken || !botToken.trim()) {
    throw new Error('Telegram bot token is required');
  }
  if (!chatId || !chatId.trim()) {
    throw new Error('Chat ID is required');
  }

  const guideText = getBotHelpText('markdown_v1');
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: guideText,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📻 Tune In Live', url: 'https://promptfm.live' },
            { text: '📅 24/7 Schedule', url: 'https://promptfm.live/schedule' },
          ],
        ],
      },
    }),
  });

  const json = (await res.json()) as TelegramWebhookResult;
  return json;
}

