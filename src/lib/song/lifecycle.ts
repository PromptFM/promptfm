// src/lib/song/lifecycle.ts
// PromptFM Request Lifecycle Engine (Issue #98)
// Single Source of Truth for Listener Request States:
// accepted -> queued -> airing_soon -> playing (now playing your request) -> played / rejected
// Synchronizes community_requests, channel_queue, station_state, and chat/CLI/Web notifications.

import { createAdminClient } from '../supabase/server';
import { calculateQueueETA, type QueueETAInfo } from './pathway';
import { formatAirTime } from '../dj/queue';

export type RequestLifecycleStatus =
  | 'accepted'
  | 'queued'
  | 'airing_soon'
  | 'playing'
  | 'played'
  | 'rejected';

export interface RequestLifecycleBadge {
  badgeLabel: string;
  displayStatus: string;
  color: 'blue' | 'amber' | 'purple' | 'emerald' | 'zinc' | 'rose';
}

export interface RequestLifecycleInfo {
  requestId: string;
  status: RequestLifecycleStatus;
  displayStatus: string;
  badgeLabel: string;
  platform: 'discord' | 'telegram' | 'web' | 'cli' | 'mcp';
  platformUserName: string;
  type: string;
  prompt: string;
  target?: string | null;
  batchId?: string | null;
  position?: number;
  itemsAhead?: number;
  eta?: QueueETAInfo;
  track?: {
    id: string;
    title: string;
    artist: string;
    coverArtUrl?: string;
    category?: string;
    toolUsed?: string;
  };
  rejectionReason?: string;
  airedAt?: string;
  createdAt: string;
  isNowPlaying?: boolean;
}

/**
 * Resolves the real-time lifecycle status of a request by combining
 * database record state with active stream airplay and queue position.
 */
export function resolveLifecycleStatus(params: {
  dbStatus: string;
  isLiveNow: boolean;
  queuePosition?: number;
  playedAt?: string | null;
  airedAt?: string | null;
  rejectionReason?: string | null;
}): RequestLifecycleStatus {
  const { dbStatus, isLiveNow, queuePosition, playedAt, airedAt, rejectionReason } = params;

  if (Boolean(rejectionReason) || dbStatus === 'rejected') {
    return 'rejected';
  }

  if (isLiveNow || dbStatus === 'playing') {
    return 'playing';
  }

  if (Boolean(playedAt) || Boolean(airedAt) || dbStatus === 'aired' || dbStatus === 'played') {
    return 'played';
  }

  if (queuePosition === 1) {
    return 'airing_soon';
  }

  if (queuePosition) {
    return 'queued';
  }

  if (dbStatus === 'accepted' || dbStatus === 'scheduled' || dbStatus === 'pending') {
    return 'accepted';
  }

  return 'queued';
}

/**
 * Returns human-readable badges, labels, and UI theme colors for each lifecycle status.
 */
export function getRequestLifecycleBadge(
  status: RequestLifecycleStatus,
  position?: number
): RequestLifecycleBadge {
  switch (status) {
    case 'accepted':
      return {
        badgeLabel: 'ACCEPTED',
        displayStatus: 'Request Accepted',
        color: 'blue',
      };
    case 'queued':
      return {
        badgeLabel: position ? `QUEUED #${position}` : 'IN QUEUE',
        displayStatus: position ? `In Queue (#${position})` : 'In Queue',
        color: 'amber',
      };
    case 'airing_soon':
      return {
        badgeLabel: 'AIRING SOON',
        displayStatus: 'Airing Soon (Up Next)',
        color: 'purple',
      };
    case 'playing':
      return {
        badgeLabel: 'ON AIR',
        displayStatus: 'Now Playing Your Request',
        color: 'emerald',
      };
    case 'played':
      return {
        badgeLabel: 'PLAYED',
        displayStatus: 'Played on Air',
        color: 'zinc',
      };
    case 'rejected':
      return {
        badgeLabel: 'REJECTED',
        displayStatus: 'Declined',
        color: 'rose',
      };
  }
}

/**
 * Formats lifecycle info into friendly listener messages for Discord, Telegram, CLI, or Web.
 */
export function formatRequestLifecycleMessage(
  info: RequestLifecycleInfo,
  format: 'discord' | 'telegram' | 'cli' | 'plain' = 'discord'
): string {
  const trackTitle = info.track?.title || info.prompt;
  const artistName = info.track?.artist;
  const user = info.platformUserName;
  const batch = info.batchId || 'Upcoming Batch';

  if (format === 'discord') {
    switch (info.status) {
      case 'playing':
        return `📻 **Now Playing Your Request!**\n🎵 **"${trackTitle}"**${artistName ? ` by **${artistName}**` : ''}\n🎧 Requested by @${user} • Live on air right now!\nVote or tune in: https://promptfm.live`;

      case 'airing_soon': {
        const timeStr = info.eta?.displayTime ? ` (~${info.eta.displayTime})` : '';
        return `⏳ **Airing Soon (Up Next)!**\n🎵 **"${trackTitle}"**${artistName ? ` by **${artistName}**` : ''}\n🎧 Requested by @${user}\n⏱️ Next track to play on air! Estimated: ${timeStr || 'in ~2-3 mins'}. Check /queue.`;
      }

      case 'queued': {
        const posStr = info.position ? `Position: #${info.position}` : 'In Queue';
        const aheadStr = info.itemsAhead !== undefined ? ` • ${info.itemsAhead} tracks ahead` : '';
        const waitStr = info.eta?.waitMinutes ? ` (~${info.eta.waitMinutes} mins • ~${info.eta.displayTime})` : '';
        return `📋 **In Broadcast Queue (${info.badgeLabel})**\n🎵 **"${trackTitle}"**${artistName ? ` by **${artistName}**` : ''}\n🎧 Requested by @${user}\n⏱️ ${posStr}${aheadStr}${waitStr}. Check /queue anytime.`;
      }

      case 'accepted':
        return `✅ **Request Accepted & Processing**\n🎵 **"${trackTitle}"**${artistName ? ` by **${artistName}**` : ''}\n🎧 Requested by @${user}\n📦 Batch: **${batch}** • Scheduled for live queue. Track anytime with /request ${info.requestId}.`;

      case 'played': {
        const airedStr = info.airedAt ? ` at ${formatAirTime(info.airedAt)}` : '';
        return `✅ **Played on Air**\n🎵 **"${trackTitle}"**${artistName ? ` by **${artistName}**` : ''}\n🎧 Requested by @${user}\n🎉 Broadcast finished${airedStr}. Thank you for listening to PromptFM!`;
      }

      case 'rejected':
        return `🚫 **Request Declined**\n"${info.prompt}"\n❌ Reason: ${info.rejectionReason || 'Violates broadcast ethics standards'}`;
    }
  }

  if (format === 'telegram') {
    switch (info.status) {
      case 'playing':
        return `📻 *Now Playing Your Request!*\n🎵 *"${trackTitle}"*${artistName ? ` by *${artistName}*` : ''}\n🎧 Requested by @${user} • Live on air right now!\nTune in: https://promptfm.live`;

      case 'airing_soon':
        return `⏳ *Airing Soon (Up Next)!*\n🎵 *"${trackTitle}"*${artistName ? ` by *${artistName}*` : ''}\n🎧 Requested by @${user}\n⏱️ Next track to play on air!`;

      case 'queued': {
        const pos = info.position ? `Position #${info.position}` : 'In Queue';
        const wait = info.eta?.waitMinutes ? ` (~${info.eta.waitMinutes} mins)` : '';
        return `📋 *In Broadcast Queue (${info.badgeLabel})*\n🎵 *"${trackTitle}"*${artistName ? ` by *${artistName}*` : ''}\n🎧 Requested by @${user}\n⏱️ ${pos}${wait}. Use /q to view queue.`;
      }

      case 'accepted':
        return `✅ *Request Accepted & Processing*\n🎵 *"${trackTitle}"*${artistName ? ` by *${artistName}*` : ''}\n🎧 Requested by @${user}\n📦 Batch: *${batch}*`;

      case 'played': {
        const airedStr = info.airedAt ? ` at ${formatAirTime(info.airedAt)}` : '';
        return `✅ *Played on Air*\n🎵 *"${trackTitle}"*${artistName ? ` by *${artistName}*` : ''}\n🎧 Requested by @${user}\n🎉 Broadcast finished${airedStr}.`;
      }

      case 'rejected':
        return `🚫 *Request Declined*\n"${info.prompt}"\n❌ Reason: ${info.rejectionReason || 'Violates broadcast ethics standards'}`;
    }
  }

  // CLI / Plain format
  switch (info.status) {
    case 'playing':
      return `📻 NOW PLAYING YOUR REQUEST: "${trackTitle}"${artistName ? ` by ${artistName}` : ''} [Requested by ${user}] • On air now!`;
    case 'airing_soon':
      return `⏳ AIRING SOON (UP NEXT): "${trackTitle}"${artistName ? ` by ${artistName}` : ''} [Requested by ${user}] • Next track to play!`;
    case 'queued':
      return `📋 IN QUEUE (#${info.position || '?'}): "${trackTitle}"${artistName ? ` by ${artistName}` : ''} [Requested by ${user}] • ~${info.eta?.displayTime || 'Soon'}`;
    case 'accepted':
      return `✅ ACCEPTED: "${trackTitle}" [Requested by ${user}] • Batch: ${batch}`;
    case 'played':
      return `✅ PLAYED: "${trackTitle}" [Requested by ${user}] • Aired at ${info.airedAt ? formatAirTime(info.airedAt) : 'recently'}`;
    case 'rejected':
      return `🚫 DECLINED: "${info.prompt}" • Reason: ${info.rejectionReason || 'Violates broadcast standards'}`;
  }
}

/**
 * Searches for a request across community_requests, channel_queue, and live airplay.
 * Accepts request ID (UUID), track ID, track title, or username.
 */
export async function getRequestLifecycle(
  identifier: string,
  channelSlug = 'main'
): Promise<RequestLifecycleInfo | null> {
  const supabase = createAdminClient();
  const cleanId = (identifier || '').trim();
  if (!cleanId) return null;

  // 1. Check community_requests by direct ID match
  let requestRow: any = null;
  try {
    const { data } = await supabase
      .from('community_requests')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (data) {
      requestRow = data;
    }
  } catch {
    // Non-blocking
  }

  // 2. If not found, search by content / prompt substring
  if (!requestRow) {
    try {
      const { data } = await supabase
        .from('community_requests')
        .select('*')
        .ilike('content', `%${cleanId}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (Array.isArray(data) && data[0]) {
        requestRow = data[0];
      }
    } catch {
      // Non-blocking
    }
  }

  // 3. If not found, search by user name
  if (!requestRow) {
    try {
      const cleanUser = cleanId.replace(/^@/, '');
      const { data } = await supabase
        .from('community_requests')
        .select('*')
        .eq('platform_user_name', cleanUser)
        .order('created_at', { ascending: false })
        .limit(1);

      if (Array.isArray(data) && data[0]) {
        requestRow = data[0];
      }
    } catch {
      // Non-blocking
    }
  }

  // 4. If still not found, check target track ID
  if (!requestRow) {
    try {
      const { data } = await supabase
        .from('community_requests')
        .select('*')
        .eq('target', cleanId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (Array.isArray(data) && data[0]) {
        requestRow = data[0];
      }
    } catch {
      // Non-blocking
    }
  }

  if (!requestRow) {
    return null;
  }

  // 5. Cross-reference associated track metadata
  let trackInfo: any = null;
  if (requestRow.target) {
    try {
      const { data: directTrack } = await supabase
        .from('tracks')
        .select('id, title, artist_name, cover_art_url, category, tool_used, duration_hint_seconds')
        .eq('id', requestRow.target)
        .maybeSingle();

      if (directTrack) {
        trackInfo = directTrack;
      }
    } catch {
      // Fallback below
    }
  }

  if (!trackInfo && requestRow.content) {
    try {
      const { data: namedTrack } = await supabase
        .from('tracks')
        .select('id, title, artist_name, cover_art_url, category, tool_used, duration_hint_seconds')
        .ilike('title', `%${requestRow.content}%`)
        .limit(1)
        .maybeSingle();

      if (namedTrack) {
        trackInfo = namedTrack;
      }
    } catch {
      // Non-blocking
    }
  }

  // 6. Cross-reference live station state (is it currently playing on air?)
  let isLiveNow = false;
  try {
    const { data: stateData } = await supabase
      .from('station_state')
      .select('airplay_item, started_at')
      .eq('channel_slug', channelSlug)
      .maybeSingle();

    if (stateData?.airplay_item) {
      const curItem = stateData.airplay_item as any;
      if (
        (trackInfo?.id && curItem.id === trackInfo.id) ||
        (curItem.title && curItem.title.toLowerCase() === requestRow.content.toLowerCase()) ||
        requestRow.status === 'playing'
      ) {
        isLiveNow = true;
      }
    }
  } catch {
    // Non-blocking
  }

  // 7. Cross-reference channel queue (to determine exact position in queue)
  let queuePosition: number | undefined;
  let itemsAhead: number | undefined;
  let queueEta: QueueETAInfo | undefined;
  let playedAtFromQueue: string | null = null;

  try {
    const { data: channel } = await supabase
      .from('channels')
      .select('id')
      .eq('slug', channelSlug)
      .maybeSingle();

    const channelId = channel?.id || 'channel-main';

    const { data: queueItems } = await supabase
      .from('channel_queue')
      .select('id, track_id, prompt_used, requested_by, played_at, created_at')
      .eq('channel_id', channelId)
      .is('played_at', null)
      .order('created_at', { ascending: true })
      .limit(50);

    if (Array.isArray(queueItems) && queueItems.length > 0) {
      const matchedIdx = queueItems.findIndex((q) => {
        if (trackInfo?.id && q.track_id === trackInfo.id) return true;
        if (q.prompt_used && q.prompt_used.toLowerCase().includes(requestRow.content.toLowerCase())) return true;
        if (q.requested_by && q.requested_by.includes(requestRow.platform_user_name)) return true;
        return false;
      });

      if (matchedIdx !== -1) {
        queuePosition = matchedIdx + 1;
        itemsAhead = matchedIdx;
        queueEta = calculateQueueETA(matchedIdx);
      }
    }
  } catch {
    // Non-blocking
  }

  // 8. Resolve canonical lifecycle status & badge
  const status = resolveLifecycleStatus({
    dbStatus: requestRow.status,
    isLiveNow,
    queuePosition,
    playedAt: playedAtFromQueue,
    airedAt: requestRow.aired_at,
    rejectionReason: requestRow.rejection_reason,
  });

  const badge = getRequestLifecycleBadge(status, queuePosition);

  return {
    requestId: requestRow.id,
    status,
    displayStatus: badge.displayStatus,
    badgeLabel: badge.badgeLabel,
    platform: requestRow.platform,
    platformUserName: requestRow.platform_user_name,
    type: requestRow.type,
    prompt: requestRow.content,
    target: requestRow.target,
    batchId: requestRow.batch_id,
    position: queuePosition,
    itemsAhead,
    eta: queueEta,
    track: trackInfo
      ? {
          id: trackInfo.id,
          title: trackInfo.title,
          artist: trackInfo.artist_name || 'PromptFM Artist',
          coverArtUrl: trackInfo.cover_art_url || '/logo-mark.png',
          category: trackInfo.category,
          toolUsed: trackInfo.tool_used,
        }
      : undefined,
    rejectionReason: requestRow.rejection_reason || undefined,
    airedAt: requestRow.aired_at || undefined,
    createdAt: requestRow.created_at,
    isNowPlaying: status === 'playing',
  };
}

/**
 * Synchronizes airplay request transitions whenever a track starts on air.
 * - Transitions previous 'playing' requests to 'aired'/'played'
 * - Transitions matching 'scheduled'/'queued' requests to 'playing'
 */
export async function syncAirplayRequestTransition(
  startedTrackId: string,
  startedTitle?: string | null,
  channelSlug = 'main'
): Promise<{ activeRequest: RequestLifecycleInfo | null; completedRequestIds: string[] }> {
  const supabase = createAdminClient();
  const completedRequestIds: string[] = [];

  // 1. Transition previous playing requests to aired / played
  try {
    const { data: previousPlaying } = await supabase
      .from('community_requests')
      .select('id')
      .eq('status', 'playing')
      .order('created_at', { ascending: false })
      .limit(10);

    if (Array.isArray(previousPlaying) && previousPlaying.length > 0) {
      await supabase
        .from('community_requests')
        .update({
          status: 'aired',
          aired_at: new Date().toISOString(),
        })
        .eq('status', 'playing');

      previousPlaying.forEach((p) => completedRequestIds.push(p.id));
    }
  } catch {
    // Non-blocking
  }

  // 2. Identify if newly started track has a scheduled or accepted community request
  let matchingRequestId: string | null = null;
  try {
    if (startedTrackId) {
      const { data: matchByTarget } = await supabase
        .from('community_requests')
        .select('id')
        .eq('target', startedTrackId)
        .in('status', ['scheduled', 'accepted', 'queued', 'pending'])
        .order('created_at', { ascending: true })
        .limit(1);

      if (Array.isArray(matchByTarget) && matchByTarget[0]?.id) {
        matchingRequestId = matchByTarget[0].id;
      }
    }

    if (!matchingRequestId && startedTitle) {
      const { data: matchByTitle } = await supabase
        .from('community_requests')
        .select('id')
        .ilike('content', `%${startedTitle.trim()}%`)
        .in('status', ['scheduled', 'accepted', 'queued', 'pending'])
        .order('created_at', { ascending: true })
        .limit(1);

      if (Array.isArray(matchByTitle) && matchByTitle[0]?.id) {
        matchingRequestId = matchByTitle[0].id;
      }
    }

    if (matchingRequestId) {
      await supabase
        .from('community_requests')
        .update({
          status: 'playing',
        })
        .eq('id', matchingRequestId);
    }
  } catch {
    // Non-blocking
  }

  // 3. Return updated active request lifecycle
  let activeRequest: RequestLifecycleInfo | null = null;
  if (matchingRequestId) {
    activeRequest = await getRequestLifecycle(matchingRequestId, channelSlug);
  }

  return {
    activeRequest,
    completedRequestIds,
  };
}
