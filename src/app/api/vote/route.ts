// src/app/api/vote/route.ts
// Track Upvote API
// Allows listeners to cast real-time upvotes for tracks from the web player.

import { NextRequest, NextResponse } from 'next/server';
import { castVoteForTrack } from '@/lib/chat/bridge';
import { updateCurrentAirplayUpvotes } from '@/lib/dj/rotation';
import { isFeatureEnabled } from '@/lib/flags/feature-flags';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!isFeatureEnabled('community_voting', true)) {
      return NextResponse.json(
        { error: 'Community voting is currently disabled by station administrators.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const trackId = body?.trackId?.trim();

    if (!trackId) {
      return NextResponse.json({ error: 'Missing or empty trackId in request body.' }, { status: 400 });
    }

    const voterId = req.headers.get('x-forwarded-for') || 'web-listener';
    const result = await castVoteForTrack(trackId, voterId);

    if (!result.success) {
      return NextResponse.json({ error: 'Could not register vote for this track.' }, { status: 404 });
    }

    // Update in-memory airplay item if currently active
    updateCurrentAirplayUpvotes(trackId, result.newCount);

    return NextResponse.json({
      success: true,
      trackId,
      upvotes_count: result.newCount,
      title: result.title,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error handling track vote:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

