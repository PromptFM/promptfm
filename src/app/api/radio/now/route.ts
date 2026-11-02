// src/app/api/radio/now/route.ts
// Live Now Playing Status API
// Returns currently playing audio item, active on-air DJ, upvotes, and live spoken transcript.

import { NextRequest, NextResponse } from 'next/server';
import { getNowPlaying } from '@/lib/dj/rotation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const channelSlug = req.nextUrl.searchParams.get('channel') || 'main';

  try {
    const status = await getNowPlaying(channelSlug);

    return NextResponse.json({
      success: true,
      channel: channelSlug,
      now_playing: status.item,
      active_dj: status.activeDJ,
      elapsed_seconds: status.elapsedSeconds,
      started_at: status.startedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

