// src/lib/dj/batches.ts
// Listener Request Batch & Slot Scheduler
// Allocates Discord/Telegram listener requests (songs, dedications, weather, zodiac)
// into evenly distributed broadcast batches to ensure fair airplay.

import { createAdminClient } from '../supabase/server';
import { createBroadcastDrop } from './engine';
import { fetchLiveWeatherSummary } from './rotation';
import { broadcastToCommunity } from '../chat/bridge';

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
 * 1. Takes an incoming Discord/Telegram request and schedules it into an upcoming batch slot.
 */
export async function scheduleListenerRequest(payload: ListenerRequestPayload): Promise<SlotAllocationResult> {
  const supabase = createAdminClient();
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

  let confirmText = '';
  switch (payload.type) {
    case 'dedication':
      confirmText = `✅ Dedication accepted for @${payload.target || 'friend'}! Scheduled for ${batchId} (approx. ${displayTime}). DJ Neon will announce your dedication on air.`;
      break;
    case 'weather':
      confirmText = `🌤️ Weather check for ${payload.target || payload.content} scheduled in ${batchId} (~${displayTime}).`;
      break;
    case 'zodiac':
      confirmText = `✨ Cosmic AI Zodiac reading for ${payload.target || payload.content} locked in for ${batchId} (~${displayTime}).`;
      break;
    case 'song':
      confirmText = `🎵 Track request "${payload.content}" added to airplay queue for ${batchId} (~${displayTime}).`;
      break;
    default:
      confirmText = `📢 Request scheduled for airplay in ${batchId} (~${displayTime}).`;
  }

  return {
    requestId: request.id,
    batchId,
    estimatedAirTime: displayTime,
    confirmationMessage: confirmText,
  };
}

/**
 * 2. Resolves and synthesizes a scheduled dedication, zodiac, or weather drop into live audio.
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

  // Generate Voice with Gemini & Google Cloud TTS
  const { script, audioUrl } = await createBroadcastDrop({
    type: 'custom_prompt',
    topicOrText: promptForGemini,
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
    message: `🎙️ "${script}"\n\nTune in live: https://promptfm.vercel.app`,
    author: 'DJ Neon',
  });

  return { audioUrl, script };
}

