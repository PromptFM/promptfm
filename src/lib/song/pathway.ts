// src/lib/song/pathway.ts
// Unified Song Pathway for PromptFM (Issue #43)
// Single Source of Truth for Song Requests, Queue Insertion, Deduplication, and Live ETA Calculation
// Reused uniformly across Discord, Telegram, MCP, Web Admin, and Terminal CLI.

import { createAdminClient } from '../supabase/server';
import { evaluateContentSafety } from '../safety/guardrails';
import { findTracksByVibe } from '../dj/rag';
import { getNowPlaying } from '../dj/rotation';

export type SongRequestSource = 'discord' | 'telegram' | 'mcp' | 'web_admin' | 'cli' | 'web';

export interface UnifiedSongRequestInput {
  source: SongRequestSource;
  requestedBy: string;
  userId?: string;
  messageId?: string;
  prompt?: string;
  trackId?: string;
  channelSlug?: string;
  priority?: boolean;
}

export interface QueueETAInfo {
  position: number;
  itemsAhead: number;
  waitSeconds: number;
  waitMinutes: number;
  displayTime: string;
  estimatedAirDate: Date;
  formattedETA: string;
}

export interface UnifiedSongQueueResult {
  status: 'queued' | 'already_queued' | 'currently_playing' | 'rejected' | 'no_match';
  track?: any;
  position: number;
  eta: QueueETAInfo;
  confirmationMessage: string;
  isRejected?: boolean;
  rejectionReason?: string;
  queueItemId?: string;
  requestId?: string;
}

export interface QueuedTrackStatusItem {
  queueId: string;
  position: number;
  track: any;
  promptUsed?: string;
  requestedBy: string;
  createdAt: string;
  eta: QueueETAInfo;
}

export interface SongQueueStatusResult {
  channelSlug: string;
  totalQueued: number;
  items: QueuedTrackStatusItem[];
  matchedItem?: QueuedTrackStatusItem;
}

/**
 * Calculates dynamic ETA based on queue position and active track playback.
 */
export function calculateQueueETA(
  itemsAhead: number,
  currentTrackRemainingSeconds = 120,
  averageTrackDurationSeconds = 180,
  nowMs?: number
): QueueETAInfo {
  const safeItemsAhead = Math.max(0, itemsAhead);
  const currentRemaining = Math.max(0, currentTrackRemainingSeconds);
  const avgDuration = Math.max(60, averageTrackDurationSeconds);

  const waitSeconds = currentRemaining + safeItemsAhead * avgDuration;
  const waitMinutes = Math.max(1, Math.ceil(waitSeconds / 60));
  const baseTime = typeof nowMs === 'number' ? nowMs : Date.now();
  const estimatedAirDate = new Date(baseTime + waitSeconds * 1000);

  const hoursStr = String(estimatedAirDate.getUTCHours()).padStart(2, '0');
  const minStr = String(estimatedAirDate.getUTCMinutes()).padStart(2, '0');
  const displayTime = `${hoursStr}:${minStr} UTC`;

  const position = safeItemsAhead + 1;
  const formattedETA =
    position === 1
      ? `~${waitMinutes} min${waitMinutes === 1 ? '' : 's'} (Up Next • ~${displayTime})`
      : `~${waitMinutes} mins (Queue #${position} • ~${displayTime})`;

  return {
    position,
    itemsAhead: safeItemsAhead,
    waitSeconds,
    waitMinutes,
    displayTime,
    estimatedAirDate,
    formattedETA,
  };
}

/**
 * Formats user-facing confirmation messages with clear queue position and provisional ETA.
 */
export function formatQueueConfirmation(params: {
  status: 'queued' | 'already_queued' | 'currently_playing';
  trackTitle: string;
  artistName?: string;
  position: number;
  waitMinutes: number;
  displayTime: string;
}): string {
  const { status, trackTitle, artistName, position, waitMinutes, displayTime } = params;
  const byArtist = artistName ? ` by ${artistName}` : '';
  const minText = `~${waitMinutes} min${waitMinutes === 1 ? '' : 's'}`;

  if (status === 'currently_playing') {
    return `📻 Track "${trackTitle}"${byArtist} is playing LIVE right now on air!`;
  }

  if (status === 'already_queued') {
    return `ℹ️ Track "${trackTitle}"${byArtist} is already in the live queue! Position: #${position} (Estimated: ${minText} • ~${displayTime}).`;
  }

  const posLabel = position === 1 ? 'Position: #1 (Up Next)' : `Position: #${position}`;
  return `🎵 Track "${trackTitle}"${byArtist} queued for live airplay! ${posLabel} (Estimated: ${minText} • ~${displayTime}).`;
}

/**
 * Core Unified Song Pathway:
 * Validates safety, resolves track, prevents duplicate queueing, calculates queue position & ETA,
 * inserts into channel_queue, and logs to community_requests.
 */
export async function queueSong(input: UnifiedSongRequestInput): Promise<UnifiedSongQueueResult> {
  const supabase = createAdminClient();
  const channelSlug = input.channelSlug || 'main';

  // ── A. Ethical & Safety Guardrails ──────────────────────────────────────────
  const queryText = (input.prompt || '').trim();
  if (queryText) {
    const safety = await evaluateContentSafety(queryText);
    if (!safety.safe) {
      const { data: rejectedReq } = await supabase
        .from('community_requests')
        .insert({
          platform: input.source,
          platform_user_id: input.userId || 'anon',
          platform_user_name: input.requestedBy,
          platform_message_id: input.messageId || null,
          type: 'song',
          content: queryText,
          status: 'rejected',
        })
        .select()
        .single();

      const refusal =
        safety.refusalMessage ||
        `🚫 Request declined: PromptFM operates as a family-safe community station (${safety.category.replace('_', ' ')}).`;

      return {
        status: 'rejected',
        position: 0,
        eta: calculateQueueETA(0, 0, 180),
        confirmationMessage: refusal,
        isRejected: true,
        rejectionReason: safety.reason,
        requestId: rejectedReq?.id,
      };
    }
  }

  // ── B. Track Resolution (RAG -> Lexical -> Top Approved) ────────────────────
  let selectedTrack: any = null;

  if (input.trackId) {
    const { data: directTrack } = await supabase
      .from('tracks')
      .select('id, title, artist_name, tool_used, audio_url, duration_seconds')
      .eq('id', input.trackId)
      .eq('status', 'approved')
      .maybeSingle();

    if (directTrack) {
      selectedTrack = directTrack;
    }
  } else if (queryText) {
    // 1. Semantic RAG Vibe Search
    try {
      const matches = await findTracksByVibe(queryText, {
        channelSlug,
        limit: 1,
        matchThreshold: 0.15,
      });
      if (matches && matches.length > 0 && matches[0]) {
        selectedTrack = matches[0];
      }
    } catch {
      // Fall through to lexical search
    }

    // 2. Lexical Title Match
    if (!selectedTrack) {
      try {
        const { data: lexicalMatch } = await supabase
          .from('tracks')
          .select('id, title, artist_name, tool_used, audio_url, duration_seconds')
          .eq('status', 'approved')
          .ilike('title', `%${queryText}%`)
          .limit(1)
          .maybeSingle();

        if (lexicalMatch) {
          selectedTrack = lexicalMatch;
        }
      } catch {
        // Fall through to top track
      }
    }

    // 3. Fallback: Top Approved Track
    if (!selectedTrack) {
      try {
        const { data: topTrack } = await supabase
          .from('tracks')
          .select('id, title, artist_name, tool_used, audio_url, duration_seconds')
          .eq('status', 'approved')
          .order('upvotes_count', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (topTrack) {
          selectedTrack = topTrack;
        }
      } catch {
        // Handled below
      }
    }
  }

  if (!selectedTrack) {
    const noMatchEta = calculateQueueETA(0, 0, 180);
    return {
      status: 'no_match',
      position: 0,
      eta: noMatchEta,
      confirmationMessage: `❓ No approved tracks found matching "${queryText || 'request'}". Try another prompt or check /queue!`,
    };
  }

  // ── C. Deduplication: Check Currently Playing ──────────────────────────────
  try {
    const nowPlaying = await getNowPlaying(channelSlug);
    if (nowPlaying?.item?.id === selectedTrack.id) {
      const liveEta = calculateQueueETA(0, 0, 180);
      const msg = formatQueueConfirmation({
        status: 'currently_playing',
        trackTitle: selectedTrack.title,
        artistName: selectedTrack.artist_name,
        position: 0,
        waitMinutes: 0,
        displayTime: 'Now',
      });

      return {
        status: 'currently_playing',
        track: selectedTrack,
        position: 0,
        eta: liveEta,
        confirmationMessage: msg,
      };
    }
  } catch {
    // Non-fatal if nowPlaying check fails
  }

  // ── D. Deduplication: Check Pending Items in Channel Queue ─────────────────
  const { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('slug', channelSlug)
    .maybeSingle();

  const channelId = channel?.id || 'channel-main';

  const { data: activeQueue } = await supabase
    .from('channel_queue')
    .select('id, track_id, created_at')
    .eq('channel_id', channelId)
    .is('played_at', null)
    .order('created_at', { ascending: true })
    .limit(50);

  const queueItems = activeQueue || [];
  const existingIndex = queueItems.findIndex((item) => item.track_id === selectedTrack.id);

  if (existingIndex !== -1) {
    const existingPosition = existingIndex + 1;
    const existingEta = calculateQueueETA(existingIndex);
    const existingMsg = formatQueueConfirmation({
      status: 'already_queued',
      trackTitle: selectedTrack.title,
      artistName: selectedTrack.artist_name,
      position: existingPosition,
      waitMinutes: existingEta.waitMinutes,
      displayTime: existingEta.displayTime,
    });

    return {
      status: 'already_queued',
      track: selectedTrack,
      position: existingPosition,
      eta: existingEta,
      confirmationMessage: existingMsg,
      queueItemId: queueItems[existingIndex]?.id,
    };
  }

  // ── E. Calculate Position & Live ETA ───────────────────────────────────────
  const isPriority = Boolean(input.priority);
  const itemsAhead = isPriority ? 0 : queueItems.length;
  const eta = calculateQueueETA(itemsAhead);
  const position = isPriority ? 1 : queueItems.length + 1;

  // ── F. Insert into channel_queue ───────────────────────────────────────────
  const handle = input.requestedBy.startsWith('@') ? input.requestedBy : `@${input.requestedBy}`;
  const requestedByFormatted = `${handle} (${input.source})`;
  const { data: queueRow } = await supabase
    .from('channel_queue')
    .insert({
      channel_id: channelId,
      track_id: selectedTrack.id,
      prompt_used: queryText || selectedTrack.title,
      requested_by: requestedByFormatted,
      priority: isPriority,
    })
    .select()
    .single();

  // ── G. Log to community_requests for Audit & Admin Sync ────────────────────
  const { data: reqRow } = await supabase
    .from('community_requests')
    .insert({
      platform: input.source === 'cli' || input.source === 'mcp' || input.source === 'web_admin' ? 'web' : input.source,
      platform_user_id: input.userId || 'station-user',
      platform_user_name: input.requestedBy,
      platform_message_id: input.messageId || null,
      type: 'song',
      content: queryText || selectedTrack.title,
      target: selectedTrack.id,
      batch_id: `QUEUE-#${position}`,
      status: 'scheduled',
      estimated_air_time: eta.estimatedAirDate.toISOString(),
    })
    .select()
    .single();

  const confirmMsg = formatQueueConfirmation({
    status: 'queued',
    trackTitle: selectedTrack.title,
    artistName: selectedTrack.artist_name,
    position,
    waitMinutes: eta.waitMinutes,
    displayTime: eta.displayTime,
  });

  return {
    status: 'queued',
    track: selectedTrack,
    position,
    eta,
    confirmationMessage: confirmMsg,
    queueItemId: queueRow?.id,
    requestId: reqRow?.id,
  };
}

/**
 * Queries active channel queue status with accurate 1-indexed positions and dynamic ETAs.
 */
export async function getSongQueueStatus(
  channelSlug = 'main',
  trackIdOrQuery?: string
): Promise<SongQueueStatusResult> {
  const supabase = createAdminClient();

  const { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('slug', channelSlug)
    .maybeSingle();

  const channelId = channel?.id || 'channel-main';

  const { data: rawQueue } = await supabase
    .from('channel_queue')
    .select('id, track_id, prompt_used, requested_by, created_at, track:tracks(*)')
    .eq('channel_id', channelId)
    .is('played_at', null)
    .order('created_at', { ascending: true })
    .limit(50);

  const items: QueuedTrackStatusItem[] = (rawQueue || []).map((row, idx) => {
    const position = idx + 1;
    const eta = calculateQueueETA(idx);
    return {
      queueId: row.id,
      position,
      track: row.track,
      promptUsed: row.prompt_used,
      requestedBy: row.requested_by,
      createdAt: row.created_at,
      eta,
    };
  });

  let matchedItem: QueuedTrackStatusItem | undefined;
  if (trackIdOrQuery) {
    const clean = trackIdOrQuery.toLowerCase().trim();
    matchedItem = items.find(
      (item) =>
        item.track?.id === trackIdOrQuery ||
        item.track?.title?.toLowerCase().includes(clean) ||
        item.promptUsed?.toLowerCase().includes(clean)
    );
  }

  return {
    channelSlug,
    totalQueued: items.length,
    items,
    matchedItem,
  };
}
