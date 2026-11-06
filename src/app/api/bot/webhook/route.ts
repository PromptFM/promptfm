// src/app/api/bot/webhook/route.ts
// Discord & Telegram Interactive Bot Webhook
// Handles:
//   - Commands: /nowplaying, /next, /dedicate, /song, /weather, /zodiac, /vote
//   - Telegram Inline Keyboard Button clicks (👍 Vote Callback Queries)
//   - Discord Component Interactions (Button clicks)
// Automatically allocates requests into broadcast slots and records real-time votes!

import { NextRequest, NextResponse } from 'next/server';
import { scheduleListenerRequest, type RequestType } from '@/lib/dj/batches';
import { getNowPlaying, getUpNext } from '@/lib/dj/rotation';
import { castVoteForTrack } from '@/lib/chat/bridge';
import { submitContentReport } from '@/lib/safety/reports';
import { getBotHelpText } from '@/lib/community/commands';
import { verifyDiscordSignature } from '@/lib/community/discord-verify';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-signature-ed25519');
    const timestamp = req.headers.get('x-signature-timestamp');

    // ── Discord Security Signature Verification (Ed25519) ──────────────────────
    // Discord security verifies the interaction endpoint by testing valid/invalid signatures.
    // If signature headers are present, requests with invalid signatures MUST return HTTP 401.
    if (signature || timestamp) {
      const isValid = verifyDiscordSignature({ rawBody, signature, timestamp });
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 });
      }
    }

    const body = rawBody ? JSON.parse(rawBody) : {};
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://promptfm.live';
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // ── 0. Discord Ping (Interaction Type 1 - PING -> PONG) ───────────────────
    if (body.type === 1) {
      return NextResponse.json({ type: 1 });
    }

    // ── 1. Telegram Callback Query (Inline Button Click - e.g. 👍 Upvote) ─────
    if (body.callback_query) {
      const cq = body.callback_query;
      const data = cq.data as string; // e.g. "vote:<trackId>"
      const voterId = String(cq.from?.id || 'anon');
      const voterName = cq.from?.username || cq.from?.first_name || 'Listener';

      if (data && data.startsWith('vote:')) {
        const trackId = data.replace('vote:', '');
        const voteResult = await castVoteForTrack(trackId, voterId);

        let answerText = `🎉 Upvoted "${voteResult.title}"! Current score: ${voteResult.newCount} upvotes.`;
        if (!voteResult.success) {
          answerText = '⚠️ Could not register vote for this track.';
        }

        // Answer callback query so Telegram dismisses the button loading spinner
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: answerText,
              show_alert: false,
            }),
          });
        }

        return NextResponse.json({ success: true, voter: voterName, voteResult });
      }

      // Telegram Inline Button Report click
      if (data && data.startsWith('report:')) {
        const trackId = data.replace('report:', '');
        const rep = await submitContentReport({
          target_type: 'track',
          target_id: trackId,
          reason: 'other',
          details: 'Reported via Telegram inline button on Now Playing broadcast',
          reporter_platform: 'telegram',
          reporter_id: `${voterName} (${voterId})`,
        });

        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: `🛡️ Report registered (Ticket: ${rep.reportId}). Station moderation alerted!`,
              show_alert: true,
            }),
          });
        }

        return NextResponse.json({ success: true, voter: voterName, report: rep.report });
      }

      return NextResponse.json({ success: true });
    }

    // ── 2. Telegram Bot Text Messages & Commands ─────────────────────────────
    if (body.message && body.message.text) {
      const text = body.message.text.trim();
      const from = body.message.from?.username || body.message.from?.first_name || 'Telegram Listener';
      const userId = String(body.message.from?.id || 'anon');
      const chatId = body.message.chat?.id;

      // /help or /start or /commands
      if (
        text === '/help' ||
        text === '/start' ||
        text === '/commands' ||
        text.startsWith('/help@') ||
        text.startsWith('/start@') ||
        text.startsWith('/commands@')
      ) {
        const helpText = getBotHelpText('markdown_v1');
        if (botToken && chatId) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              reply_to_message_id: body.message.message_id,
              text: helpText,
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            }),
          });
        }

        return NextResponse.json({ success: true, help_text: helpText });
      }

      // /help, /start, /commands, or /h
      if (
        text === '/help' ||
        text === '/start' ||
        text === '/commands' ||
        text === '/h' ||
        text.startsWith('/help@') ||
        text.startsWith('/h@') ||
        text.startsWith('/start@')
      ) {
        const helpText = getBotHelpText('telegram');

        if (botToken && chatId) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              reply_to_message_id: body.message.message_id,
              text: helpText,
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            }),
          });
        }

        return NextResponse.json({ success: true, help_text: helpText });
      }

      // /nowplaying or /np command
      if (
        text === '/nowplaying' ||
        text === '/np' ||
        text.startsWith('/nowplaying@') ||
        text.startsWith('/np@')
      ) {
        const np = await getNowPlaying();
        const rankStr = np.rank ? `\n🏆 Chart Rank: *#${np.rank}*` : '';
        const trackIdStr = np.item.id ? `\n🆔 Track ID: \`${np.item.id}\`` : '';
        const replyText = `📻 *Now Playing on PromptFM*\n\n🎵 *${np.item.title}*\n🎤 *${np.item.artist}* ${np.item.tool_used ? `(${np.item.tool_used})` : ''}${trackIdStr}${rankStr}\n🎙️ Host: *${np.activeDJ.name}*\n🔥 Upvotes: *${np.item.upvotes_count ?? 0}*\n\n[Tune in Live](${siteUrl})`;

        if (botToken && chatId) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              reply_to_message_id: body.message.message_id,
              text: replyText,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: `👍 Upvote (${np.item.upvotes_count ?? 0})`,
                      callback_data: `vote:${np.item.id}`,
                    },
                    {
                      text: '🌐 Vote on Web',
                      url: `${siteUrl}/top?vote=${np.item.id}`,
                    },
                  ],
                ],
              },
            }),
          });
        }

        return NextResponse.json({ success: true, now_playing: np });
      }

      // /next or /queue or /whatisnext or /q or /n command
      if (
        text === '/next' ||
        text === '/queue' ||
        text === '/whatisnext' ||
        text === '/q' ||
        text === '/n' ||
        text.startsWith('/next@') ||
        text.startsWith('/queue@') ||
        text.startsWith('/q@') ||
        text.startsWith('/n@')
      ) {
        const upcoming = await getUpNext('main', 5);
        let replyText = `⏭️ *Up Next on PromptFM:*\n\n`;
        if (upcoming.length === 0) {
          replyText += `Continuous community stream loaded. Request a song with /song <prompt>!`;
        } else {
          upcoming.forEach((item, index) => {
            const etaStr = item.estimated_air_time ? ` (~${item.estimated_air_time}, provisional)` : '';
            const reqStr = item.requested_by ? ` • 👤 Req by ${item.requested_by}` : '';
            replyText += `${index + 1}. *"${item.title}"* by ${item.artist}${etaStr}${reqStr} ${item.tool_used ? `(${item.tool_used})` : ''} — 🔥 ${item.upvotes_count ?? 0} votes\n`;
          });
          replyText += `\n_ℹ️ Times are provisional estimates and update as tracks play live._`;
        }
        replyText += `\n[Tune in Live](${siteUrl})`;

        if (botToken && chatId) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              reply_to_message_id: body.message.message_id,
              text: replyText,
              parse_mode: 'Markdown',
            }),
          });
        }

        return NextResponse.json({ success: true, upcoming });
      }

      // Direct /vote <trackId> command
      if (text.startsWith('/vote')) {
        const trackId = text.replace('/vote', '').trim();
        if (trackId) {
          const voteResult = await castVoteForTrack(trackId, userId);
          if (botToken && chatId) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                reply_to_message_id: body.message.message_id,
                text: `🎉 You upvoted "${voteResult.title}"! Current count: ${voteResult.newCount} votes.`,
              }),
            });
          }
          return NextResponse.json({ success: true, voteResult });
        }
      }

      // /report or /r command: /report <trackId_or_keyword> <reason> or /r <track> <reason>
      if (text.startsWith('/report') || text.startsWith('/r ') || text === '/r') {
        const rawArg = text.startsWith('/report')
          ? text.replace('/report', '').trim()
          : text.replace('/r', '').trim();
        const parts = rawArg.split(' ');
        const targetId = parts[0] || 'current-track';
        const reasonText = parts.slice(1).join(' ') || 'Reported for broadcast standards violation';

        const rep = await submitContentReport({
          target_type: 'track',
          target_id: targetId,
          reason: 'other',
          details: reasonText,
          reporter_platform: 'telegram',
          reporter_id: `${from} (${userId})`,
        });

        if (botToken && chatId) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              reply_to_message_id: body.message.message_id,
              text: `🛡️ *Content Report Registered*\n\n• Target: *${targetId}*\n• Details: _${reasonText}_\n• Ticket ID: \`${rep.reportId}\`\n\nPromptFM station moderators have been notified immediately. Thank you for protecting community safety.`,
              parse_mode: 'Markdown',
            }),
          });
        }

        return NextResponse.json({ success: true, report: rep.report });
      }

      // Batch scheduled listener requests: /dedicate, /weather, /zodiac, /song (with /d, /w, /z, /s shorthands)
      let type: RequestType = 'song';
      let content = text;
      let target = '';

      if (text.startsWith('/dedicate') || text.startsWith('/d ') || text === '/d') {
        type = 'dedication';
        const raw = text.startsWith('/dedicate') ? text.replace('/dedicate', '').trim() : text.replace('/d', '').trim();
        const parts = raw.split(' ');
        target = parts[0]?.replace('@', '') || 'a friend';
        content = parts.slice(1).join(' ') || 'Sending great vibes through PromptFM!';
      } else if (text.startsWith('/weather') || text.startsWith('/w ') || text === '/w') {
        type = 'weather';
        const raw = text.startsWith('/weather') ? text.replace('/weather', '').trim() : text.replace('/w', '').trim();
        target = raw || 'London';
        content = target;
      } else if (text.startsWith('/zodiac') || text.startsWith('/z ') || text === '/z') {
        type = 'zodiac';
        const raw = text.startsWith('/zodiac') ? text.replace('/zodiac', '').trim() : text.replace('/z', '').trim();
        target = raw || 'Scorpio';
        content = target;
      } else if (text.startsWith('/song') || text.startsWith('/s ') || text === '/s') {
        type = 'song';
        content = (text.startsWith('/song') ? text.replace('/song', '') : text.replace('/s', '')).trim();
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

    // ── 3. Discord Interactions (Slash Commands & Button Clicks) ─────────────

    // Type 3: Component Interaction (Discord Button Click)
    if (body.type === 3 && body.data) {
      const customId = body.data.custom_id as string;
      const userId = body.member?.user?.id || body.user?.id || 'anon';
      const user = body.member?.user?.username || body.user?.username || 'Discord Listener';

      if (customId && customId.startsWith('vote:')) {
        const trackId = customId.replace('vote:', '');
        const voteResult = await castVoteForTrack(trackId, userId);

        return NextResponse.json({
          type: 4, // ChannelMessageWithSource (ephemeral response to voter)
          data: {
            content: `🎉 You upvoted **"${voteResult.title}"**! Current score: **${voteResult.newCount}** upvotes.`,
            flags: 64, // Ephemeral (only visible to voter)
          },
        });
      }

      if (customId && customId.startsWith('report:')) {
        const trackId = customId.replace('report:', '');
        const rep = await submitContentReport({
          target_type: 'track',
          target_id: trackId,
          reason: 'other',
          details: 'Reported via Discord interactive button',
          reporter_platform: 'discord',
          reporter_id: `${user} (${userId})`,
        });

        return NextResponse.json({
          type: 4,
          data: {
            content: `🛡️ **Content Report Filed (Ticket: \`${rep.reportId}\`)**\nYour report against item \`${trackId}\` has been logged and routed to station moderation. Thank you for protecting the community!`,
            flags: 64,
          },
        });
      }
    }

    // Type 2: Application Command (Discord Slash Commands)
    if (body.type === 2 && body.data) {
      const commandName = body.data.name;
      const user = body.member?.user?.username || body.user?.username || 'Discord Listener';
      const userId = body.member?.user?.id || body.user?.id || 'anon';
      const options = body.data.options || [];

      // /nowplaying slash command
      if (commandName === 'nowplaying' || commandName === 'np') {
        const np = await getNowPlaying();
        const rankStr = np.rank ? `\n🏆 Chart Rank: **#${np.rank}**` : '';
        const trackIdStr = np.item.id ? `\n🆔 Track ID: \`${np.item.id}\`` : '';
        return NextResponse.json({
          type: 4,
          data: {
            content: `📻 **Now Playing on PromptFM**\n🎵 **${np.item.title}** by **${np.item.artist}**${trackIdStr}${rankStr}\n🎙️ Active Host: **${np.activeDJ.name}**\n🔥 Upvotes: **${np.item.upvotes_count ?? 0}**\n\nVote directly below:`,
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 5,
                    label: '👍 Vote on Web',
                    url: `${siteUrl}/top?vote=${np.item.id}`,
                  },
                  {
                    type: 2,
                    style: 5,
                    label: '🚩 Report',
                    url: `${siteUrl}/top?report=${np.item.id}`,
                  },
                  {
                    type: 2,
                    style: 5,
                    label: '📻 Tune In Live',
                    url: siteUrl,
                  },
                ],
              },
            ],
          },
        });
      }

      // /report slash command (or shorthand /r)
      if (commandName === 'report' || commandName === 'r') {
        const target = (options.find((o: { name: string }) => o.name === 'target')?.value as string) || 'current-broadcast';
        const reason = (options.find((o: { name: string }) => o.name === 'reason')?.value as string) || 'Reported for broadcast ethics or copyright violation';
        const rep = await submitContentReport({
          target_type: 'track',
          target_id: target,
          reason: 'other',
          details: reason,
          reporter_platform: 'discord',
          reporter_id: `${user} (${userId})`,
        });

        return NextResponse.json({
          type: 4,
          data: {
            content: `🛡️ **Report Logged (Ticket: \`${rep.reportId}\`)**\n• Target: **${target}**\n• Reason: _${reason}_\nPromptFM station moderators have been alerted.`,
            flags: 64,
          },
        });
      }

      // /help or /commands slash command (or shorthand /h)
      if (commandName === 'help' || commandName === 'commands' || commandName === 'h') {
        return NextResponse.json({
          type: 4,
          data: {
            content: getBotHelpText('discord'),
          },
        });
      }

      // /next or /queue slash command (or shorthands /q, /n)
      if (
        commandName === 'next' ||
        commandName === 'queue' ||
        commandName === 'q' ||
        commandName === 'n'
      ) {
        const upcoming = await getUpNext('main', 5);
        let listText = `⏭️ **Up Next on PromptFM:**\n\n`;
        if (upcoming.length === 0) {
          listText += `Continuous community stream loaded. Request a song with /song <prompt>!`;
        } else {
          upcoming.forEach((item, index) => {
            const etaStr = item.estimated_air_time ? ` (~${item.estimated_air_time}, provisional)` : '';
            const reqStr = item.requested_by ? ` • 👤 Req by ${item.requested_by}` : '';
            listText += `${index + 1}. **"${item.title}"** by ${item.artist}${etaStr}${reqStr} — 🔥 ${item.upvotes_count ?? 0} votes\n`;
          });
          listText += `\n_ℹ️ Times are provisional estimates and update as tracks play live._`;
        }
        return NextResponse.json({
          type: 4,
          data: { content: listText },
        });
      }

      // /vote slash command
      if (commandName === 'vote') {
        const trackId = options.find((o: { name: string }) => o.name === 'track_id')?.value as string;
        if (trackId) {
          const res = await castVoteForTrack(trackId, userId);
          return NextResponse.json({
            type: 4,
            data: {
              content: `🎉 Recorded your upvote for **"${res.title}"**! Current count: **${res.newCount}** upvotes.`,
            },
          });
        }
      }

      // Scheduling commands: dedicate, weather, zodiac, song (including /d, /w, /z, /s shorthands)
      let type: RequestType = 'song';
      let content = '';
      let target = '';

      if (commandName === 'dedicate' || commandName === 'd') {
        type = 'dedication';
        target = options.find((o: { name: string }) => o.name === 'to')?.value || 'a friend';
        content = options.find((o: { name: string }) => o.name === 'message')?.value || 'Sending music love!';
      } else if (commandName === 'weather' || commandName === 'w') {
        type = 'weather';
        target = options.find((o: { name: string }) => o.name === 'city')?.value || 'Tokyo';
        content = target;
      } else if (commandName === 'zodiac' || commandName === 'z') {
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

      return NextResponse.json({
        type: 4,
        data: {
          content: slot.confirmationMessage,
        },
      });
    }

    // ── 4. Direct JSON API Request ───────────────────────────────────────────
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
