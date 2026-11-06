// src/app/api/radio/channels/route.ts
// PromptFM Live Theme Channels Discovery Endpoint

import { NextRequest, NextResponse } from 'next/server';
import { getAllChannels, getActiveChannels } from '@/lib/radio/channels';
import { getActiveDJ } from '@/lib/dj/roster';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const onlyActive =
    req.nextUrl?.searchParams?.get('active') === 'true' ||
    req.nextUrl?.searchParams?.get('active_only') === 'true';

  const channels = onlyActive ? getActiveChannels() : getAllChannels();
  const now = new Date();

  const enrichedChannels = channels.map((channel) => {
    const activeDJ = getActiveDJ(channel.slug, now);
    return {
      ...channel,
      is_active: channel.isActive,
      active_dj: {
        id: activeDJ.id,
        name: activeDJ.name,
        title: activeDJ.title,
        voice: activeDJ.voice,
      },
    };
  });

  return NextResponse.json(
    {
      success: true,
      channels: enrichedChannels,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
      },
    }
  );
}
