// src/app/api/radio/now/route.ts
// Live Now Playing & Up Next Status API
// Returns currently playing audio item, upcoming items, active on-air DJ, upvotes, and live listener counts.

import { NextRequest, NextResponse } from 'next/server';
import { createDemoFallbackItem, getNowPlaying, getUpNext } from '@/lib/dj/rotation';
import { getActiveDJ } from '@/lib/dj/roster';
import { getScheduledRequests } from '@/lib/dj/queue';
import { getLiveListenerStats, registerListenerPing } from '@/lib/radio/listeners';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const channelSlug = req.nextUrl.searchParams.get('channel') || 'main';
  const session =
    req.nextUrl.searchParams.get('session') ||
    req.headers.get('x-listener-session') ||
    req.headers.get('x-forwarded-for') ||
    undefined;

  if (session) {
    registerListenerPing(channelSlug, session);
  }

  const fallbackDJ = getActiveDJ(channelSlug);
  const fallbackItem = createDemoFallbackItem(fallbackDJ);

  try {
    let nowPlayingTimeout: ReturnType<typeof setTimeout> | undefined;
    const nowPlayingPromise = new Promise<Awaited<ReturnType<typeof getNowPlaying>>>((resolve) => {
      nowPlayingTimeout = setTimeout(() => {
        resolve({
          item: fallbackItem,
          startedAt: new Date().toISOString(),
          elapsedSeconds: 0,
          activeDJ: fallbackDJ,
          rank: null,
          totalApprovedTracks: null,
        });
      }, 2500);

      getNowPlaying(channelSlug)
        .then((res) => {
          if (nowPlayingTimeout) clearTimeout(nowPlayingTimeout);
          resolve(res);
        })
        .catch(() => {
          if (nowPlayingTimeout) clearTimeout(nowPlayingTimeout);
          resolve({
            item: fallbackItem,
            startedAt: new Date().toISOString(),
            elapsedSeconds: 0,
            activeDJ: fallbackDJ,
            rank: null,
            totalApprovedTracks: null,
          });
        });
    });

    const status = await nowPlayingPromise;

    let upNextTimeout: ReturnType<typeof setTimeout> | undefined;
    const upNextPromise = new Promise<import('@/lib/dj/rotation').AirplayItem[]>((resolve) => {
      upNextTimeout = setTimeout(() => resolve([]), 2500);
      getUpNext(channelSlug, 3, status)
        .then((res) => {
          if (upNextTimeout) clearTimeout(upNextTimeout);
          resolve(res);
        })
        .catch(() => {
          if (upNextTimeout) clearTimeout(upNextTimeout);
          resolve([]);
        });
    });

    const [upNext, scheduledRequests] = await Promise.all([
      upNextPromise,
      getScheduledRequests(5).catch(() => []),
    ]);

    const listenerStats = getLiveListenerStats(channelSlug);

    return NextResponse.json(
      {
        success: true,
        channel: channelSlug,
        now_playing: {
          ...status.item,
          rank: status.rank ?? null,
          total_approved_tracks: status.totalApprovedTracks ?? null,
        },
        up_next: upNext,
        scheduled_requests: scheduledRequests,
        listeners_count: listenerStats.channelListeners,
        listeners: {
          channel: listenerStats.channelListeners,
          network_total: listenerStats.totalNetworkListeners,
          active_channels_count: listenerStats.activeChannelsCount,
        },
        active_dj: status.activeDJ,
        elapsed_seconds: status.elapsedSeconds,
        duration_seconds: status.item.duration_hint_seconds || (status.item.type === 'music' ? 210 : 30),
        started_at: status.startedAt,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
