// src/app/api/cron/news/route.ts
// Scheduled 7:00 AM Morning AI News Broadcast Hook
// Can be called by Vercel Cron, GitHub Actions, or a curl webhook.

import { NextRequest, NextResponse } from 'next/server';
import { createBroadcastDrop } from '@/lib/dj/engine';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Verify cron secret if configured
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Generate 7 AM Morning News Drop with Gemini + Google TTS
    const { script, audioUrl } = await createBroadcastDrop({
      type: 'news',
      topicOrText: 'Morning AI briefing: Top generative music models, Suno and Udio updates, and trending tracks on PromptFM',
    });

    // 2. Insert into Supabase as an approved broadcast track
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('tracks').insert({
      title: `PromptFM 7 AM Morning AI News`,
      artist_name: 'DJ Neon (AI Host)',
      tool_used: 'Other',
      audio_url: audioUrl,
      status: 'approved',
    }).select().single();

    if (error) {
      console.error('Failed to log morning news track:', error);
    }

    return NextResponse.json({
      success: true,
      message: '7 AM Morning news bulletin synthesized and queued.',
      script,
      audioUrl,
      trackId: data?.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error generating 7 AM news:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

