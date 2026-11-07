// src/lib/dj/batches.ts
// Listener Request Batch & Slot Scheduler with Guardrails & Rejection Notices
// Allocates listener requests into evenly distributed broadcast batches,
// runs safety & parental control guardrails, and supports admin batch removal with user notifications.

import { createAdminClient } from '../supabase/server';
import { createBroadcastDrop } from './engine';
import { fetchLiveWeatherSummary } from './rotation';
import { getActiveDJ } from './roster';
import { broadcastToCommunity } from '../chat/bridge';
import { evaluateContentSafety } from '../safety/guardrails';
import { findTracksByVibe } from './rag';
import { isFeatureEnabled } from '../flags/feature-flags';

export type RequestType = 'song' | 'dedication' | 'weather' | 'news' | 'zodiac';

export interface ListenerRequestPayload {
  platform: 'discord' | 'telegram' | 'web';
  platform_user_id: string;
  platform_user_name: string;
  platform_message_id?: string;
  type: RequestType;
  content: string;
  target?: string;
}

export interface SlotAllocationResult {
  requestId: string;
  batchId: string;
  estimatedAirTime: string; // e.g. "15:45 UTC"
  confirmationMessage: string;
  isRejected?: boolean;
  rejectionReason?: string;
  queuePosition?: number;
  isProvisional?: boolean;
  estimatedMinutes?: number;
}

export interface QueueETAResult {
  queuePosition: number;
  estimatedSeconds: number;
  estimatedMinutes: number;
  displayTime: string;
  batchId: string;
  isProvisional: boolean;
}

/**
 * Calculates a realistic dynamic ETA based on queue position and remaining track time.
 * Marks the schedule as provisional to prevent misleading listeners when airplay drifts.
 */
export function calculateQueueETA(params: {
  queuePosition: number;
  remainingSecondsOnCurrentTrack?: number;
  averageTrackSeconds?: number;
  baseTime?: number;
}): QueueETAResult {
  const position = Math.max(1, params.queuePosition);
  const remainingCurrent = params.remainingSecondsOnCurrentTrack ?? 120;
  const avgTrack = params.averageTrackSeconds ?? 210;

  // Queue position #1 plays after current track finishes; subsequent items wait for items ahead
  const estimatedSeconds = Math.max(30, remainingCurrent + (position - 1) * avgTrack);
  const estimatedMinutes = Math.max(1, Math.round(estimatedSeconds / 60));

  const baseMs = params.baseTime ?? Date.now();
  const targetDate = new Date(baseMs + estimatedSeconds * 1000);
  const hoursStr = String(targetDate.getUTCHours()).padStart(2, '0');
  const minStr = String(targetDate.getUTCMinutes()).padStart(2, '0');

  const batchId = `BATCH-${hoursStr}:${minStr}`;
  const displayTime = `${hoursStr}:${minStr} UTC`;

  return {
    queuePosition: position,
    estimatedSeconds,
    estimatedMinutes,
    displayTime,
    batchId,
    isProvisional: true,
  };
}

/**
 * Calculates the next available 15-minute radio batch.
 * Radio Hours are divided into 4 quarter-hour batches:
 *   Batch A (:00), Batch B (:15), Batch C (:30), Batch D (:45)
 */
export function calculateNextBatchSlot(delayMinutes = 15): { batchId: string; airDate: Date; displayTime: string } {
  const targetDate = new Date(Date.now() + delayMinutes * 60 * 1000);
  const minutes = targetDate.getUTCMinutes();
  const roundedQuarter = Math.ceil(minutes / 15) * 15;

  targetDate.setUTCMinutes(roundedQuarter, 0, 0);

  const hoursStr = String(targetDate.getUTCHours()).padStart(2, '0');
  const minStr = String(targetDate.getUTCMinutes()).padStart(2, '0');
  const batchId = `BATCH-${hoursStr}:${minStr}`;
  const displayTime = `${hoursStr}:${minStr} UTC`;

  return { batchId, airDate: targetDate, displayTime };
}

/**
 * 1. Takes an incoming Discord/Telegram request, evaluates ethical & parental safety guardrails,
 * and either schedules it into a batch or refuses it upfront.
 */
export async function scheduleListenerRequest(payload: ListenerRequestPayload): Promise<SlotAllocationResult> {
  // ── 0. Kill Switch / Feature Flag Check ────────────────────────────────────
  if (!isFeatureEnabled('community_requests', true)) {
    return {
      requestId: 'paused',
      batchId: 'PAUSED',
      estimatedAirTime: 'None',
      confirmationMessage: '⏸️ Song and dedication requests are temporarily paused by station administrators.',
      isRejected: true,
      rejectionReason: 'Feature flag community_requests is disabled',
    };
  }

  const supabase = createAdminClient();

  // ── A. Safety & Ethical Guardrails Pre-flight Check ────────────────────────
  const fullTextToInspect = `${payload.content} ${payload.target || ''}`.trim();
  const safety = await evaluateContentSafety(fullTextToInspect);

  if (!safety.safe) {
    // Record rejected request in Supabase for admin audit trail
    const { data: rejectedReq } = await supabase
      .from('community_requests')
      .insert({
        platform: payload.platform,
        platform_user_id: payload.platform_user_id,
        platform_user_name: payload.platform_user_name,
        platform_message_id: payload.platform_message_id || null,
        type: payload.type,
        content: payload.content,
        target: payload.target || null,
        batch_id: null,
        status: 'rejected',
      })
      .select()
      .single();

    return {
      requestId: rejectedReq?.id || 'rejected',
      batchId: 'REJECTED',
      estimatedAirTime: 'None',
      confirmationMessage:
        safety.refusalMessage ||
        `🚫 Request declined: Your submission violates PromptFM broadcast ethics (${safety.category.replace('_', ' ')}). PromptFM operates as a family-safe and inclusive 24/7 radio station.`,
      isRejected: true,
      rejectionReason: safety.reason,
    };
  }

  // ── B. Allocate into Broadcast Batch or Live Queue Slot ─────────────────────
  let batchId = '';
  let airDate = new Date();
  let displayTime = '';
  let queuePosition: number | undefined;
  let isProvisional: boolean | undefined;
  let estimatedMinutes: number | undefined;

  let matchedTrack: { id: string; title: string; artist_name?: string } | null = null;
  if (payload.type === 'song' || payload.type === 'dedication') {
    try {
      const vibeMatches = await findTracksByVibe(payload.content, { limit: 1 });
      if (vibeMatches && vibeMatches.length > 0 && vibeMatches[0]) {
        matchedTrack = vibeMatches[0];
      }
    } catch {
      // Vibe semantic search fallback
    }

    if (!matchedTrack) {
      try {
        const { data: directMatch } = await supabase
          .from('tracks')
          .select('id, title, artist_name')
          .eq('status', 'approved')
          .ilike('title', `%${payload.content}%`)
          .limit(1)
          .maybeSingle();

        if (directMatch) {
          matchedTrack = directMatch;
        }
      } catch {
        // Fallback
      }
    }

    if (!matchedTrack && payload.type === 'dedication') {
      try {
        const { data: anyApproved } = await supabase
          .from('tracks')
          .select('id, title, artist_name')
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle();

        if (anyApproved) {
          matchedTrack = anyApproved;
        }
      } catch {
        // Fallback
      }
    }

    let pendingCount = 0;
    let remainingCurrentTrack = 120;
    try {
      const { data: channel } = await supabase
        .from('channels')
        .select('id')
        .eq('slug', 'main')
        .maybeSingle();

      if (channel) {
        const queueRes = await supabase
          .from('channel_queue')
          .select('id', { count: 'exact', head: true })
          .eq('channel_id', channel.id)
          .is('played_at', null);

        if (queueRes && typeof queueRes.count === 'number') {
          pendingCount = queueRes.count;
        }

        if (matchedTrack) {
          let requestedBy = `@${payload.platform_user_name} (${payload.platform})`;
          if (payload.type === 'dedication') {
            const cleanTarget = payload.target ? `@${payload.target.replace(/^@/, '')}` : '@friend';
            requestedBy = `@${payload.platform_user_name} (Dedicated to ${cleanTarget}: "${payload.content}")`;
          } else if (payload.target) {
            const cleanTarget = `@${payload.target.replace(/^@/, '')}`;
            requestedBy = `@${payload.platform_user_name} (Dedicated to ${cleanTarget})`;
          }

          await supabase.from('channel_queue').insert({
            channel_id: channel.id,
            track_id: matchedTrack.id,
            prompt_used: payload.content,
            requested_by: requestedBy,
          });
        }

        try {
          const { data: stateData } = await supabase
            .from('station_state')
            .select('airplay_item, started_at')
            .eq('channel_slug', 'main')
            .maybeSingle();

          if (stateData?.started_at) {
            const startedMs = new Date(stateData.started_at).getTime();
            const elapsedSec = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
            const hintSec = (stateData.airplay_item as { duration_hint_seconds?: number })?.duration_hint_seconds ?? 210;
            remainingCurrentTrack = Math.max(30, hintSec - elapsedSec);
          }
        } catch {
          // Ignore station_state read failure
        }
      }
    } catch {
      // Non-blocking fallback
    }

    const pos = pendingCount + 1;
    const eta = calculateQueueETA({
      queuePosition: pos,
      remainingSecondsOnCurrentTrack: remainingCurrentTrack,
      averageTrackSeconds: 210,
    });

    queuePosition = eta.queuePosition;
    estimatedMinutes = eta.estimatedMinutes;
    isProvisional = true;
    batchId = eta.batchId;
    displayTime = eta.displayTime;
    airDate = new Date(Date.now() + eta.estimatedSeconds * 1000);
  } else {
    const slot = calculateNextBatchSlot(15);
    batchId = slot.batchId;
    airDate = slot.airDate;
    displayTime = slot.displayTime;
  }

  const { data: request, error } = await supabase
    .from('community_requests')
    .insert({
      platform: payload.platform,
      platform_user_id: payload.platform_user_id,
      platform_user_name: payload.platform_user_name,
      platform_message_id: payload.platform_message_id || null,
      type: payload.type,
      content: payload.content,
      target: payload.target || null,
      batch_id: batchId,
      status: 'scheduled',
      estimated_air_time: airDate.toISOString(),
    })
    .select()
    .single();

  if (error || !request) {
    throw new Error(`Failed to log request: ${error?.message}`);
  }

  const activeDJ = getActiveDJ(undefined, airDate);
  let confirmText = '';
  switch (payload.type) {
    case 'dedication': {
      const posText = queuePosition === 1 ? 'Up next (#1 in queue)' : `#${queuePosition} in queue`;
      const timeEst = `~${displayTime} (est. in ~${estimatedMinutes}m, provisional)`;
      const cleanTarget = payload.target ? `@${payload.target.replace(/^@/, '')}` : '@friend';
      confirmText = `✅ Dedication accepted for ${cleanTarget}! Position: ${posText} • Scheduled for ${batchId} (${timeEst}). ${activeDJ.name} will announce your dedication on air. Check live queue anytime with /queue.`;
      break;
    }
    case 'weather':
      confirmText = `🌤️ Weather check for ${payload.target || payload.content} scheduled in ${batchId} (~${displayTime}) with ${activeDJ.name}.`;
      break;
    case 'zodiac':
      confirmText = `✨ Cosmic AI Zodiac reading for ${payload.target || payload.content} locked in for ${batchId} (~${displayTime}) with ${activeDJ.name}.`;
      break;
    case 'song': {
      const posText = queuePosition === 1 ? 'Up next (#1 in queue)' : `#${queuePosition} in queue`;
      const timeEst = `~${displayTime} (est. in ~${estimatedMinutes}m, provisional)`;
      if (matchedTrack) {
        confirmText = `🎵 Track "${matchedTrack.title}"${matchedTrack.artist_name ? ` by ${matchedTrack.artist_name}` : ''} queued for live airplay! Position: ${posText} • Scheduled for ${batchId} (${timeEst}). Check live queue anytime with /queue.`;
      } else {
        confirmText = `🎵 Track request "${payload.content}" added to airplay queue! Position: ${posText} • Scheduled for ${batchId} (${timeEst}). Check live queue anytime with /queue.`;
      }
      break;
    }
    default:
      confirmText = `📢 Request scheduled for airplay in ${batchId} (~${displayTime}) with ${activeDJ.name}.`;
  }

  return {
    requestId: request.id,
    batchId,
    estimatedAirTime: displayTime,
    confirmationMessage: confirmText,
    queuePosition,
    isProvisional,
    estimatedMinutes,
  };
}

/**
 * 2. Admin Action: Removes an entry from a scheduled batch, sets status to 'rejected',
 * and notifies the user on Discord / Telegram with the reason why!
 */
export async function rejectScheduledRequest(
  requestId: string,
  reason: string,
  moderator = 'Station Admin'
): Promise<{ success: boolean; message: string }> {
  const supabase = createAdminClient();

  const { data: req, error } = await supabase
    .from('community_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (error || !req) {
    throw new Error(`Request not found: ${requestId}`);
  }

  // Update in database
  await supabase
    .from('community_requests')
    .update({
      status: 'rejected',
    })
    .eq('id', requestId);

  // Dispatch rejection notification back to user on Telegram & Discord
  await notifyUserOfRejection(req, reason, moderator);

  return {
    success: true,
    message: `Declined request "${req.content}" from ${req.batch_id || 'queue'} and notified @${req.platform_user_name} on ${req.platform}. Reason: "${reason}"`,
  };
}

/**
 * Sends a direct program notice to the user on Telegram / Discord explaining why their request was removed.
 */
async function notifyUserOfRejection(
  req: {
    platform: string;
    platform_user_id: string;
    platform_user_name: string;
    platform_message_id?: string | null;
    batch_id?: string | null;
    content: string;
  },
  reason: string,
  moderator: string
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://promptfm.live';

  // Telegram notification
  if (req.platform === 'telegram' && botToken) {
    const text = `❌ *PromptFM Program Notice*\n\nHello @${req.platform_user_name}, your request scheduled for *${req.batch_id || 'the broadcast queue'}* ("_${req.content}_") was declined by station moderation.\n\n*Reason:* ${reason}\n\n_PromptFM adheres to family-safe and ethical broadcast standards. Review guidelines at [promptfm.vercel.app](${siteUrl})._`;

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: req.platform_user_id,
          reply_to_message_id: req.platform_message_id ? parseInt(req.platform_message_id, 10) : undefined,
          text,
          parse_mode: 'Markdown',
        }),
      });
    } catch (e) {
      console.warn('Failed to dispatch rejection message to Telegram user:', e);
    }
  }

  // Discord notification
  await broadcastToCommunity({
    title: `Broadcast Moderation Notice (${req.batch_id || 'Queue'})`,
    message: `❌ The request from **@${req.platform_user_name}** (*"${req.content}"*) was declined by **${moderator}**.\n\n**Reason:** ${reason}`,
    author: moderator,
  });
}

/**
 * 3. Resolves and synthesizes a scheduled dedication, zodiac, or weather drop into live audio.
 */
export async function synthesizeScheduledRequest(requestId: string): Promise<{ audioUrl: string; script: string }> {
  const supabase = createAdminClient();

  const { data: req, error } = await supabase
    .from('community_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (error || !req) throw new Error('Request not found');

  let promptForGemini = '';

  if (req.type === 'dedication') {
    promptForGemini = `Listener shoutout! Listener @${req.platform_user_name} on ${req.platform} has sent this dedication to ${req.target || 'a special friend'}: "${req.content}".
Deliver this dedication on air with high radio warmth, charisma, and enthusiasm. Under 35 words. No brackets.`;
  } else if (req.type === 'zodiac') {
    promptForGemini = `Give a 25-second fun, futuristic "Synthetic Music Horoscope" for the sign of ${req.target || req.content}, requested by @${req.platform_user_name} on ${req.platform}. Mention what AI vibe or frequencies they should tune into today. Under 45 words.`;
  } else if (req.type === 'weather') {
    const weather = await fetchLiveWeatherSummary(req.target || req.content);
    promptForGemini = `Live listener weather check for ${weather.city}, requested by @${req.platform_user_name}: "${weather.text}". Deliver with radio style. Under 30 words.`;
  } else {
    promptForGemini = `Deliver this listener request from @${req.platform_user_name}: "${req.content}". Under 30 words.`;
  }

  // Generate Voice with Gemini & Google Cloud TTS using the active DJ
  const activeDJ = getActiveDJ();
  const { script, audioUrl, dj } = await createBroadcastDrop({
    type: 'custom_prompt',
    topicOrText: promptForGemini,
    dj: activeDJ,
  });

  // Mark as aired in database
  await supabase
    .from('community_requests')
    .update({
      status: 'aired',
      audio_url: audioUrl,
      aired_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  // Notify Discord/Telegram channels that this dedication is on air NOW
  await broadcastToCommunity({
    title: `ON AIR NOW: Dedication from @${req.platform_user_name}`,
    message: `🎙️ "${script}"\n\nTune in live: https://promptfm.live`,
    category: 'dedication',
    author: dj.name,
  });

  return { audioUrl, script };
}

/**
 * 4. Batches all scheduled community requests (dedications, weather, shoutouts)
 * into ONE single concise radio announcement by the active DJ.
 * Airs only when scheduled in the programming clock, preventing continuous interruptions.
 */
export async function synthesizeBatchAnnouncement(
  batchId: string
): Promise<{ audioUrl: string; script: string; count: number }> {
  const supabase = createAdminClient();

  const { data: requests, error } = await supabase
    .from('community_requests')
    .select('*')
    .eq('batch_id', batchId)
    .in('status', ['scheduled', 'pending'])
    .order('created_at', { ascending: true })
    .limit(10);

  if (error || !requests || requests.length === 0) {
    return { audioUrl: '', script: '', count: 0 };
  }

  // Build a single consolidated prompt
  const itemsText = requests
    .map((r) => {
      if (r.type === 'dedication') {
        return `@${r.platform_user_name} dedicates: "${r.content}" to ${r.target || 'friends'}`;
      }
      if (r.type === 'weather') {
        return `@${r.platform_user_name} asks for weather in ${r.target || r.content}`;
      }
      if (r.type === 'zodiac') {
        return `@${r.platform_user_name} requests horoscope for ${r.target || r.content}`;
      }
      return `@${r.platform_user_name}: "${r.content}"`;
    })
    .join('; ');

  const promptForGemini = `Here are this hour's community listener shoutouts from Telegram & Discord: [${itemsText}].
Deliver them warmly together in ONE single seamless radio host announcement. Keep it upbeat, fun, and concise (under 45 words). No brackets.`;

  const activeDJ = getActiveDJ();
  const { script, audioUrl, dj } = await createBroadcastDrop({
    type: 'custom_prompt',
    topicOrText: promptForGemini,
    dj: activeDJ,
  });

  const requestIds = requests.map((r) => r.id);
  await supabase
    .from('community_requests')
    .update({
      status: 'aired',
      audio_url: audioUrl,
      aired_at: new Date().toISOString(),
    })
    .in('id', requestIds);

  await broadcastToCommunity({
    title: `ON AIR NOW: Community Batch Shoutout (${batchId})`,
    message: `🎙️ "${script}"\n\nFeaturing shoutouts from: ${requests.map((r) => `@${r.platform_user_name}`).join(', ')}\nTune in: https://promptfm.live`,
    category: 'dedication',
    author: dj.name,
  });

  return { audioUrl, script, count: requests.length };
}
