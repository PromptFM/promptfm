// src/lib/chat/bridge.ts
// Discord & Telegram Social Notification, Voting, and Live Transcript Bridge
// Broadcasts Now Playing updates, live spoken transcripts, and enables 1-click in-chat voting.

import { createAdminClient } from '../supabase/server';
import { postTweetToX } from '../social/x-client';

export interface BroadcastNotification {
  title: string;
  message: string;
  url?: string;
  author?: string;
  category?: 'now_playing' | 'news' | 'weather' | 'announcement' | 'dedication' | 'ad';
  trackId?: string;
  artist?: string;
  toolUsed?: string;
  upvotesCount?: number;
  transcript?: string;
  coverUrl?: string;
  postToX?: boolean;
}

const NOW_PLAYING_DEDUPE_WINDOW_MS = 60_000;
const recentNowPlayingDiscord = new Map<string, number>();
const recentNowPlayingTelegram = new Map<string, number>();
const recentNowPlayingX = new Map<string, number>();

export function resetNowPlayingDedupeCache(): void {
  recentNowPlayingDiscord.clear();
  recentNowPlayingTelegram.clear();
  recentNowPlayingX.clear();
}

function getNowPlayingKey(payload: BroadcastNotification): string | null {
  if (payload.category !== 'now_playing') return null;
  return payload.trackId || `${payload.title}:::${payload.artist || ''}`;
}

function isNowPlayingDuplicate(payload: BroadcastNotification, target: 'discord' | 'telegram' | 'x'): boolean {
  const key = getNowPlayingKey(payload);
  if (!key) return false;
  const map =
    target === 'discord'
      ? recentNowPlayingDiscord
      : target === 'telegram'
        ? recentNowPlayingTelegram
        : recentNowPlayingX;
  const lastSent = map.get(key);
  if (lastSent && Date.now() - lastSent < NOW_PLAYING_DEDUPE_WINDOW_MS) {
    return true;
  }
  return false;
}

function recordNowPlayingSent(payload: BroadcastNotification, target: 'discord' | 'telegram' | 'x'): void {
  const key = getNowPlayingKey(payload);
  if (key) {
    const map =
      target === 'discord'
        ? recentNowPlayingDiscord
        : target === 'telegram'
          ? recentNowPlayingTelegram
          : recentNowPlayingX;
    map.set(key, Date.now());
  }
}

let fallbackDemoVotes = 0;

/**
 * Casts an upvote for a track in Supabase (used by Discord buttons & Telegram inline keyboards).
 */
export async function castVoteForTrack(
  trackId: string,
  _voterId?: string
): Promise<{ success: boolean; newCount: number; title: string }> {
  // Handle demo-fallback track gracefully if database is cold/empty
  if (trackId === 'demo-fallback') {
    fallbackDemoVotes += 1;
    return {
      success: true,
      newCount: fallbackDemoVotes,
      title: 'PromptFM Ambient AI Anthem',
    };
  }

  const supabase = createAdminClient();

  const { data: track, error: fetchErr } = await supabase
    .from('tracks')
    .select('id, title, upvotes_count')
    .eq('id', trackId)
    .single();

  if (fetchErr || !track) {
    return { success: false, newCount: 0, title: 'Unknown Track' };
  }

  const updatedCount = (track.upvotes_count || 0) + 1;

  const { error: updateErr } = await supabase
    .from('tracks')
    .update({ upvotes_count: updatedCount })
    .eq('id', trackId);

  if (updateErr) {
    console.error('Failed to increment vote count:', updateErr);
    return { success: false, newCount: track.upvotes_count, title: track.title };
  }

  return { success: true, newCount: updatedCount, title: track.title };
}

/**
 * Sends a rich embed notification to a Discord channel via incoming Webhook URL.
 * Includes direct 1-click vote buttons and formatted spoken transcripts.
 */
export async function sendDiscordNotification(payload: BroadcastNotification): Promise<boolean> {
  if (payload.category === 'now_playing' && isNowPlayingDuplicate(payload, 'discord')) {
    return true;
  }

  const webhookUrl =
    payload.category === 'now_playing' || payload.category === 'dedication'
      ? process.env.DISCORD_NOW_PLAYING_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL
      : process.env.DISCORD_FEED_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://promptfm.live';
  const voteUrl = payload.trackId ? `${siteUrl}/top?vote=${payload.trackId}` : siteUrl;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (payload.artist) {
    fields.push({
      name: '🎤 Artist / AI Model',
      value: `${payload.artist} ${payload.toolUsed ? `(${payload.toolUsed})` : ''}`,
      inline: true,
    });
  }

  if (payload.upvotesCount !== undefined) {
    fields.push({
      name: '🔥 Community Upvotes',
      value: `${payload.upvotesCount}`,
      inline: true,
    });
  }

  // Live spoken transcript from Gemini
  if (payload.transcript) {
    fields.push({
      name: '📜 Live Spoken Transcript',
      value: `> "${payload.transcript}"`,
      inline: false,
    });
  }

  // Interactive link buttons for Discord
  const components: Array<Record<string, unknown>> = [];
  if (payload.category === 'now_playing' && payload.trackId) {
    components.push({
      type: 1, // Action Row
      components: [
        {
          type: 2, // Button
          style: 5, // Link button (allowed on standard webhooks)
          label: '👍 Vote',
          url: voteUrl,
        },
        {
          type: 2,
          style: 5,
          label: '🚩 Report',
          url: `${siteUrl}/top?report=${payload.trackId}`,
        },
        {
          type: 2,
          style: 5,
          label: '📻 Listen Live',
          url: siteUrl,
        },
        {
          type: 2,
          style: 5,
          label: '📅 Schedule',
          url: `${siteUrl}/schedule`,
        },
      ],
    });
  }

  // Embed Color based on category
  let color = 0x34d399; // Default Emerald
  if (payload.category === 'news') color = 0x3b82f6; // Blue
  if (payload.category === 'weather') color = 0x38bdf8; // Sky
  if (payload.category === 'dedication') color = 0xf43f5e; // Rose
  if (payload.category === 'ad') color = 0xfbbf24; // Amber

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'PromptFM DJ Bot',
        avatar_url: `${siteUrl}/logo-mark.png`,
        embeds: [
          {
            title: `📻 ${payload.title}`,
            description: payload.message,
            url: payload.url || siteUrl,
            color,
            fields: fields.length > 0 ? fields : undefined,
            footer: {
              text: payload.author
                ? `On Air: ${payload.author} • /song to queue • /help for guide`
                : 'PromptFM Live 24/7 • /song to queue • /help for guide',
            },
            timestamp: new Date().toISOString(),
          },
        ],
        components: components.length > 0 ? components : undefined,
      }),
    });
    if (res.ok) {
      recordNowPlayingSent(payload, 'discord');
    }
    return res.ok;
  } catch (err) {
    console.error('Failed to dispatch Discord webhook:', err);
    return false;
  }
}

/**
 * Sends a notification to Telegram with an Inline Keyboard for voting and live transcripts.
 */
export async function sendTelegramNotification(payload: BroadcastNotification): Promise<boolean> {
  if (payload.category === 'now_playing' && isNowPlayingDuplicate(payload, 'telegram')) {
    return true;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return false;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://promptfm.live';
  const voteUrl = payload.trackId ? `${siteUrl}/top?vote=${payload.trackId}` : siteUrl;

  let text = `📻 *${payload.title}*\n\n${payload.message}`;

  if (payload.transcript) {
    text += `\n\n🎙️ *Live DJ Transcript (${payload.author || 'AI Host'}):*\n> _"${payload.transcript}"_`;
  }

  if (payload.category === 'now_playing') {
    text += `\n\n_💡 Send /song <vibe> to queue a track • /help for guide_`;
  }

  text += `\n\n[Tune in to PromptFM Live](${payload.url || siteUrl})`;

  // Telegram Inline Keyboard for Now Playing votes & reports
  const replyMarkup: Record<string, unknown> = {};
  if (payload.category === 'now_playing' && payload.trackId) {
    replyMarkup.inline_keyboard = [
      [
        {
          text: `👍 Upvote (${payload.upvotesCount ?? 0})`,
          callback_data: `vote:${payload.trackId}`,
        },
        {
          text: '🚩 Report',
          callback_data: `report:${payload.trackId}`,
        },
      ],
      [
        {
          text: '🌐 View Chart',
          url: `${siteUrl}/top`,
        },
        {
          text: '📅 24/7 Schedule',
          url: `${siteUrl}/schedule`,
        },
      ],
    ];
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined,
        disable_web_page_preview: false,
      }),
    });
    if (res.ok) {
      recordNowPlayingSent(payload, 'telegram');
    }
    return res.ok;
  } catch (err) {
    console.error('Failed to dispatch Telegram message:', err);
    return false;
  }
}

/**
 * Unified broadcaster that notifies Discord, Telegram, and optionally X (Twitter) in parallel.
 */
export async function broadcastToCommunity(
  payload: BroadcastNotification,
  options?: { postToX?: boolean }
) {
  const tasks: Promise<unknown>[] = [
    sendDiscordNotification(payload),
    sendTelegramNotification(payload),
  ];

  if (options?.postToX || payload.postToX) {
    if (payload.category !== 'now_playing' || !isNowPlayingDuplicate(payload, 'x')) {
      recordNowPlayingSent(payload, 'x');
      const rawText = `${payload.title ? `${payload.title}: ` : ''}${payload.message}`;
      const truncated = rawText.length > 270 ? `${rawText.slice(0, 267)}...` : rawText;
      tasks.push(postTweetToX(truncated, { url: payload.url }));
    }
  }

  return Promise.allSettled(tasks);
}
