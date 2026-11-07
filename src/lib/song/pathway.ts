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
  dedicationTarget?: string;
  allowFallbackRequest?: boolean;
}

export interface QueueETAInfo {
  position: number;
  itemsAhead: number;
  waitSeconds: number;
  waitMinutes: number;
  displayTime: string;
  batchId: string;
  estimatedAirDate: Date;
  formattedETA: string;
  isProvisional: boolean;
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
  const batchId = `BATCH-${hoursStr}:${minStr}`;

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
    batchId,
    estimatedAirDate,
    formattedETA,
    isProvisional: true,
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
  batchId?: string;
  isUnmatched?: boolean;
}): string {
  const { status, trackTitle, artistName, position, waitMinutes, displayTime, batchId, isUnmatched } = params;
  const byArtist = artistName ? ` by ${artistName}` : '';
  const minText = `~${waitMinutes} min${waitMinutes === 1 ? '' : 's'}`;

  if (status === 'currently_playing') {
    return `📻 Track "${trackTitle}"${byArtist} is playing LIVE right now on air!`;
  }

  if (status === 'already_queued') {
    return `ℹ️ Track "${trackTitle}"${byArtist} is already in the live queue! Position: #${position} (Estimated: ${minText} • ~${displayTime}).`;
  }

  const posText = position === 1 ? 'Up next (#1 in queue)' : `#${position} in queue`;
  const batchLabel = batchId ? ` • Scheduled for ${batchId}` : '';
  const timeEst = `~${displayTime} (est. in ~${waitMinutes}m, provisional)`;

  if (isUnmatched) {
    return `🎵 Track request "${trackTitle}" added to airplay queue! Position: ${posText}${batchLabel} (${timeEst}). Check live queue anytime with /queue.`;
  }

  return `🎵 Track "${trackTitle}"${byArtist} queued for live airplay! Position: ${posText}${batchLabel} (${timeEst}). Check live queue anytime with /queue.`;
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
      let rejectedReq: any = null;
      const rejectBuilder = supabase
        .from('community_requests')
        .insert({
          platform: input.source === 'cli' || input.source === 'mcp' || input.source === 'web_admin' ? 'web' : input.source,
          platform_user_id: input.userId || 'anon',
          platform_user_name: input.requestedBy,
          platform_message_id: input.messageId || null,
          type: 'song',
          content: queryText,
          target: input.dedicationTarget || null,
          batch_id: null,
          status: 'rejected',
        });

      if (typeof (rejectBuilder as any)?.select === 'function') {
        const sel = await (rejectBuilder as any).select().single();
        rejectedReq = sel?.data;
      } else {
        const res = await rejectBuilder;
        rejectedReq = res?.data;
      }

      const refusal =
        safety.refusalMessage ||
        `🚫 Request declined: Your submission violates PromptFM broadcast ethics (${safety.category.replace('_', ' ')}). PromptFM operates as a family-safe and inclusive 24/7 radio station.`;

      return {
        status: 'rejected',
        position: 0,
        eta: calculateQueueETA(0, 0, 180),
        confirmationMessage: refusal,
        isRejected: true,
        rejectionReason: safety.reason,
        requestId: rejectedReq?.id || 'rejected',
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
        limit: 1,
        ...(input.channelSlug && input.channelSlug !== 'main' ? { channelSlug: input.channelSlug } : {}),
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

  if (!selectedTrack && !input.allowFallbackRequest) {
    const noMatchEta = calculateQueueETA(0, 0, 180);
    return {
      status: 'no_match',
      position: 0,
      eta: noMatchEta,
      confirmationMessage: `❓ No approved tracks found matching "${queryText || 'request'}". Try another prompt or check /queue!`,
    };
  }

  const isDedication = Boolean(input.dedicationTarget);

  // ── C. Deduplication: Check Currently Playing ──────────────────────────────
  if (selectedTrack && !isDedication) {
    try {
      const nowPlaying = await getNowPlaying(channelSlug);
      const isLiveSameTrack = nowPlaying?.item?.id === selectedTrack.id;
      const cleanQ = (queryText || '').toLowerCase();
      const cleanTitle = (selectedTrack.title || '').toLowerCase();
      const isExplicitMatch =
        Boolean(input.trackId) ||
        (cleanQ && (cleanQ === cleanTitle || cleanQ.includes(cleanTitle) || cleanTitle.includes(cleanQ)));

      if (isLiveSameTrack && isExplicitMatch) {
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
  }

  // ── D. Deduplication: Check Pending Items in Channel Queue ─────────────────
  const { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('slug', channelSlug)
    .maybeSingle();

  const channelId = channel?.id || 'channel-main';

  let queueItems: any[] = [];
  try {
    const queueListRes = await supabase
      .from('channel_queue')
      .select('id, track_id, prompt_used, created_at')
      .eq('channel_id', channelId)
      .is('played_at', null)
      .order('created_at', { ascending: true })
      .limit(50);

    if (Array.isArray(queueListRes?.data)) {
      queueItems = queueListRes.data;
    }
  } catch {
    // Non-blocking
  }

  let pendingCount = queueItems.length;
  try {
    const countRes = await supabase
      .from('channel_queue')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .is('played_at', null);

    if (countRes && typeof countRes.count === 'number') {
      pendingCount = countRes.count;
    }
  } catch {
    // Non-blocking
  }

  const existingIndex =
    selectedTrack && !isDedication
      ? queueItems.findIndex((item) => {
          if (item.track_id !== selectedTrack.id) return false;
          if (input.trackId) return true;
          if (!queryText) return true;
          const cleanQ = queryText.toLowerCase();
          const cleanTitle = selectedTrack.title.toLowerCase();
          const cleanItemPrompt = (item.prompt_used || '').toLowerCase();
          return cleanQ === cleanItemPrompt || cleanQ.includes(cleanTitle) || cleanTitle.includes(cleanQ);
        })
      : -1;

  if (existingIndex !== -1 && selectedTrack && !isDedication) {
    const existingPosition = existingIndex + 1;
    const existingEta = calculateQueueETA(existingIndex);
    const existingMsg = formatQueueConfirmation({
      status: 'already_queued',
      trackTitle: selectedTrack.title,
      artistName: selectedTrack.artist_name,
      position: existingPosition,
      waitMinutes: existingEta.waitMinutes,
      displayTime: existingEta.displayTime,
      batchId: existingEta.batchId,
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
  let remainingCurrentTrack = 120;
  try {
    const { data: stateData } = await supabase
      .from('station_state')
      .select('airplay_item, started_at')
      .eq('channel_slug', channelSlug)
      .maybeSingle();

    if (stateData?.started_at) {
      const startedMs = new Date(stateData.started_at).getTime();
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
      const hintSec = (stateData.airplay_item as { duration_hint_seconds?: number })?.duration_hint_seconds ?? 210;
      remainingCurrentTrack = Math.max(30, hintSec - elapsedSec);
    }
  } catch {
    // Non-blocking fallback
  }

  const isPriority = Boolean(input.priority);
  const itemsAhead = isPriority ? 0 : pendingCount;
  const eta = calculateQueueETA(itemsAhead, remainingCurrentTrack, 210);
  const position = isPriority ? 1 : pendingCount + 1;

  // ── F. Insert into channel_queue (if track resolved) ───────────────────────
  let queueRow: any = null;
  if (selectedTrack) {
    let requestedByFormatted = '';
    if (input.dedicationTarget) {
      const cleanTarget = `@${input.dedicationTarget.replace(/^@/, '')}`;
      requestedByFormatted = `@${input.requestedBy.replace(/^@/, '')} (Dedicated to ${cleanTarget})`;
    } else {
      const handle = input.requestedBy.startsWith('@') ? input.requestedBy : `@${input.requestedBy}`;
      requestedByFormatted = `${handle} (${input.source})`;
    }

    const queueBuilder = supabase.from('channel_queue').insert({
      channel_id: channelId,
      track_id: selectedTrack.id,
      prompt_used: queryText || selectedTrack.title,
      requested_by: requestedByFormatted,
      priority: isPriority,
    });

    if (typeof (queueBuilder as any)?.select === 'function') {
      const selRes = await (queueBuilder as any).select().single();
      queueRow = selRes?.data;
    } else {
      const res = await queueBuilder;
      queueRow = res?.data;
    }
  }

  // ── G. Log to community_requests for Audit & Admin Sync ────────────────────
  let reqRow: any = null;
  let reqError: any = null;
  const reqBuilder = supabase.from('community_requests').insert({
    platform: input.source === 'cli' || input.source === 'mcp' || input.source === 'web_admin' ? 'web' : input.source,
    platform_user_id: input.userId || 'station-user',
    platform_user_name: input.requestedBy,
    platform_message_id: input.messageId || null,
    type: 'song',
    content: queryText || (selectedTrack ? selectedTrack.title : 'song request'),
    target: selectedTrack ? selectedTrack.id : (input.dedicationTarget || null),
    batch_id: eta.batchId,
    status: 'scheduled',
    estimated_air_time: eta.estimatedAirDate.toISOString(),
  });

  if (typeof (reqBuilder as any)?.select === 'function') {
    const selRes = await (reqBuilder as any).select().single();
    reqRow = selRes?.data;
    reqError = selRes?.error;
  } else {
    const res = await reqBuilder;
    reqRow = res?.data;
    reqError = res?.error;
  }

  if (reqError) {
    throw new Error(`Failed to log request: ${reqError.message}`);
  }

  const confirmMsg = formatQueueConfirmation({
    status: 'queued',
    trackTitle: selectedTrack ? selectedTrack.title : (queryText || 'request'),
    artistName: selectedTrack?.artist_name,
    position,
    waitMinutes: eta.waitMinutes,
    displayTime: eta.displayTime,
    batchId: eta.batchId,
    isUnmatched: !selectedTrack,
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
