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

  // ── B. Allocate into Next Available 15-Minute Broadcast Batch ───────────────
  const { batchId, airDate, displayTime } = calculateNextBatchSlot(15);

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
    case 'dedication':
      confirmText = `✅ Dedication accepted for @${payload.target || 'friend'}! Scheduled for ${batchId} (approx. ${displayTime}). ${activeDJ.name} will announce your dedication on air.`;
      break;
    case 'weather':
      confirmText = `🌤️ Weather check for ${payload.target || payload.content} scheduled in ${batchId} (~${displayTime}) with ${activeDJ.name}.`;
      break;
    case 'zodiac':
      confirmText = `✨ Cosmic AI Zodiac reading for ${payload.target || payload.content} locked in for ${batchId} (~${displayTime}) with ${activeDJ.name}.`;
      break;
    case 'song':
      confirmText = `🎵 Track request "${payload.content}" added to airplay queue for ${batchId} (~${displayTime}).`;
      break;
    default:
      confirmText = `📢 Request scheduled for airplay in ${batchId} (~${displayTime}) with ${activeDJ.name}.`;
  }

  return {
    requestId: request.id,
    batchId,
    estimatedAirTime: displayTime,
    confirmationMessage: confirmText,
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
    author: dj.name,
  });

  return { audioUrl, script };
}
