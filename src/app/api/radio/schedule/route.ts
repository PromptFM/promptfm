// src/app/api/radio/schedule/route.ts
// 24/7 Channel Broadcast Schedule API
// Delivers daily programming blocks, live shows, clock milestones, and DJ rosters.

import { NextRequest, NextResponse } from 'next/server';
import { getStationSchedule, getAllChannelsSchedule } from '@/lib/radio/schedule';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const channelSlug = (req.nextUrl.searchParams.get('channel') || 'main').toLowerCase();
    const returnAll = req.nextUrl.searchParams.get('all') === 'true';

    if (returnAll) {
      const allSchedules = getAllChannelsSchedule();
      return NextResponse.json({
        success: true,
        channels: allSchedules,
        timestamp: new Date().toISOString(),
      });
    }

    const schedule = getStationSchedule(channelSlug);

    return NextResponse.json({
      success: true,
      channel: schedule.channel,
      current_show: schedule.current_show,
      upcoming_shows: schedule.upcoming_shows,
      blocks: schedule.blocks,
      timestamp: schedule.generated_at_utc,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching broadcast schedule:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
