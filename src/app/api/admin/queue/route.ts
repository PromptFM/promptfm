// src/app/api/admin/queue/route.ts
// Admin API endpoint for Live Airplay Queue Management (Issue #43)
// Leverages the Unified Song Pathway for Queue Status, Live ETAs, and Priority Scheduling.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { queueSong, getSongQueueStatus } from '@/lib/song/pathway';

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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const channelSlug = req.nextUrl.searchParams.get('channel') || 'main';
  const query = req.nextUrl.searchParams.get('q') || undefined;

  try {
    const queueStatus = await getSongQueueStatus(channelSlug, query);
    return NextResponse.json({ success: true, ...queueStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await queueSong({
      source: 'web_admin',
      requestedBy: body.requested_by || 'Station Admin',
      prompt: body.prompt,
      trackId: body.track_id,
      channelSlug: body.channel || 'main',
      priority: Boolean(body.priority),
    });

    return NextResponse.json({
      success: result.status === 'queued' || result.status === 'already_queued',
      result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const queueId = body.queue_id || req.nextUrl.searchParams.get('id');

    if (!queueId) {
      return NextResponse.json({ error: 'Missing queue_id' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from('channel_queue').delete().eq('id', queueId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, removed_id: queueId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
