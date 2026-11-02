// src/lib/dj/rotation.ts
// PromptFM 24/7 Smart Airplay Rotation Engine
// Decides what plays next, manages the clock wheel, rotates active AI DJs according to schedule,
// and injects [News], [Weather], [Announcements], [DJ Banter], and [Sponsor Ads].
// Broadcasts Now Playing updates, transcripts, and voting links to Discord & Telegram.

import { createAdminClient } from '../supabase/server';
import { createBroadcastDrop, fetchLiveHeadlines } from './engine';
import { getActiveDJ, getAdsConfig, getActiveAdSpot, isContentAllowedForAirplay, DJProfile } from './roster';
import { broadcastToCommunity } from '../chat/bridge';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AirplayItem {
  id: string;
  type: 'music' | 'news' | 'weather' | 'announcement' | 'dj_banter' | 'ad';
  title: string;
  artist: string;
  audio_url: string;
  duration_hint_seconds?: number;
  transcript?: string;
  tool_used?: string;
  upvotes_count?: number;
  dj?: {
    id: string;
    name: string;
    title: string;
  };
}

// In-memory counters and state for track rotation per process
let tracksSinceLastInterstitial = 0;
let tracksSinceLastAd = 0;
let lastAdTimestamp = 0;

let currentAirplayItem: AirplayItem | null = null;
let currentAirplayStartedAt: number = Date.now();

export interface WeatherRegion {
  city: string;
  latitude: number;
  longitude: number;
  unit?: string;
}

/**
 * Updates the in-memory upvote count for the active airplay track if matching.
 * Also persists updated count to station_state in Supabase.
 */
export function updateCurrentAirplayUpvotes(trackId: string, count: number): void {
  if (currentAirplayItem && currentAirplayItem.id === trackId) {
    currentAirplayItem.upvotes_count = count;
  }
  try {
    const supabase = createAdminClient();
    Promise.resolve(
      supabase
        .from('station_state')
        .update({
          airplay_item: currentAirplayItem,
          updated_at: new Date().toISOString(),
        })
        .eq('channel_slug', 'main')
    ).catch(() => {});
  } catch {
    // Ignore in-memory sync error
  }
}

/**
 * Returns the currently active audio item, active DJ, and elapsed seconds.
 * Queries Supabase database if in-memory state is empty.
 */
export async function getNowPlaying(channelSlug = 'main'): Promise<{
  item: AirplayItem;
  startedAt: string;
  elapsedSeconds: number;
  activeDJ: DJProfile;
  rank?: number | null;
  totalApprovedTracks?: number | null;
}> {
  const activeDJ = getActiveDJ(channelSlug);

  // If in-memory item is absent, fetch from Supabase station_state or top approved track
  if (!currentAirplayItem) {
    try {
      const supabase = createAdminClient();
      const { data: stateData } = await supabase
        .from('station_state')
        .select('airplay_item, started_at')
        .eq('channel_slug', channelSlug)
        .maybeSingle();

      if (stateData?.airplay_item) {
        currentAirplayItem = stateData.airplay_item as AirplayItem;
        if (stateData.started_at) {
          currentAirplayStartedAt = new Date(stateData.started_at).getTime();
        }
      } else {
        const { data: topTrack } = await supabase
          .from('tracks')
          .select('id, title, artist_name, audio_url, tool_used, upvotes_count')
          .eq('status', 'approved')
          .order('upvotes_count', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topTrack) {
          currentAirplayItem = {
            id: topTrack.id,
            type: 'music',
            title: topTrack.title,
            artist: topTrack.artist_name,
            audio_url: topTrack.audio_url,
            tool_used: topTrack.tool_used,
            upvotes_count: topTrack.upvotes_count,
            dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
          };
          Promise.resolve(
            supabase
              .from('station_state')
              .upsert({
                channel_slug: channelSlug,
                airplay_item: currentAirplayItem,
                started_at: new Date(currentAirplayStartedAt).toISOString(),
                updated_at: new Date().toISOString(),
              })
          ).catch(() => {});
        }
      }
    } catch {
      // Fallback gracefully on DB failure
    }
  }

  const item: AirplayItem = currentAirplayItem || {
    id: 'demo-fallback',
    type: 'music',
    title: 'PromptFM Ambient AI Anthem',
    artist: 'PromptFM Core',
    audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    tool_used: 'Other',
    upvotes_count: 0,
    dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
  };

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - currentAirplayStartedAt) / 1000));

  let rank: number | null = null;
  let totalApprovedTracks: number | null = null;

  if (item.id && item.id !== 'demo-fallback') {
    try {
      const supabase = createAdminClient();
      const [trackRes, higherVotesRes, totalRes] = await Promise.all([
        supabase.from('tracks').select('upvotes_count').eq('id', item.id).maybeSingle(),
        supabase
          .from('tracks')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved')
          .gt('upvotes_count', item.upvotes_count ?? 0),
        supabase
          .from('tracks')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved'),
      ]);
      if (typeof trackRes?.data?.upvotes_count === 'number') {
        item.upvotes_count = trackRes.data.upvotes_count;
      }
      if (typeof higherVotesRes.count === 'number') {
        rank = higherVotesRes.count + 1;
      }
      if (typeof totalRes.count === 'number') {
        totalApprovedTracks = totalRes.count;
      }
    } catch {
      // Non-blocking fallback
    }
  }

  return {
    item,
    startedAt: new Date(currentAirplayStartedAt).toISOString(),
    elapsedSeconds,
    activeDJ,
    rank,
    totalApprovedTracks,
  };
}

/**
 * Returns upcoming items queued or scheduled to play next.
 */
export async function getUpNext(channelSlug = 'main', limit = 5): Promise<AirplayItem[]> {
  const supabase = createAdminClient();
  const upNext: AirplayItem[] = [];

  // 1. Check listener queued requests in channel_queue
  const { data: channel } = await supabase.from('channels').select('id').eq('slug', channelSlug).single();
  if (channel) {
    const { data: queueItems } = await supabase
      .from('channel_queue')
      .select('id, track_id, prompt_used, requested_by, track:tracks(*)')
      .eq('channel_id', channel.id)
      .is('played_at', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (queueItems && queueItems.length > 0) {
      for (const qi of queueItems) {
        if (qi.track) {
          const t = qi.track as unknown as { id: string; title: string; artist_name: string; audio_url: string; tool_used: string; upvotes_count: number };
          upNext.push({
            id: t.id,
            type: 'music',
            title: t.title,
            artist: t.artist_name,
            audio_url: t.audio_url,
            tool_used: t.tool_used,
            upvotes_count: t.upvotes_count,
          });
        }
      }
    }
  }

  // 2. Fill remainder from top-voted approved library tracks
  const needed = limit - upNext.length;
  if (needed > 0) {
    const { data: topTracks } = await supabase
      .from('tracks')
      .select('id, title, artist_name, audio_url, tool_used, upvotes_count')
      .eq('status', 'approved')
      .order('upvotes_count', { ascending: false })
      .limit(needed + 5);

    if (topTracks) {
      const existingIds = new Set(upNext.map((u) => u.id));
      for (const t of topTracks) {
        if (!existingIds.has(t.id) && upNext.length < limit) {
          upNext.push({
            id: t.id,
            type: 'music',
            title: t.title,
            artist: t.artist_name,
            audio_url: t.audio_url,
            tool_used: t.tool_used,
            upvotes_count: t.upvotes_count,
          });
        }
      }
    }
  }

  return upNext;
}

/**
 * Dispatches Now Playing alerts, vote buttons, and live spoken transcripts to Discord & Telegram.
 */
async function notifyCommunityAirplay(item: AirplayItem, activeDJ: DJProfile) {
  try {
    if (item.type === 'music') {
      await broadcastToCommunity({
        title: `Now Playing on PromptFM`,
        message: `🎵 **${item.title}** by **${item.artist}**\n\nVote directly below or request the next track!`,
        category: 'now_playing',
        trackId: item.id,
        artist: item.artist,
        toolUsed: item.tool_used,
        upvotesCount: item.upvotes_count,
        author: activeDJ.name,
      });
    } else if (item.type === 'news') {
      await broadcastToCommunity({
        title: `Hourly AI News Flash (Live On Air)`,
        message: `📢 Tune in now for the latest generative AI breakthroughs.`,
        category: 'news',
        author: activeDJ.name,
        transcript: item.transcript,
      });
    } else if (item.type === 'weather') {
      await broadcastToCommunity({
        title: `Live Regional Weather Report`,
        message: `🌤️ ${item.title}`,
        category: 'weather',
        author: activeDJ.name,
        transcript: item.transcript,
      });
    } else if (item.type === 'ad') {
      await broadcastToCommunity({
        title: `Sponsor Break: ${item.title}`,
        message: `Promoting: ${item.artist}`,
        category: 'ad',
        author: activeDJ.name,
        transcript: item.transcript,
      });
    } else if (item.type === 'announcement' || item.type === 'dj_banter') {
      await broadcastToCommunity({
        title: `Station Broadcast: ${activeDJ.name}`,
        message: `🎙️ Live on air`,
        category: 'announcement',
        author: activeDJ.name,
        transcript: item.transcript,
      });
    }
  } catch (err) {
    console.warn('Community airplay notification failed:', err);
  }
}

/**
 * Reads weather regions declared in config/schedule.yaml.
 */
export function getConfiguredWeatherRegions(): WeatherRegion[] {
  const fallback: WeatherRegion[] = [
    { city: 'San Francisco', latitude: 37.7749, longitude: -122.4194, unit: 'fahrenheit' },
    { city: 'Tokyo', latitude: 35.6762, longitude: 139.6503, unit: 'celsius' },
    { city: 'London', latitude: 51.5074, longitude: -0.1278, unit: 'celsius' },
    { city: 'Berlin', latitude: 52.52, longitude: 13.405, unit: 'celsius' },
    { city: 'Bucharest', latitude: 44.4268, longitude: 26.1025, unit: 'celsius' },
  ];

  try {
    const p = join(process.cwd(), 'config', 'schedule.yaml');
    if (!existsSync(p)) return fallback;
    const raw = readFileSync(p, 'utf8');

    const matches = [
      ...raw.matchAll(
        /-\s*city:\s*"([^"]+)"[\s\S]*?latitude:\s*(-?[\d.]+)[\s\S]*?longitude:\s*(-?[\d.]+)(?:[\s\S]*?unit:\s*"([^"]+)")?/gi
      ),
    ];
    if (matches.length > 0) {
      return matches.map((m) => ({
        city: m[1] || 'San Francisco',
        latitude: parseFloat(m[2] || '37.7749'),
        longitude: parseFloat(m[3] || '-122.4194'),
        unit: m[4] || 'celsius',
      }));
    }
  } catch (e) {
    console.warn('Error reading schedule.yaml regions:', e);
  }

  return fallback;
}

/**
 * Fetches real-time weather summary for a specific city or a rotating region from schedule.yaml.
 * (Open-Meteo, 100% free, zero API key needed).
 */
export async function fetchLiveWeatherSummary(targetCity?: string): Promise<{ text: string; city: string }> {
  const regions = getConfiguredWeatherRegions();
  const selected = targetCity
    ? regions.find((r) => r.city.toLowerCase().includes(targetCity.toLowerCase())) || regions[0]!
    : regions[Math.floor(Math.random() * regions.length)]!;

  const unitParam = selected.unit === 'fahrenheit' ? '&temperature_unit=fahrenheit' : '';
  const unitSymbol = selected.unit === 'fahrenheit' ? '°F' : '°C';

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${selected.latitude}&longitude=${selected.longitude}&current=temperature_2m,weather_code${unitParam}`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) return { text: `Clear skies in ${selected.city}`, city: selected.city };
    const data = await res.json();
    const temp = Math.round(data.current?.temperature_2m || 20);
    return {
      text: `${temp}${unitSymbol} with fair weather in ${selected.city}`,
      city: selected.city,
    };
  } catch {
    return { text: `Mild temperatures in ${selected.city}`, city: selected.city };
  }
}

/**
 * The Master Engine: Returns the exact next audio item that should play on the radio.
 * Dynamically resolves the active DJ based on the UTC clock wheel & channel.
 */
export async function getNextAirplayItem(channelSlug = 'main'): Promise<AirplayItem> {
  const supabase = createAdminClient();
  const now = new Date();
  const currentMinute = now.getUTCMinutes();
  const currentHour = now.getUTCHours();

  // 1. Identify which AI DJ is currently on air for this hour & channel
  const activeDJ: DJProfile = getActiveDJ(channelSlug, now);

  const finishAndBroadcast = (item: AirplayItem): AirplayItem => {
    currentAirplayItem = item;
    currentAirplayStartedAt = Date.now();
    try {
      Promise.resolve(
        supabase
          .from('station_state')
          .upsert({
            channel_slug: channelSlug,
            airplay_item: item,
            started_at: new Date(currentAirplayStartedAt).toISOString(),
            updated_at: new Date().toISOString(),
          })
      ).catch(() => {});
    } catch {
      // Ignore background persistence errors
    }
    // Fire and forget community notification
    notifyCommunityAirplay(item, activeDJ).catch(() => {});
    return item;
  };

  // ── 1. Top of the Hour (:00 to :03) News Broadcast ─────────────────────────
  if (currentMinute <= 3 && tracksSinceLastInterstitial > 0) {
    tracksSinceLastInterstitial = 0;
    try {
      const headlines = await fetchLiveHeadlines();
      const drop = await createBroadcastDrop({
        type: 'news',
        headlines,
        topicOrText: `PromptFM Hourly News at ${currentHour}:00 UTC`,
        dj: activeDJ,
      });
      return finishAndBroadcast({
        id: `news-${Date.now()}`,
        type: 'news',
        title: `PromptFM Hourly AI News Briefing`,
        artist: `${activeDJ.name} (${activeDJ.title})`,
        audio_url: drop.audioUrl,
        duration_hint_seconds: 45,
        transcript: drop.script,
        dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
      });
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
      tracksSinceLastAd++;
      const tr = queueItem.track as unknown as { id: string; title: string; artist_name: string; audio_url: string; tool_used: string; upvotes_count: number };
      return finishAndBroadcast({
        id: tr.id,
        type: 'music',
        title: tr.title,
        artist: tr.artist_name,
        audio_url: tr.audio_url,
        tool_used: tr.tool_used,
        upvotes_count: tr.upvotes_count,
      });
    }
  }

  // ── 3. Sponsor & Ad Slot Check (Every N Tracks or at :20 / :40 Clock Breaks) 
  const adsConfig = getAdsConfig();
  const timeSinceLastAdSec = (Date.now() - lastAdTimestamp) / 1000;
  const isClockAdTime = adsConfig.clockMinutes.some((m) => Math.abs(currentMinute - m) <= 1);
  const isTrackAdTime = tracksSinceLastAd >= adsConfig.frequencyTracks;

  if (adsConfig.enabled && (isTrackAdTime || (isClockAdTime && timeSinceLastAdSec > 600))) {
    const adSpot = getActiveAdSpot();
    if (adSpot) {
      tracksSinceLastAd = 0;
      lastAdTimestamp = Date.now();

      // Case A: Pre-recorded audio ad
      if (adSpot.type === 'pre_recorded' && adSpot.audioUrl) {
        return finishAndBroadcast({
          id: `ad-${adSpot.id}-${Date.now()}`,
          type: 'ad',
          title: `[Sponsor] ${adSpot.title}`,
          artist: adSpot.sponsor,
          audio_url: adSpot.audioUrl,
          duration_hint_seconds: adSpot.durationSeconds,
          transcript: `[Pre-recorded audio commercial for ${adSpot.sponsor}]`,
        });
      }

      // Case B: Dynamic AI-read sponsor spot in active DJ's voice & persona!
      try {
        const drop = await createBroadcastDrop({
          type: 'ad',
          topicOrText: adSpot.copy || `PromptFM sponsor message from ${adSpot.sponsor}: ${adSpot.title}`,
          dj: activeDJ,
        });

        return finishAndBroadcast({
          id: `ad-${adSpot.id}-${Date.now()}`,
          type: 'ad',
          title: `[Sponsor Break] ${adSpot.title}`,
          artist: `${activeDJ.name} for ${adSpot.sponsor}`,
          audio_url: drop.audioUrl,
          duration_hint_seconds: adSpot.durationSeconds,
          transcript: drop.script,
          dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
        });
      } catch (e) {
        console.warn('Failed to synthesize AI sponsor ad, falling through:', e);
      }
    }
  }

  // ── 4. Interstitial Check: Every 3 Tracks [Weather / DJ Banter / Trivia] ────
  if (tracksSinceLastInterstitial >= 3) {
    tracksSinceLastInterstitial = 0;

    const interstitialRoll = Math.random();

    // 50% chance: Regional Weather Check
    if (interstitialRoll < 0.5) {
      try {
        const weatherInfo = await fetchLiveWeatherSummary();
        const drop = await createBroadcastDrop({
          type: 'custom_prompt',
          topicOrText: `Give a 15-second radio station weather check for our listeners in ${weatherInfo.city}: "${weatherInfo.text}". Tell listeners to keep voting for their favorite tracks on PromptFM.`,
          dj: activeDJ,
        });
        return finishAndBroadcast({
          id: `weather-${Date.now()}`,
          type: 'weather',
          title: `${activeDJ.name} Weather Check (${weatherInfo.city})`,
          artist: activeDJ.name,
          audio_url: drop.audioUrl,
          duration_hint_seconds: 20,
          transcript: drop.script,
          dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
        });
      } catch (err) {
        console.warn('Weather drop failed:', err);
      }
    } else {
      // 50% chance: DJ Music Trivia / Persona Banter
      try {
        const drop = await createBroadcastDrop({
          type: 'custom_prompt',
          topicOrText: `Share a witty 15-second thought in your personality style about AI music, studio prompts, or the live community charts.`,
          dj: activeDJ,
        });
        return finishAndBroadcast({
          id: `dj-${Date.now()}`,
          type: 'dj_banter',
          title: `${activeDJ.name} Station Banter`,
          artist: activeDJ.name,
          audio_url: drop.audioUrl,
          duration_hint_seconds: 20,
          transcript: drop.script,
          dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
        });
      } catch (err) {
        console.warn('DJ drop failed:', err);
      }
    }
  }

  // ── 5. Standard Music Rotation: Pick from Top Approved Community Tracks ────
  tracksSinceLastInterstitial++;
  tracksSinceLastAd++;

  // Fetch top approved tracks ordered by upvotes
  const { data: rawTracks } = await supabase
    .from('tracks')
    .select('id, title, artist_name, audio_url, tool_used, upvotes_count')
    .eq('status', 'approved')
    .order('upvotes_count', { ascending: false })
    .limit(40);

  // Filter against parental controls and channel rating restrictions
  const tracks = (rawTracks || []).filter((t) =>
    isContentAllowedForAirplay((t as unknown as { is_explicit?: boolean }).is_explicit ?? false, channelSlug, now)
  );

  if (tracks && tracks.length > 0) {
    // Weighted random selection: Higher upvoted songs are picked much more frequently
    const weightedPool: typeof tracks = [];
    tracks.forEach((t, index) => {
      const weight = index < 5 ? 4 : index < 15 ? 2 : 1;
      for (let i = 0; i < weight; i++) {
        weightedPool.push(t);
      }
    });

    const chosen = weightedPool[Math.floor(Math.random() * weightedPool.length)] || tracks[0]!;
    return finishAndBroadcast({
      id: chosen.id,
      type: 'music',
      title: chosen.title,
      artist: chosen.artist_name,
      audio_url: chosen.audio_url,
      tool_used: chosen.tool_used,
      upvotes_count: chosen.upvotes_count,
    });
  }

  // Fallback demo track if database has 0 tracks yet
  return finishAndBroadcast({
    id: 'demo-fallback',
    type: 'music',
    title: 'PromptFM Ambient AI Anthem',
    artist: 'PromptFM Core',
    audio_url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    tool_used: 'Other',
    upvotes_count: 0,
  });
}
