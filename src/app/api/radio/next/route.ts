// src/app/api/radio/next/route.ts
// Radio Station Stream Feeder & Next Airplay API
// Called by Liquidsoap, AzuraCast AutoDJ, or the web player to fetch the next audio item.

import { NextRequest, NextResponse } from 'next/server';
import { getNextAirplayItem } from '@/lib/dj/rotation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const channelSlug = req.nextUrl.searchParams.get('channel') || 'main';

  try {
    const nextItem = await getNextAirplayItem(channelSlug);

    return NextResponse.json({
      success: true,
      channel: channelSlug,
      item: nextItem,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching next airplay item:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

