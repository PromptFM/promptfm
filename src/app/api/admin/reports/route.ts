// src/app/api/admin/reports/route.ts
// Station Admin endpoint to view and action community content reports.

import { NextRequest, NextResponse } from 'next/server';
import { getRecentReports, resolveContentReport } from '@/lib/safety/reports';

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
    const { reportId, action, notes } = body; // action: 'actioned' | 'dismissed'

    if (!reportId || !action) {
      return NextResponse.json({ error: 'Missing reportId or action' }, { status: 400 });
    }

    const result = await resolveContentReport(reportId, action, notes);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

