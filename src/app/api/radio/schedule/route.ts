// src/app/api/radio/schedule/route.ts
// 24/7 Channel Broadcast Schedule API
// Delivers daily programming blocks, live shows, clock milestones, and DJ rosters.

import { NextRequest, NextResponse } from 'next/server';
import { getStationSchedule, getAllChannelsSchedule } from '@/lib/radio/schedule';
import { getNowPlaying } from '@/lib/dj/rotation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const channelSlug = (req.nextUrl.searchParams.get('channel') || 'main').toLowerCase();
    const returnAll = req.nextUrl.searchParams.get('all') === 'true';

    if (returnAll) {
      const allSchedules = getAllChannelsSchedule();
      return NextResponse.json(
        {
          success: true,
          channels: allSchedules,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    const [schedule, nowPlaying] = await Promise.all([
      getStationSchedule(channelSlug),
      getNowPlaying(channelSlug),
    ]);

    return NextResponse.json(
      {
        success: true,
        channel: schedule.channel,
        current_show: schedule.current_show,
        upcoming_shows: schedule.upcoming_shows,
        blocks: schedule.blocks,
        now_playing: {
          ...nowPlaying.item,
          elapsed_seconds: nowPlaying.elapsedSeconds,
          duration_seconds: nowPlaying.item.duration_hint_seconds || (nowPlaying.item.type === 'music' ? 210 : 30),
          rank: nowPlaying.rank ?? null,
        },
        timestamp: schedule.generated_at_utc,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching broadcast schedule:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

