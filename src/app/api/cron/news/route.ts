// src/app/api/cron/news/route.ts
// Scheduled 7:00 AM Morning AI News Broadcast Hook
// Scrapes live news headlines from RSS feeds, prompts Gemini to write a snappy 40s script,
// synthesizes the DJ voice via Google Cloud TTS, and queues the audio drop on R2 & Supabase.

import { NextRequest, NextResponse } from 'next/server';
import { createBroadcastDrop, fetchLiveHeadlines } from '@/lib/dj/engine';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Optional cron authorization check
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch live tech & AI music headlines from RSS feeds (Hacker News, Google News AI)
    const headlines = await fetchLiveHeadlines();

    // 2. Prompt Gemini Pro to review headlines and synthesize broadcast drop
    const { script, audioUrl } = await createBroadcastDrop({
      type: 'news',
      headlines,
      topicOrText: 'Morning AI briefing: Top generative music models, Suno and Udio updates, and trending community tracks on PromptFM',
    });

    // 3. Insert into Supabase as an approved broadcast track
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('tracks').insert({
      title: `PromptFM 7 AM Morning AI News (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
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
      headlines_scraped_count: headlines.length,
      top_headline_used: headlines[0] || 'N/A',
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
