// src/app/api/radio/next/route.ts
// Radio Station Stream Feeder & Next Airplay API
// Called by Liquidsoap, AzuraCast AutoDJ, or the web player to fetch the next audio item.

import { NextRequest, NextResponse } from 'next/server';
import { getNextAirplayItem } from '@/lib/dj/rotation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const channelSlug = req.nextUrl.searchParams.get('channel') || 'main';
  const format = req.nextUrl.searchParams.get('format')?.toLowerCase();

  try {
    const nextItem = await getNextAirplayItem(channelSlug);

    if (format === 'uri' || format === 'raw') {
      return new NextResponse(nextItem?.audio_url || '', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    return NextResponse.json({
      success: true,
      channel: channelSlug,
      item: nextItem,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching next airplay item:', message);

    if (format === 'uri' || format === 'raw') {
      return new NextResponse('', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

