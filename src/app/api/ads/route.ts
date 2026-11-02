// src/app/api/ads/route.ts
// PromptFM Website Ads Discovery & Telemetry API
// Serves active banners and logs anonymous privacy-compliant ad impressions and clicks.

import { NextResponse } from 'next/server';
import {
  getActiveSponsorBanners,
  DEFAULT_SPONSOR_CAMPAIGNS,
  recordAdEvent,
  getAdStats,
  type AdPlacement,
  type AdEventType,
} from '@/lib/ads/banner-service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const placement = searchParams.get('placement') as AdPlacement | null;

  const banners = placement
    ? getActiveSponsorBanners(placement)
    : DEFAULT_SPONSOR_CAMPAIGNS.filter((b) => b.active);

  return NextResponse.json({
    success: true,
    banners,
  });
}

export async function POST(req: Request) {
  let body: { adId?: string; event?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { adId, event } = body;
  if (!adId || !event || (event !== 'impression' && event !== 'click')) {
    return NextResponse.json(
      { success: false, error: 'Invalid adId or event type' },
      { status: 400 }
    );
  }

  const recorded = recordAdEvent(adId, event as AdEventType);
  const stats = getAdStats(adId);

  return NextResponse.json({
    success: recorded,
    stats,
  });
}
