// src/app/api/library/route.ts
// Public library API endpoint for approved tracks.

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchApprovedCatalogTracks,
  buildPublicCatalog,
  parseCatalogQuery,
} from '@/lib/library/public-catalog';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = parseCatalogQuery(searchParams);
    const tracks = await fetchApprovedCatalogTracks();
    const catalog = buildPublicCatalog(tracks, query);

    return NextResponse.json(catalog);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching public library:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
