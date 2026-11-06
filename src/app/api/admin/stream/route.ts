// src/app/api/admin/stream/route.ts
// Admin RTMP Live Streaming Control API
// Supports starting, stopping, and inspecting RTMP broadcast streams to YouTube and TikTok.

import { NextRequest, NextResponse } from 'next/server';
import {
  getStreamStatus,
  startStream,
  stopStream,
  validateStreamConfig,
  type StreamPlatform,
} from '@/lib/streaming/rtmp-controller';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return true; // Default allow in local dev when unconfigured

  const authHeader = req.headers.get('authorization');
  const xAdminKey = req.headers.get('x-admin-key');
  const queryKey = req.nextUrl.searchParams.get('key');

  return (
    authHeader === `Bearer ${adminKey}` ||
    xAdminKey === adminKey ||
    queryKey === adminKey
  );
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = await getStreamStatus();
    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const platform = body.platform as StreamPlatform;

    if (!platform || (platform !== 'youtube' && platform !== 'tiktok')) {
      return NextResponse.json(
        { error: 'Valid platform ("youtube" | "tiktok") is required' },
        { status: 400 }
      );
    }

    if (action === 'start') {
      const streamKey = body.streamKey?.trim();
      const rtmpUrl = body.rtmpUrl?.trim();

      if (!streamKey) {
        return NextResponse.json(
          { error: 'streamKey is required to start a stream' },
          { status: 400 }
        );
      }

      const validation = validateStreamConfig({ platform, streamKey, rtmpUrl });
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || 'Invalid stream configuration' },
          { status: 400 }
        );
      }

      const result = await startStream({ platform, streamKey, rtmpUrl });
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action === 'stop') {
      const result = await stopStream(platform);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be "start" or "stop"' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

