// src/app/api/admin/reports/audit/route.ts
// Station Admin endpoint to audit content reports for changes made during unauthenticated windows.

import { NextRequest, NextResponse } from 'next/server';
import { auditContentReports } from '@/lib/safety/reports';
import { isAdminAuthorized } from '@/lib/auth/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;
    const audit = await auditContentReports({ limit });
    return NextResponse.json({ success: true, audit });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
