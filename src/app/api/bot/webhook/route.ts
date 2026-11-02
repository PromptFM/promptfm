// src/app/api/bot/webhook/route.ts
// Discord & Telegram Incoming Command Webhook
// Handles:
//   /dedicate <to> <message>
//   /song <prompt>
//   /weather <city>
//   /zodiac <sign>
// Automatically allocates into a batch slot and replies with confirmed airplay time!

import { NextRequest, NextResponse } from 'next/server';
import { scheduleListenerRequest, type RequestType } from '@/lib/dj/batches';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── 1. Telegram Bot Webhook Format ───────────────────────────────────────
    if (body.message && body.message.text) {
      const text = body.message.text.trim();
      const from = body.message.from?.username || body.message.from?.first_name || 'Telegram Listener';
      const userId = String(body.message.from?.id || 'anon');
      const chatId = body.message.chat?.id;

      let type: RequestType = 'song';
      let content = text;
      let target = '';

      if (text.startsWith('/dedicate')) {
        type = 'dedication';
        const parts = text.replace('/dedicate', '').trim().split(' ');
        target = parts[0]?.replace('@', '') || 'a friend';
        content = parts.slice(1).join(' ') || 'Sending great vibes through PromptFM!';
      } else if (text.startsWith('/weather')) {
        type = 'weather';
        target = text.replace('/weather', '').trim() || 'London';
        content = target;
      } else if (text.startsWith('/zodiac')) {
        type = 'zodiac';
        target = text.replace('/zodiac', '').trim() || 'Scorpio';
        content = target;
      } else if (text.startsWith('/song')) {
        type = 'song';
        content = text.replace('/song', '').trim();
      }

      const slot = await scheduleListenerRequest({
        platform: 'telegram',
        platform_user_id: userId,
        platform_user_name: from,
        platform_message_id: String(body.message.message_id),
        type,
        content,
        target,
      });

      // Send response back to Telegram if BOT token configured
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken && chatId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            reply_to_message_id: body.message.message_id,
            text: slot.confirmationMessage,
          }),
        });
      }

      return NextResponse.json({ success: true, slot });
    }

    // ── 2. Discord Slash Command Interaction Format ──────────────────────────
    if (body.type === 2 && body.data) {
      const commandName = body.data.name;
      const user = body.member?.user?.username || body.user?.username || 'Discord Listener';
      const userId = body.member?.user?.id || body.user?.id || 'anon';
      const options = body.data.options || [];

      let type: RequestType = 'song';
      let content = '';
      let target = '';

      if (commandName === 'dedicate') {
        type = 'dedication';
        target = options.find((o: { name: string }) => o.name === 'to')?.value || 'a friend';
        content = options.find((o: { name: string }) => o.name === 'message')?.value || 'Sending music love!';
      } else if (commandName === 'weather') {
        type = 'weather';
        target = options.find((o: { name: string }) => o.name === 'city')?.value || 'Tokyo';
        content = target;
      } else if (commandName === 'zodiac') {
        type = 'zodiac';
        target = options.find((o: { name: string }) => o.name === 'sign')?.value || 'Gemini';
        content = target;
      } else {
        type = 'song';
        content = options[0]?.value || 'synthwave';
      }

      const slot = await scheduleListenerRequest({
        platform: 'discord',
        platform_user_id: userId,
        platform_user_name: user,
        platform_message_id: body.id,
        type,
        content,
        target,
      });

      // Immediate Discord response (Type 4: ChannelMessageWithSource)
      return NextResponse.json({
        type: 4,
        data: {
          content: slot.confirmationMessage,
        },
      });
    }

    // ── 3. Direct JSON Request (from Web UI or Admin) ────────────────────────
    if (body.type && body.content) {
      const slot = await scheduleListenerRequest({
        platform: body.platform || 'web',
        platform_user_id: body.user_id || 'web-listener',
        platform_user_name: body.user_name || 'Listener',
        type: body.type,
        content: body.content,
        target: body.target,
      });

      return NextResponse.json({ success: true, slot });
    }

    return NextResponse.json({ error: 'Unsupported payload structure' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error handling bot webhook:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

