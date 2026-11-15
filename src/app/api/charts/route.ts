// src/app/api/charts/route.ts
// Public charts API endpoint for weekly top tracks with direct PostgreSQL failover.

import { NextRequest, NextResponse } from 'next/server';
import { fetchTopApprovedTracks } from '@/lib/charts/charts-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawLimit = req.nextUrl.searchParams.get('limit');
    const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : 20;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;

    const items = await fetchTopApprovedTracks({ limit });
    return NextResponse.json({ items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching weekly charts:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
