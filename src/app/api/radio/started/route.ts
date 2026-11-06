// src/app/api/radio/started/route.ts
// Liquidsoap Track Transition & On-Air Synchronization Endpoint
// Called automatically by Liquidsoap source.on_track when an audio track or drop starts streaming.

import { NextRequest, NextResponse } from 'next/server';
import { markTrackStarted } from '@/lib/dj/rotation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const channelSlug = (body.channel || req.nextUrl.searchParams.get('channel') || 'main').toLowerCase();
    const itemId = body.item_id || req.nextUrl.searchParams.get('item_id');
    const title = body.title || req.nextUrl.searchParams.get('title');

    if (!itemId && !title) {
      return NextResponse.json(
        { error: 'Missing required item_id or title parameter' },
        { status: 400 }
      );
    }

    const startedItem = await markTrackStarted(channelSlug, itemId, title);

    return NextResponse.json({
      success: true,
      channel: channelSlug,
      now_playing: startedItem,
      started_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error recording airplay track started:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const channelSlug = (req.nextUrl.searchParams.get('channel') || 'main').toLowerCase();
  const itemId = req.nextUrl.searchParams.get('item_id');
  const title = req.nextUrl.searchParams.get('title');

  if (!itemId && !title) {
    return NextResponse.json(
      { error: 'Missing required item_id or title parameter' },
      { status: 400 }
    );
  }

  try {
    const startedItem = await markTrackStarted(channelSlug, itemId, title);
    return NextResponse.json({
      success: true,
      channel: channelSlug,
      now_playing: startedItem,
      started_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

