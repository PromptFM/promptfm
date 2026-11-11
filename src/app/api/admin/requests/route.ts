// src/app/api/admin/requests/route.ts
// Program Director API for Managing Listener Batches & Moderation
// Supports listing upcoming requests by batch, airplay synthesis, and removal with rejection reasons.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rejectScheduledRequest, synthesizeScheduledRequest, synthesizeBatchAnnouncement } from '@/lib/dj/batches';
import { isAdminAuthorized } from '@/lib/auth/admin-route-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) {
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
  if (!(await isAdminAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, requestId, reason, moderator } = body;

    if (action === 'air_batch') {
      const { batchId } = body;
      if (!batchId) {
        return NextResponse.json({ error: 'Missing batchId' }, { status: 400 });
      }
      const result = await synthesizeBatchAnnouncement(batchId);
      return NextResponse.json({ success: true, ...result });
    }

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
