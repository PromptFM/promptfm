// src/app/api/admin/broadcast/route.ts
// Program Director Social Broadcast API
// Dispatches announcements across Discord, Telegram, and X (Twitter).

import { NextRequest, NextResponse } from 'next/server';
import { sendDiscordNotification, sendTelegramNotification } from '@/lib/chat/bridge';
import { postTweetToX, TweetResult } from '@/lib/social/x-client';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return true; // Default allow in local dev

  const authHeader = req.headers.get('authorization');
  const xAdminKey = req.headers.get('x-admin-key');
  const queryKey = req.nextUrl.searchParams.get('key');

  return (
    authHeader === `Bearer ${adminKey}` ||
    xAdminKey === adminKey ||
    queryKey === adminKey
  );
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const title = body.title?.trim() || 'PromptFM Live Announcement';
    const url = body.url?.trim() || 'https://promptfm.live';
    const postToDiscord = body.postToDiscord !== false;
    const postToTelegram = body.postToTelegram !== false;
    const postToX = Boolean(body.postToX);

    const results: {
      discord?: boolean;
      telegram?: boolean;
      x?: TweetResult;
    } = {};

    const tasks: Promise<unknown>[] = [];

    if (postToDiscord) {
      tasks.push(
        sendDiscordNotification({
          title,
          message,
          url,
          category: 'announcement',
          author: 'Station Director',
        }).then((res) => {
          results.discord = res;
        })
      );
    }

    if (postToTelegram) {
      tasks.push(
        sendTelegramNotification({
          title,
          message,
          url,
          category: 'announcement',
          author: 'Station Director',
        }).then((res) => {
          results.telegram = res;
        })
      );
    }

    if (postToX) {
      const tweetBody = `${title}: ${message}`;
      const safeText = tweetBody.length > 270 ? `${tweetBody.slice(0, 267)}...` : tweetBody;
      tasks.push(
        postTweetToX(safeText, { url }).then((res) => {
          results.x = res;
        })
      );
    }

    await Promise.allSettled(tasks);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

