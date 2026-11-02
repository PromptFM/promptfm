// src/lib/dj/rotation.ts
// PromptFM 24/7 Smart Airplay Rotation Engine
// Decides what plays next, manages the clock wheel, and injects
// [News], [Weather], [Announcements], and [DJ Intros] between music tracks.

import { createAdminClient } from '../supabase/server';
import { createBroadcastDrop, fetchLiveHeadlines } from './engine';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AirplayItem {
  id: string;
  type: 'music' | 'news' | 'weather' | 'announcement' | 'dj_banter';
  title: string;
  artist: string;
  audio_url: string;
  duration_hint_seconds?: number;
}

// In-memory counter for track rotation per process
let tracksSinceLastInterstitial = 0;

/**
 * Fetches real-time weather summary (Open-Meteo, 100% free, zero API key).
 */
export async function fetchLiveWeatherSummary(): Promise<string> {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m,weather_code&temperature_unit=fahrenheit',
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) return 'Clear skies across the synthetic airwaves';
    const data = await res.json();
    const temp = Math.round(data.current?.temperature_2m || 72);
    return `Currently ${temp}°F and clear skies`;
  } catch {
    return 'Clear skies and warm signals';
  }
}

/**
 * The Master Engine: Returns the exact next audio item that should play on the radio.
 */
export async function getNextAirplayItem(channelSlug = 'main'): Promise<AirplayItem> {
  const supabase = createAdminClient();
  const now = new Date();
  const currentMinute = now.getUTCMinutes();
  const currentHour = now.getUTCHours();

  // ── 1. Check for Top of the Hour (:00 to :03) News Broadcast ───────────────
  if (currentMinute <= 3 && tracksSinceLastInterstitial > 0) {
    tracksSinceLastInterstitial = 0;
    try {
      const headlines = await fetchLiveHeadlines();
      const drop = await createBroadcastDrop({
        type: 'news',
        headlines,
        topicOrText: `PromptFM Hourly News at ${currentHour}:00 UTC`,
      });
      return {
        id: `news-${Date.now()}`,
        type: 'news',
        title: `PromptFM Hourly AI News Briefing`,
        artist: 'DJ Neon (AI Host)',
        audio_url: drop.audioUrl,
        duration_hint_seconds: 45,
      };
    } catch (e) {
      console.warn('Failed to generate top-of-hour news, falling back to music:', e);
    }
  }

  // ── 2. Check for Listener Prompt Requests in the Channel Queue ─────────────
  const { data: channel } = await supabase.from('channels').select('id').eq('slug', channelSlug).single();

  if (channel) {
    const { data: queueItem } = await supabase
      .from('channel_queue')
      .select('id, track_id, prompt_used, requested_by, track:tracks(*)')
      .eq('channel_id', channel.id)
      .is('played_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (queueItem && queueItem.track) {
      // Mark as played
      await supabase.from('channel_queue').update({ played_at: new Date().toISOString() }).eq('id', queueItem.id);

      tracksSinceLastInterstitial++;
      const tr = queueItem.track as unknown as { id: string; title: string; artist_name: string; audio_url: string };
      return {
        id: tr.id,
        type: 'music',
        title: tr.title,
        artist: tr.artist_name,
        audio_url: tr.audio_url,
      };
    }
  }

  // ── 3. Interstitial Check: Every 3 Tracks, Inject [Weather / DJ Drop / Banter] ──
  if (tracksSinceLastInterstitial >= 3) {
    tracksSinceLastInterstitial = 0;

    const interstitialRoll = Math.random();

    // 50% chance: Weather & Station Vibe
    if (interstitialRoll < 0.5) {
      try {
        const weatherInfo = await fetchLiveWeatherSummary();
        const drop = await createBroadcastDrop({
          type: 'custom_prompt',
          topicOrText: `Give a 15-second radio station weather check and vibe check: "${weatherInfo}". Tell listeners to keep upvoting their favorite AI tracks on PromptFM.`,
        });
        return {
          id: `weather-${Date.now()}`,
          type: 'weather',
          title: 'DJ Neon Weather & Station Check',
          artist: 'DJ Neon',
          audio_url: drop.audioUrl,
          duration_hint_seconds: 20,
        };
      } catch (err) {
        console.warn('Weather drop failed:', err);
      }
    } else {
      // 50% chance: Fun DJ Music Trivia or Model Banter
      try {
        const drop = await createBroadcastDrop({
          type: 'custom_prompt',
          topicOrText: 'Tell a witty 15-second thought about AI producers creating hits from bedroom laptops, and hype up the community chart.',
        });
        return {
          id: `dj-${Date.now()}`,
          type: 'dj_banter',
          title: 'DJ Neon Station Banter',
          artist: 'DJ Neon',
          audio_url: drop.audioUrl,
          duration_hint_seconds: 20,
        };
      } catch (err) {
        console.warn('DJ drop failed:', err);
      }
    }
  }

  // ── 4. Standard Music Rotation: Pick from Top Approved Community Tracks ────
  tracksSinceLastInterstitial++;

  // Fetch top approved tracks ordered by upvotes
  const { data: tracks } = await supabase
    .from('tracks')
    .select('id, title, artist_name, audio_url, upvotes_count')
    .eq('status', 'approved')
    .order('upvotes_count', { ascending: false })
    .limit(30);

  if (tracks && tracks.length > 0) {
    // Weighted random selection: Higher upvoted songs are picked much more frequently
    // top 5 tracks get 3x weight
    const weightedPool: typeof tracks = [];
    tracks.forEach((t, index) => {
      const weight = index < 5 ? 4 : index < 15 ? 2 : 1;
      for (let i = 0; i < weight; i++) {
        weightedPool.push(t);
      }
    });

    const chosen = weightedPool[Math.floor(Math.random() * weightedPool.length)] || tracks[0]!;
    return {
      id: chosen.id,
      type: 'music',
      title: chosen.title,
      artist: chosen.artist_name,
      audio_url: chosen.audio_url,
    };
  }

  // Fallback demo track if database has 0 tracks yet
  return {
    id: 'demo-fallback',
    type: 'music',
    title: 'PromptFM Ambient AI Anthem',
    artist: 'PromptFM Core',
    audio_url: 'https://ice1.somafm.com/groovesalad-128-mp3',
  };
}
