// src/app/ads.txt/route.ts
// Serves the verified IAB ads.txt file for Google AdSense verification.

import { NextResponse } from 'next/server';
import { generateAdsTxt } from '@/lib/ads/adsense';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export async function GET() {
  const content = generateAdsTxt();

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}

