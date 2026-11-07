// src/app/api/admin/reports/route.ts
// Station Admin endpoint to view and action community content reports.

import { NextRequest, NextResponse } from 'next/server';
import { getRecentReports, resolveContentReport, auditContentReports } from '@/lib/safety/reports';
import { isAdminAuthorized } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const isAudit = req.nextUrl.searchParams.get('audit') === 'true' || req.nextUrl.searchParams.get('audit') === '1';
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 30;

    if (isAudit) {
      const audit = await auditContentReports({ limit });
      return NextResponse.json({ success: true, audit });
    }

    const reports = await getRecentReports(limit);
    return NextResponse.json({ success: true, reports });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { reportId, action, notes, actor } = body; // action: 'actioned' | 'dismissed'

    if (!reportId || !action) {
      return NextResponse.json({ error: 'Missing reportId or action' }, { status: 400 });
    }

    const result = actor !== undefined
      ? await resolveContentReport(reportId, action, notes, actor)
      : await resolveContentReport(reportId, action, notes);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
