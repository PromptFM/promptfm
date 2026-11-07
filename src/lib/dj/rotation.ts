// src/lib/dj/rotation.ts
// PromptFM 24/7 Smart Airplay Rotation Engine
// Decides what plays next, manages the clock wheel, rotates active AI DJs according to schedule,
// and injects [News], [Weather], [Announcements], [DJ Banter], and [Sponsor Ads].
// Broadcasts Now Playing updates, transcripts, and voting links to Discord & Telegram.

import { createAdminClient } from '../supabase/server';
import { createBroadcastDrop, fetchLiveHeadlines } from './engine';
import { getActiveDJ, getAdsConfig, getActiveAdSpot, isContentAllowedForAirplay, DJProfile } from './roster';
import { getStationSchedule } from '../radio/schedule';
import { broadcastToCommunity } from '../chat/bridge';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AirplayItem {
  id: string;
  type: 'music' | 'news' | 'weather' | 'announcement' | 'dj_banter' | 'ad';
  title: string;
  artist: string;
  audio_url: string;
  cover_art_url?: string;
  category?: string;
  description?: string | null;
  lyrics?: string | null;
  duration_hint_seconds?: number;
  transcript?: string;
  tool_used?: string;
  upvotes_count?: number;
  requested_by?: string;
  estimated_air_time?: string;
  queue_position?: number;
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

// In-memory per-channel airplay track and start timestamp tracking
const channelAirplayItems = new Map<string, AirplayItem>();
const channelAirplayStartedAt = new Map<string, number>();

let currentAirplayItem: AirplayItem | null = null;
let currentAirplayStartedAt: number = Date.now();
let pendingAirplayItem: AirplayItem | null = null;
const pendingAirplayItems = new Map<string, AirplayItem>();

const recentAirplayAnnouncedByChannel = new Map<string, Map<string, number>>();

export function isAirplayRecentlyAnnounced(channelSlug: string, trackId: string): boolean {
  const map = recentAirplayAnnouncedByChannel.get(channelSlug);
  if (!map) return false;
  const airedAt = map.get(trackId);
  if (airedAt && Date.now() - airedAt < 60_000) {
    return true;
  }
  return false;
}

export function recordAirplayAnnounced(channelSlug: string, trackId: string): void {
  let map = recentAirplayAnnouncedByChannel.get(channelSlug);
  if (!map) {
    map = new Map<string, number>();
    recentAirplayAnnouncedByChannel.set(channelSlug, map);
  }
  map.set(trackId, Date.now());
}

/**
 * Resets the in-memory cache used to deduplicate now-playing community announcements.
 */
export function resetAirplayDedupeCache(): void {
  recentAirplayAnnouncedByChannel.clear();
  pendingAirplayItems.clear();
  pendingAirplayItem = null;
}

/**
 * Formats an AirplayItem into a Liquidsoap annotate: string with metadata tags.
 * Allows Liquidsoap to stream ICY metadata (title, artist) and report track start.
 */
export function formatLiquidsoapAnnotateUri(item: AirplayItem): string {
  const safeTitle = (item.title || 'PromptFM Live').replace(/"/g, "'");
  const safeArtist = (item.artist || 'AI Generated').replace(/"/g, "'");
  const safeId = (item.id || 'demo-fallback').replace(/"/g, "'");
  return `annotate:title="${safeTitle}",artist="${safeArtist}",promptfm_id="${safeId}":${item.audio_url}`;
}

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
  for (const [slug, item] of channelAirplayItems.entries()) {
    if (item.id === trackId) {
      item.upvotes_count = count;
      try {
        const supabase = createAdminClient();
        Promise.resolve(
          supabase
            .from('station_state')
            .update({
              airplay_item: item,
              updated_at: new Date().toISOString(),
            })
            .eq('channel_slug', slug)
        ).catch(() => {});
      } catch {
        // Ignore in-memory sync error
      }
    }
  }
}

/**
 * Queries Icecast's status-json.xsl for the live on-air stream title.
 * Used to verify and reconcile what listeners are actively hearing on Icecast.
 */
export async function getIcecastLiveTitle(): Promise<{ title: string; artist?: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('https://stream.promptfm.live/status-json.xsl', {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    const source = json?.icestats?.source;
    if (!source) return null;
    const mount = Array.isArray(source) ? source[0] : source;
    const rawTitle = mount?.title;
    if (!rawTitle || typeof rawTitle !== 'string') return null;
    if (rawTitle.includes(' - ')) {
      const parts = rawTitle.split(' - ');
      const artist = parts[0]?.trim();
      const title = parts.slice(1).join(' - ').trim();
      return { title, artist };
    }
    return { title: rawTitle.trim() };
  } catch {
    return null;
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

  let item = channelAirplayItems.get(channelSlug) || null;
  let startedAtMs = channelAirplayStartedAt.get(channelSlug) || 0;

  // If in-memory item is absent, fetch from Supabase station_state or top approved track
  if (!item) {
    try {
      const supabase = createAdminClient();
      const { data: stateData } = await supabase
        .from('station_state')
        .select('airplay_item, started_at')
        .eq('channel_slug', channelSlug)
        .maybeSingle();

      if (stateData?.airplay_item) {
        item = stateData.airplay_item as AirplayItem;
        if (stateData.started_at) {
          startedAtMs = new Date(stateData.started_at).getTime();
        } else {
          startedAtMs = Date.now();
        }
        channelAirplayItems.set(channelSlug, item);
        channelAirplayStartedAt.set(channelSlug, startedAtMs);
        if (channelSlug === 'main') {
          currentAirplayItem = item;
          currentAirplayStartedAt = startedAtMs;
        }
      } else {
        const { data: topTrack } = await supabase
          .from('tracks')
          .select('id, title, artist_name, audio_url, tool_used, upvotes_count, cover_art_url, category, description, lyrics')
          .eq('status', 'approved')
          .order('upvotes_count', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topTrack) {
          item = {
            id: topTrack.id,
            type: 'music',
            title: topTrack.title,
            artist: topTrack.artist_name,
            audio_url: topTrack.audio_url,
            cover_art_url: (topTrack as unknown as { cover_art_url?: string }).cover_art_url || '/logo-mark.png',
            category: (topTrack as unknown as { category?: string }).category,
            description: (topTrack as unknown as { description?: string }).description,
            lyrics: (topTrack as unknown as { lyrics?: string }).lyrics,
            tool_used: topTrack.tool_used,
            upvotes_count: topTrack.upvotes_count,
            dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
          };
          startedAtMs = Date.now();
          channelAirplayItems.set(channelSlug, item);
          channelAirplayStartedAt.set(channelSlug, startedAtMs);
          if (channelSlug === 'main') {
            currentAirplayItem = item;
            currentAirplayStartedAt = startedAtMs;
          }

          try {
            await supabase
              .from('station_state')
              .upsert({
                channel_slug: channelSlug,
                airplay_item: item,
                started_at: new Date(startedAtMs).toISOString(),
                updated_at: new Date().toISOString(),
              });
          } catch {
            // Ignore persistence fallback
          }
        }
      }
    } catch {
      // Fallback gracefully on DB failure
    }
  }

  // Live Icecast On-Air Stream Reconciliation for Main Stage
  if (channelSlug === 'main' && item) {
    try {
      const icecastLive = await getIcecastLiveTitle();
      if (
        icecastLive?.title &&
        icecastLive.title.toLowerCase() !== item.title.toLowerCase()
      ) {
        let matchedItem: AirplayItem | null = null;

        if (
          pendingAirplayItem &&
          pendingAirplayItem.title.toLowerCase() === icecastLive.title.toLowerCase()
        ) {
          matchedItem = pendingAirplayItem;
          pendingAirplayItem = null;
        } else if (icecastLive.title === 'PromptFM Ambient AI Anthem') {
          matchedItem = {
            id: 'demo-fallback',
            type: 'music',
            title: 'PromptFM Ambient AI Anthem',
            artist: 'PromptFM Core',
            audio_url: 'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/promptfm_ambient_ai_anthem.mp3',
            cover_art_url: '/logo-mark.png',
            category: 'Ambient & Lo-Fi',
            duration_hint_seconds: 210,
            tool_used: 'Stable Audio',
            upvotes_count: 20,
            dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
          };
        } else {
          const supabase = createAdminClient();
          const { data: matchedTrack } = await supabase
            .from('tracks')
            .select('id, title, artist_name, audio_url, tool_used, upvotes_count, cover_art_url, category, description, lyrics, duration_hint_seconds')
            .ilike('title', icecastLive.title.trim())
            .maybeSingle();

          if (matchedTrack) {
            matchedItem = {
              id: matchedTrack.id,
              type: 'music',
              title: matchedTrack.title,
              artist: matchedTrack.artist_name,
              audio_url: matchedTrack.audio_url,
              cover_art_url: (matchedTrack as unknown as { cover_art_url?: string }).cover_art_url || '/logo-mark.png',
              category: (matchedTrack as unknown as { category?: string }).category,
              description: (matchedTrack as unknown as { description?: string }).description,
              lyrics: (matchedTrack as unknown as { lyrics?: string }).lyrics,
              duration_hint_seconds: (matchedTrack as any).duration_hint_seconds || 210,
              tool_used: matchedTrack.tool_used,
              upvotes_count: matchedTrack.upvotes_count,
              dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
            };
          } else {
            matchedItem = {
              id: `icecast-${Date.now()}`,
              type: 'music',
              title: icecastLive.title,
              artist: icecastLive.artist || 'PromptFM Live',
              audio_url: 'https://stream.promptfm.live/stream.mp3',
              cover_art_url: '/logo-mark.png',
              duration_hint_seconds: 210,
              dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
            };
          }
        }

        item = matchedItem;
        startedAtMs = Date.now();
        channelAirplayItems.set('main', item);
        channelAirplayStartedAt.set('main', startedAtMs);
        currentAirplayItem = item;
        currentAirplayStartedAt = startedAtMs;

        try {
          const supabase = createAdminClient();
          await supabase
            .from('station_state')
            .upsert({
              channel_slug: 'main',
              airplay_item: item,
              started_at: new Date(startedAtMs).toISOString(),
              updated_at: new Date().toISOString(),
            });
        } catch {
          // Ignore persistence fallback
        }

        // Reconcile community announcement if newly transitioned on Icecast (Issue #44)
        const isReconciledDuplicate = isAirplayRecentlyAnnounced('main', item.id);

        if (!isReconciledDuplicate) {
          recordAirplayAnnounced('main', item.id);
          notifyCommunityAirplay(item, activeDJ).catch(() => {});
        }
      }
    } catch {
      // Graceful fallback on Icecast network error
    }
  }

  // Calculate elapsed seconds
  let elapsedSeconds = startedAtMs > 0 ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)) : 0;

  // Auto-progression Watchdog:
  // Liquidsoap drives on-air transitions via /api/radio/started when audio tracks actually complete.
  // We only auto-advance as a watchdog fallback:
  // - For spoken drops / ads: after duration_hint_seconds + 15s buffer.
  // - For music tracks: after duration_hint_seconds (default 210s) + 30s buffer.
  //   Shortened from old 600s ceiling to prevent now-playing drift when tracks have finished (Issue #33).
  const isMusic = !item?.type || item.type === 'music';
  const trackDuration = item?.duration_hint_seconds || (isMusic ? 210 : 30);
  const watchdogBuffer = isMusic ? 30 : 15;
  const watchdogTimeoutSeconds = trackDuration + watchdogBuffer;

  if (item && elapsedSeconds >= watchdogTimeoutSeconds) {
    try {
      const nextItem = await getNextAirplayItem(channelSlug, true);
      item = nextItem;
      startedAtMs = Date.now();
      channelAirplayItems.set(channelSlug, nextItem);
      channelAirplayStartedAt.set(channelSlug, startedAtMs);
      if (channelSlug === 'main') {
        currentAirplayItem = nextItem;
        currentAirplayStartedAt = startedAtMs;
      }
      elapsedSeconds = 0;
    } catch (e) {
      console.warn('Auto-advancing on-air track failed:', e);
    }
  }

  if (!item) {
    item = {
      id: 'demo-fallback',
      type: 'music',
      title: 'PromptFM Ambient AI Anthem',
      artist: 'PromptFM Core',
      audio_url: 'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/promptfm_ambient_ai_anthem.mp3',
      cover_art_url: '/logo-mark.png',
      category: 'Ambient & Lo-Fi',
      tool_used: 'Stable Audio',
      upvotes_count: 20,
      dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
    };
  }

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
    startedAt: new Date(startedAtMs || currentAirplayStartedAt).toISOString(),
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
  const now = new Date();

  // Retrieve currently active airplay item to ensure it is never duplicated in "Up Next"
  const currentNowPlaying = await getNowPlaying(channelSlug);
  const currentTrackId = currentNowPlaying.item.id;
  const existingIds = new Set<string>();
  if (currentTrackId && currentTrackId !== 'demo-fallback') {
    existingIds.add(currentTrackId);
  }

  const currentElapsed = currentNowPlaying.elapsedSeconds || 0;
  const currentHint = currentNowPlaying.item.duration_hint_seconds || 210;
  let runningOffsetSeconds = Math.max(30, currentHint - currentElapsed);

  // 1. Check listener queued requests in channel_queue
  const { data: channel } = await supabase.from('channels').select('id').eq('slug', channelSlug).maybeSingle();
  if (channel) {
    const { data: queueItems } = await supabase
      .from('channel_queue')
      .select('id, track_id, prompt_used, requested_by, track:tracks(*)')
      .eq('channel_id', channel.id)
      .is('played_at', null)
      .order('created_at', { ascending: true })
      .limit(limit + 5);

    if (queueItems && queueItems.length > 0) {
      for (const qi of queueItems) {
        if (qi.track) {
          const t = qi.track as unknown as {
            id: string;
            title: string;
            artist_name: string;
            audio_url: string;
            tool_used: string;
            upvotes_count: number;
            cover_art_url?: string;
            category?: string;
            is_explicit?: boolean;
            family_friendly?: boolean;
            duration_hint_seconds?: number;
          };
          if (existingIds.has(t.id)) continue;
          if (
            !isContentAllowedForAirplay(
              Boolean(t.is_explicit),
              channelSlug,
              now,
              t.family_friendly,
              t.category,
              t.title
            )
          ) {
            continue;
          }
          existingIds.add(t.id);

          const targetTime = new Date(now.getTime() + runningOffsetSeconds * 1000);
          const hoursStr = String(targetTime.getUTCHours()).padStart(2, '0');
          const minStr = String(targetTime.getUTCMinutes()).padStart(2, '0');
          const estimated_air_time = `${hoursStr}:${minStr} UTC`;

          upNext.push({
            id: t.id,
            type: 'music',
            title: t.title,
            artist: t.artist_name,
            audio_url: t.audio_url,
            cover_art_url: t.cover_art_url || '/logo-mark.png',
            category: t.category,
            tool_used: t.tool_used,
            upvotes_count: t.upvotes_count,
            queue_position: upNext.length + 1,
            estimated_air_time,
            requested_by: qi.requested_by,
          });
          runningOffsetSeconds += (t.duration_hint_seconds || 210);
          if (upNext.length >= limit) break;
        }
      }
    }
  }

  // 2. Fill remainder from top-voted approved library tracks
  const needed = limit - upNext.length;
  if (needed > 0) {
    const { data: topTracks } = await supabase
      .from('tracks')
      .select('id, title, artist_name, audio_url, tool_used, upvotes_count, cover_art_url, category, is_explicit, family_friendly, duration_hint_seconds')
      .eq('status', 'approved')
      .order('upvotes_count', { ascending: false })
      .limit(needed + 25);

    if (topTracks) {
      for (const t of topTracks) {
        if (!existingIds.has(t.id) && upNext.length < limit) {
          const isAllowed = isContentAllowedForAirplay(
            Boolean((t as unknown as { is_explicit?: boolean }).is_explicit),
            channelSlug,
            now,
            (t as unknown as { family_friendly?: boolean }).family_friendly,
            (t as unknown as { category?: string }).category,
            (t as unknown as { title?: string }).title
          );
          if (isAllowed) {
            existingIds.add(t.id);

            const targetTime = new Date(now.getTime() + runningOffsetSeconds * 1000);
            const hoursStr = String(targetTime.getUTCHours()).padStart(2, '0');
            const minStr = String(targetTime.getUTCMinutes()).padStart(2, '0');
            const estimated_air_time = `${hoursStr}:${minStr} UTC`;

            upNext.push({
              id: t.id,
              type: 'music',
              title: t.title,
              artist: t.artist_name,
              audio_url: t.audio_url,
              cover_art_url: (t as unknown as { cover_art_url?: string }).cover_art_url || '/logo-mark.png',
              category: (t as unknown as { category?: string }).category,
              tool_used: t.tool_used,
              upvotes_count: t.upvotes_count,
              queue_position: upNext.length + 1,
              estimated_air_time,
            });
            runningOffsetSeconds += ((t as unknown as { duration_hint_seconds?: number }).duration_hint_seconds || 210);
          }
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
      const dedicationText = item.requested_by
        ? item.requested_by.toLowerCase().includes('dedicat')
          ? `\n\n💝 **Dedication:** ${item.requested_by}`
          : `\n\n🎧 **Requested by:** ${item.requested_by}`
        : '';

      await broadcastToCommunity({
        title: `Now Playing on PromptFM`,
        message: `🎵 **${item.title}** by **${item.artist}**${dedicationText}\n\nVote directly below or request the next track!`,
        category: 'now_playing',
        trackId: item.id,
        artist: item.artist,
        toolUsed: item.tool_used,
        upvotesCount: item.upvotes_count,
        author: activeDJ.name,
      });

      if (item.requested_by && item.requested_by.toLowerCase().includes('dedicat')) {
        try {
          const supabase = createAdminClient();
          await supabase
            .from('community_requests')
            .update({ status: 'aired', aired_at: new Date().toISOString() })
            .eq('type', 'dedication')
            .eq('status', 'scheduled');
        } catch {
          // Non-blocking status update
        }
      }
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
 * Marks a specific track or airplay item as having actually started streaming on-air.
 * Invoked by Liquidsoap via the /api/radio/started endpoint when Icecast transitions to the track.
 * This guarantees 100% audio-metadata synchronicity and eliminates desync.
 */
export async function markTrackStarted(
  channelSlug = 'main',
  itemId?: string | null,
  title?: string | null
): Promise<AirplayItem> {
  const supabase = createAdminClient();
  const activeDJ = getActiveDJ(channelSlug);

  let itemToStart: AirplayItem | null = null;
  let isUnresolvableUnknown = false;

  if (itemId && pendingAirplayItems.has(itemId)) {
    itemToStart = pendingAirplayItems.get(itemId)!;
    pendingAirplayItems.delete(itemId);
  } else if (title && pendingAirplayItems.has(title.toLowerCase().trim())) {
    itemToStart = pendingAirplayItems.get(title.toLowerCase().trim())!;
    pendingAirplayItems.delete(title.toLowerCase().trim());
  } else if (itemId === 'demo-fallback' || title === 'PromptFM Ambient AI Anthem') {
    itemToStart = {
      id: 'demo-fallback',
      type: 'music',
      title: 'PromptFM Ambient AI Anthem',
      artist: 'PromptFM Core',
      audio_url: 'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/promptfm_ambient_ai_anthem.mp3',
      cover_art_url: '/logo-mark.png',
      category: 'Ambient & Lo-Fi',
      duration_hint_seconds: 210,
      tool_used: 'Stable Audio',
      upvotes_count: 20,
      dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
    };
  } else if (itemId || title) {
    // Attempt lookup in tracks table by ID or Title
    try {
      let query = supabase
        .from('tracks')
        .select('id, title, artist_name, audio_url, tool_used, upvotes_count, cover_art_url, category, description, lyrics, duration_hint_seconds');

      if (itemId) {
        query = query.eq('id', itemId);
      } else if (title) {
        query = query.ilike('title', title.trim());
      }

      const { data: track } = await query.maybeSingle();

      if (track && (!itemId || (track as any).id === itemId)) {
        const raw = track as unknown as {
          airplay_item?: AirplayItem;
          title?: string;
          artist_name?: string;
          id?: string;
          audio_url?: string;
          duration_hint_seconds?: number;
          duration_seconds?: number;
        };
        const actual = raw.airplay_item || track;
        const artistName =
          (actual as unknown as { artist_name?: string }).artist_name ||
          (actual as AirplayItem).artist ||
          'PromptFM Core';
        itemToStart = {
          id: actual.id,
          type: (actual as AirplayItem).type || 'music',
          title: actual.title,
          artist: artistName,
          audio_url: actual.audio_url,
          cover_art_url: actual.cover_art_url || '/logo-mark.png',
          category: actual.category,
          description: actual.description,
          lyrics: actual.lyrics,
          transcript: (actual as any).transcript,
          duration_hint_seconds: (actual as any).duration_hint_seconds || 210,
          tool_used: actual.tool_used,
          upvotes_count: actual.upvotes_count ?? 20,
          dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
        };
      }
    } catch {
      // Fallback below
    }

    if (!itemToStart && (itemId || title)) {
      isUnresolvableUnknown = true;
    }
  }

  if (!itemToStart) {
    itemToStart = (!isUnresolvableUnknown && pendingAirplayItem) || currentAirplayItem || {
      id: 'demo-fallback',
      type: 'music',
      title: 'PromptFM Ambient AI Anthem',
      artist: 'PromptFM Core',
      audio_url: 'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/promptfm_ambient_ai_anthem.mp3',
      cover_art_url: '/logo-mark.png',
      category: 'Ambient & Lo-Fi',
      duration_hint_seconds: 210,
      tool_used: 'Stable Audio',
      upvotes_count: 20,
      dj: { id: activeDJ.id, name: activeDJ.name, title: activeDJ.title },
    };
  }

  const startedAt = Date.now();
  channelAirplayItems.set(channelSlug, itemToStart);
  channelAirplayStartedAt.set(channelSlug, startedAt);
  if (channelSlug === 'main') {
    currentAirplayItem = itemToStart;
    currentAirplayStartedAt = startedAt;
  }
  if (pendingAirplayItem && itemToStart && pendingAirplayItem.id === itemToStart.id) {
    pendingAirplayItem = null;
  }

  try {
    await supabase.from('station_state').upsert({
      channel_slug: channelSlug,
      airplay_item: itemToStart,
      started_at: new Date(startedAt).toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Ignore background persistence errors
  }

  // Deduplicate now-playing announcements: only broadcast once per airplay transition.
  // Consecutive duplicate signals (e.g. Liquidsoap retries, reconnects, watchdog) are dropped.
  // Only the main stage broadcasts to the public community channel (Issue #44, #46).
  const isPublicChannel = channelSlug === 'main';
  const isDuplicate = isAirplayRecentlyAnnounced(channelSlug, itemToStart.id);

  if (isPublicChannel && !isUnresolvableUnknown && !isDuplicate) {
    recordAirplayAnnounced(channelSlug, itemToStart.id);
    notifyCommunityAirplay(itemToStart, activeDJ).catch(() => {});
  }

  return itemToStart;
}

/**
 * The Master Engine: Returns the exact next audio item that should play on the radio.
 * Dynamically resolves the active DJ based on the UTC clock wheel & channel.
 * @param channelSlug The channel identifier ('main', 'cyberpunk', etc.)
 * @param autoPromote When true, immediately sets the item as live on-air (for non-Liquidsoap players).
 *                    When false (e.g. Liquidsoap pre-buffering), prepares the track without marking it live yet.
 */
export async function getNextAirplayItem(channelSlug = 'main', autoPromote = true): Promise<AirplayItem> {
  const supabase = createAdminClient();
  const now = new Date();
  const currentMinute = now.getUTCMinutes();
  const currentHour = now.getUTCHours();

  // 1. Identify which AI DJ is currently on air for this hour & channel, and get active schedule milestones
  const activeDJ: DJProfile = getActiveDJ(channelSlug, now);
  const stationSchedule = getStationSchedule(channelSlug, now);
  const activeMilestones = stationSchedule.current_show?.clock_milestones || [];

  const finishAndBroadcast = async (item: AirplayItem): Promise<AirplayItem> => {
    pendingAirplayItem = item;
    if (item.id) {
      pendingAirplayItems.set(item.id, item);
    }
    if (item.title) {
      pendingAirplayItems.set(item.title.toLowerCase().trim(), item);
    }

    if (autoPromote) {
      const startedAt = Date.now();
      channelAirplayItems.set(channelSlug, item);
      channelAirplayStartedAt.set(channelSlug, startedAt);
      if (channelSlug === 'main') {
        currentAirplayItem = item;
        currentAirplayStartedAt = startedAt;
      }
      try {
        await supabase
          .from('station_state')
          .upsert({
            channel_slug: channelSlug,
            airplay_item: item,
            started_at: new Date(startedAt).toISOString(),
            updated_at: new Date().toISOString(),
          });
      } catch (err) {
        console.warn('Persisting station_state failed:', err);
      }
      // Note: Now-playing announcements are triggered exclusively by actual on-air airplay
      // events (via markTrackStarted) and NOT during queue/schedule staging in getNextAirplayItem.
    }

    return item;
  };

  // ── 1. Top of the Hour (:00 to :03) News Broadcast (When Scheduled in Milestones) ──
  const newsMilestone = activeMilestones.find(
    (m) => m.type === 'news' && Math.abs(currentMinute - m.minute) <= 3
  );
  if (newsMilestone && tracksSinceLastInterstitial > 0) {
    tracksSinceLastInterstitial = 0;
    try {
      const headlines = await fetchLiveHeadlines();
      const drop = await createBroadcastDrop({
        type: 'news',
        headlines,
        topicOrText: `PromptFM Hourly News at ${currentHour}:00 UTC`,
        dj: activeDJ,
      });
      return await finishAndBroadcast({
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
  const { data: channel } = await supabase.from('channels').select('id').eq('slug', channelSlug).maybeSingle();

  if (channel) {
    const { data: queueItem } = await supabase
      .from('channel_queue')
      .select('id, track_id, prompt_used, requested_by, track:tracks(*)')
      .eq('channel_id', channel.id)
      .is('played_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queueItem && queueItem.track) {
      // Mark as played
      await supabase.from('channel_queue').update({ played_at: new Date().toISOString() }).eq('id', queueItem.id);

      tracksSinceLastInterstitial++;
      tracksSinceLastAd++;
      const tr = queueItem.track as unknown as { id: string; title: string; artist_name: string; audio_url: string; tool_used: string; upvotes_count: number };
      return await finishAndBroadcast({
        id: tr.id,
        type: 'music',
        title: tr.title,
        artist: tr.artist_name,
        audio_url: tr.audio_url,
        tool_used: tr.tool_used,
        upvotes_count: tr.upvotes_count,
        requested_by: queueItem.requested_by || undefined,
      });
    }
  }

  // ── 3. Sponsor & Ad Slot Check (When Scheduled in Milestones or Clock Breaks) ─
  const adsConfig = getAdsConfig();
  const timeSinceLastAdSec = (Date.now() - lastAdTimestamp) / 1000;
  const isClockAdTime = adsConfig.clockMinutes.some((m) => Math.abs(currentMinute - m) <= 1);
  const isTrackAdTime = tracksSinceLastAd >= adsConfig.frequencyTracks;
  const hasAdMilestone = activeMilestones.some((m) => m.type === 'ad');

  if (adsConfig.enabled && hasAdMilestone && (isTrackAdTime || (isClockAdTime && timeSinceLastAdSec > 600))) {
    const adSpot = getActiveAdSpot();
    if (adSpot) {
      tracksSinceLastAd = 0;
      lastAdTimestamp = Date.now();

      // Case A: Pre-recorded audio ad
      if (adSpot.type === 'pre_recorded' && adSpot.audioUrl) {
        return await finishAndBroadcast({
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

        return await finishAndBroadcast({
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

  // ── 4. Interstitial Check: [Weather / DJ Banter / Trivia] (When Scheduled) ───
  const weatherMilestone = activeMilestones.find(
    (m) => m.type === 'weather' && Math.abs(currentMinute - m.minute) <= 3
  );
  const banterMilestone = activeMilestones.find(
    (m) => m.type === 'dj_banter' && Math.abs(currentMinute - m.minute) <= 3
  );
  const hasScheduledInterstitials = activeMilestones.some(
    (m) => m.type === 'weather' || m.type === 'dj_banter'
  );

  if (hasScheduledInterstitials && tracksSinceLastInterstitial >= 3) {
    tracksSinceLastInterstitial = 0;

    const shouldPlayWeather =
      weatherMilestone != null || (!banterMilestone && Math.random() < 0.5);

    if (shouldPlayWeather) {
      try {
        const weatherInfo = await fetchLiveWeatherSummary();
        const drop = await createBroadcastDrop({
          type: 'custom_prompt',
          topicOrText: `Give a 15-second radio station weather check for our listeners in ${weatherInfo.city}: "${weatherInfo.text}". Tell listeners to keep voting for their favorite tracks on PromptFM.`,
          dj: activeDJ,
        });
        return await finishAndBroadcast({
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
      // DJ Music Trivia / Persona Banter
      try {
        const drop = await createBroadcastDrop({
          type: 'custom_prompt',
          topicOrText: `Share a witty 15-second thought in your personality style about AI music, studio prompts, or the live community charts.`,
          dj: activeDJ,
        });
        return await finishAndBroadcast({
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
  // When schedule has only music milestones, PromptFM streams 100% music without interruptions.
  tracksSinceLastInterstitial++;
  tracksSinceLastAd++;

  // Fetch top approved tracks ordered by upvotes
  const { data: rawTracks } = await supabase
    .from('tracks')
    .select('id, title, artist_name, audio_url, tool_used, upvotes_count, cover_art_url, category, description, lyrics, is_explicit, family_friendly')
    .eq('status', 'approved')
    .order('upvotes_count', { ascending: false })
    .limit(40);

  // Filter against parental controls and channel rating restrictions
  const tracks = (rawTracks || []).filter((t) =>
    isContentAllowedForAirplay(
      (t as unknown as { is_explicit?: boolean }).is_explicit ?? false,
      channelSlug,
      now,
      (t as unknown as { family_friendly?: boolean }).family_friendly,
      (t as unknown as { category?: string }).category,
      (t as unknown as { title?: string }).title
    )
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
    return await finishAndBroadcast({
      id: chosen.id,
      type: 'music',
      title: chosen.title,
      artist: chosen.artist_name,
      audio_url: chosen.audio_url,
      cover_art_url: (chosen as unknown as { cover_art_url?: string }).cover_art_url || '/logo-mark.png',
      category: (chosen as unknown as { category?: string }).category,
      description: (chosen as unknown as { description?: string }).description,
      lyrics: (chosen as unknown as { lyrics?: string }).lyrics,
      tool_used: chosen.tool_used,
      upvotes_count: chosen.upvotes_count,
    });
  }

  // Fallback demo track if database has 0 tracks yet
  return await finishAndBroadcast({
    id: 'demo-fallback',
    type: 'music',
    title: 'PromptFM Ambient AI Anthem',
    artist: 'PromptFM Core',
    audio_url: 'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/promptfm_ambient_ai_anthem.mp3',
    cover_art_url: '/logo-mark.png',
    category: 'Ambient & Lo-Fi',
    tool_used: 'Stable Audio',
    upvotes_count: 20,
  });
}
