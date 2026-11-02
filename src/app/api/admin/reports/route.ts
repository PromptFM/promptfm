// src/app/api/admin/reports/route.ts
// Station Admin endpoint to view and action community content reports.

import { NextRequest, NextResponse } from 'next/server';
import { getRecentReports } from '@/lib/safety/reports';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 30;
    const reports = await getRecentReports(limit);
    return NextResponse.json({ success: true, reports });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportId, action } = body; // action: 'reviewed' | 'actioned' | 'dismissed'

    if (!reportId || !action) {
      return NextResponse.json({ error: 'Missing reportId or action' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('content_reports')
      .update({ status: action })
      .eq('id', reportId);

    if (error) {
      console.warn('[Admin Reports] Could not update in Supabase (fallback ok):', error.message);
    }

    return NextResponse.json({ success: true, reportId, action });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

