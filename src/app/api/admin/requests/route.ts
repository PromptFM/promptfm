// src/app/api/admin/requests/route.ts
// Program Director API for Managing Listener Batches & Moderation
// Supports listing upcoming requests by batch, airplay synthesis, and removal with rejection reasons.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rejectScheduledRequest, synthesizeScheduledRequest } from '@/lib/dj/batches';

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

  const supabase = createAdminClient();
  const { data: requests, error } = await supabase
    .from('community_requests')
    .select('*')
    .in('status', ['pending', 'scheduled'])
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: requests || [] });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, requestId, reason, moderator } = body;

    if (!requestId) {
      return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
    }

    if (action === 'reject' || action === 'remove') {
      const rejectionReason = reason || 'Declined by broadcast standards & practices';
      const result = await rejectScheduledRequest(requestId, rejectionReason, moderator || 'Station Director');
      return NextResponse.json(result);
    }

    if (action === 'air') {
      const result = await synthesizeScheduledRequest(requestId);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

