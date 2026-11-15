// src/app/api/library/queue/route.ts
// Direct track queueing endpoint from the public song library.

import { NextRequest, NextResponse } from 'next/server';
import { parseLibraryQueueBody } from '@/lib/library/public-catalog';
import { queueSong } from '@/lib/song/pathway';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body. A valid track ID is required.' },
        { status: 400 }
      );
    }

    const parsed = parseLibraryQueueBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const voterId = req.headers.get('x-forwarded-for') || 'web-listener';
    const result = await queueSong({
      trackId: parsed.trackId,
      source: 'web',
      requestedBy: 'Web Listener',
      userId: voterId,
    });

    if (result.isRejected || result.status === 'rejected') {
      return NextResponse.json(
        { error: result.confirmationMessage || 'Song request rejected.' },
        { status: 400 }
      );
    }

    if (result.status === 'no_match') {
      return NextResponse.json(
        { error: 'Track not found in approved catalog.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      trackId: parsed.trackId,
      message: result.confirmationMessage || `Queued track for airplay.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error queueing library track:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
