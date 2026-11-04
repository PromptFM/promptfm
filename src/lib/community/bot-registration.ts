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

export const TELEGRAM_BOT_SHORTHAND_COMMANDS: TelegramCommand[] = [
  { command: 'np', description: 'Shorthand: Check current on-air track' },
  { command: 'q', description: 'Shorthand: View upcoming queue' },
  { command: 'n', description: 'Shorthand: View next tracks in rotation' },
  { command: 's', description: 'Shorthand: Request an approved track' },
  { command: 'd', description: 'Shorthand: Dedicate a song on air' },
  { command: 'w', description: 'Shorthand: Request live weather report' },
  { command: 'z', description: 'Shorthand: Request cosmic zodiac reading' },
  { command: 'r', description: 'Shorthand: Report current track' },
  { command: 'h', description: 'Shorthand: Show commands cheat sheet' },
];

export const ALL_TELEGRAM_COMMANDS: TelegramCommand[] = [
  ...TELEGRAM_BOT_COMMANDS,
  ...TELEGRAM_BOT_SHORTHAND_COMMANDS,
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
 * Supports standard commands or combined shorthand aliases.
 */
export async function registerTelegramBotCommands(
  botToken: string,
  options?: { includeShorthands?: boolean } | TelegramCommand[]
): Promise<TelegramWebhookResult> {
  if (!botToken || !botToken.trim()) {
    throw new Error('Telegram bot token is required');
  }

  let commandsToRegister = TELEGRAM_BOT_COMMANDS;
  if (Array.isArray(options)) {
    commandsToRegister = options;
  } else if (options?.includeShorthands) {
    commandsToRegister = ALL_TELEGRAM_COMMANDS;
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: commandsToRegister }),
  });

  const json = (await res.json()) as TelegramWebhookResult;
  return json;
}

/**
 * Helper to register all 18 commands (canonical + shorthands) with Telegram.
 */
export async function registerTelegramShorthands(
  botToken: string
): Promise<TelegramWebhookResult> {
  return registerTelegramBotCommands(botToken, { includeShorthands: true });
}

export interface DiscordSlashCommand {
  name: string;
  description: string;
  options?: Array<{
    type: number;
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export const DISCORD_SLASH_COMMANDS: DiscordSlashCommand[] = [
  { name: 'nowplaying', description: 'Check current on-air track and active AI DJ' },
  { name: 'queue', description: 'View upcoming tracks and listener requests' },
  { name: 'next', description: 'View upcoming tracks in rotation' },
  {
    name: 'song',
    description: 'Request an approved AI track into the live queue',
    options: [{ type: 3, name: 'vibe', description: 'Musical vibe prompt or genre', required: true }],
  },
  {
    name: 'dedicate',
    description: 'Dedicate a song on air to a friend',
    options: [
      { type: 3, name: 'to', description: 'Recipient name or @handle', required: true },
      { type: 3, name: 'message', description: 'Dedication message', required: true },
    ],
  },
  {
    name: 'weather',
    description: 'Request live weather report for your city',
    options: [{ type: 3, name: 'city', description: 'City name', required: true }],
  },
  {
    name: 'zodiac',
    description: 'Request your cosmic AI zodiac reading',
    options: [{ type: 3, name: 'sign', description: 'Zodiac astrological sign', required: true }],
  },
  {
    name: 'report',
    description: 'Report a track for safety or copyright review',
    options: [
      { type: 3, name: 'target', description: 'Track ID or song name', required: false },
      { type: 3, name: 'reason', description: 'Report reason or details', required: false },
    ],
  },
  {
    name: 'vote',
    description: 'Upvote a track on air',
    options: [{ type: 3, name: 'track_id', description: 'ID of the track to upvote', required: true }],
  },
  { name: 'help', description: 'Commands cheat sheet and airplay schedule guide' },
];

export const DISCORD_SHORTHAND_COMMANDS: DiscordSlashCommand[] = [
  { name: 'np', description: 'Shorthand: Check current on-air track' },
  { name: 'q', description: 'Shorthand: View upcoming queue' },
  { name: 'n', description: 'Shorthand: View next tracks in rotation' },
  {
    name: 's',
    description: 'Shorthand: Request an approved track',
    options: [{ type: 3, name: 'vibe', description: 'Musical vibe prompt', required: true }],
  },
  {
    name: 'd',
    description: 'Shorthand: Dedicate a song on air',
    options: [
      { type: 3, name: 'to', description: 'Recipient name', required: true },
      { type: 3, name: 'message', description: 'Dedication message', required: true },
    ],
  },
  {
    name: 'w',
    description: 'Shorthand: Request live weather report',
    options: [{ type: 3, name: 'city', description: 'City name', required: true }],
  },
  {
    name: 'z',
    description: 'Shorthand: Request cosmic zodiac reading',
    options: [{ type: 3, name: 'sign', description: 'Zodiac astrological sign', required: true }],
  },
  {
    name: 'r',
    description: 'Shorthand: Report current track',
    options: [
      { type: 3, name: 'target', description: 'Track ID or song name', required: false },
      { type: 3, name: 'reason', description: 'Report reason', required: false },
    ],
  },
  { name: 'h', description: 'Shorthand: Show commands cheat sheet' },
];

/**
 * Registers application slash commands with Discord REST API.
 */
export async function registerDiscordApplicationCommands(
  applicationId: string,
  botToken: string,
  options?: { includeShorthands?: boolean }
): Promise<{ ok: boolean; status: number; data?: unknown }> {
  if (!applicationId || !applicationId.trim()) {
    throw new Error('Discord Application ID is required');
  }
  if (!botToken || !botToken.trim()) {
    throw new Error('Discord bot token is required');
  }

  const commands = options?.includeShorthands
    ? [...DISCORD_SLASH_COMMANDS, ...DISCORD_SHORTHAND_COMMANDS]
    : DISCORD_SLASH_COMMANDS;

  const res = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  const json = await res.json().catch(() => null);
  return {
    ok: res.ok,
    status: res.status,
    data: json,
  };
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

