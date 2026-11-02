// src/lib/chat/bridge.ts
// Discord & Telegram Social Notification and Chat Relay Bridge
// Broadcasts station announcements, trending tracks, and syncs messages with external bots.

interface BroadcastNotification {
  title: string;
  message: string;
  url?: string;
  author?: string;
}

/**
 * Sends a rich embed notification to a Discord channel via an incoming Webhook URL.
 * Free, requires zero bot servers.
 */
export async function sendDiscordNotification(payload: BroadcastNotification): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return false;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'PromptFM DJ Bot',
        avatar_url: 'https://promptfm.vercel.app/logo-mark.png',
        embeds: [
          {
            title: `📻 ${payload.title}`,
            description: payload.message,
            url: payload.url || 'https://promptfm.vercel.app',
            color: 0x34d399, // PromptFM emerald green
            footer: {
              text: payload.author ? `Announced by ${payload.author}` : 'PromptFM Live 24/7',
            },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to dispatch Discord webhook:', err);
    return false;
  }
}

/**
 * Sends a notification to a Telegram Channel or Group via the Telegram Bot API.
 */
export async function sendTelegramNotification(payload: BroadcastNotification): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return false;
  }

  const text = `📻 *${payload.title}*\n\n${payload.message}\n\n[Tune in to PromptFM](${payload.url || 'https://promptfm.vercel.app'})`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to dispatch Telegram message:', err);
    return false;
  }
}

/**
 * Unified broadcaster that notifies both Discord and Telegram if configured.
 */
export async function broadcastToCommunity(payload: BroadcastNotification) {
  return Promise.allSettled([
    sendDiscordNotification(payload),
    sendTelegramNotification(payload),
  ]);
}

