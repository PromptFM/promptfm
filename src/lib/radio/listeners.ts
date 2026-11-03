// src/lib/radio/listeners.ts
// Live Listener Telemetry & Active Presence Tracking for PromptFM Stations

import { DEFAULT_CHANNEL_SLUG, OFFICIAL_CHANNELS, isValidChannelSlug } from './channels';

export interface LiveListenerStats {
  channelSlug: string;
  channelListeners: number;
  totalNetworkListeners: number;
  activeChannelsCount: number;
  timestamp: number;
}

const SESSION_TTL_MS = 45000; // 45 seconds

// Channel Slug -> (SessionId -> LastSeenTimestamp)
const activeSessionsByChannel: Map<string, Map<string, number>> = new Map();

/**
 * Calculates a smooth, realistic baseline listener audience for a given station.
 * Simulates real-world radio listening patterns (diurnal curve peaking in afternoon/evening).
 */
export function calculateBaselineListeners(channelSlug: string, hour = new Date().getUTCHours()): number {
  const normalizedSlug = isValidChannelSlug(channelSlug) ? channelSlug.toLowerCase().trim() : DEFAULT_CHANNEL_SLUG;

  // Diurnal activity factor between 0.35 (night) and 1.0 (peak day)
  // Normalized sinusoid peaking around 16:00 UTC
  const radian = ((hour - 4 + 24) % 24) * (Math.PI / 12);
  const timeFactor = 0.4 + 0.6 * ((Math.sin(radian - Math.PI / 2) + 1) / 2);

  // Baseline scale by station genre
  let baseStationScale = 65;
  if (normalizedSlug === 'cyberpunk') baseStationScale = 38;
  if (normalizedSlug === 'chillout') baseStationScale = 45;
  if (normalizedSlug === 'kids') baseStationScale = 22;

  // Add deterministic subtle variance based on current 10-minute slot
  const minuteSlot = Math.floor(new Date().getUTCMinutes() / 10);
  const variance = ((minuteSlot * 7 + normalizedSlug.length * 3) % 9) - 4;

  const calculated = Math.round(baseStationScale * timeFactor + variance);
  return Math.max(5, calculated);
}

/**
 * Prunes expired listener sessions and returns the live count for a channel.
 */
export function getActiveWebSessionCount(channelSlug: string, now = Date.now()): number {
  const normalizedSlug = isValidChannelSlug(channelSlug) ? channelSlug.toLowerCase().trim() : DEFAULT_CHANNEL_SLUG;
  const channelMap = activeSessionsByChannel.get(normalizedSlug);
  if (!channelMap) return 0;

  for (const [sessionId, lastSeen] of channelMap.entries()) {
    if (now - lastSeen > SESSION_TTL_MS) {
      channelMap.delete(sessionId);
    }
  }

  return channelMap.size;
}

/**
 * Records or refreshes a live listener heartbeat for a station channel.
 */
export function registerListenerPing(channelSlug: string, sessionId: string, now = Date.now()): void {
  const normalizedSlug = isValidChannelSlug(channelSlug) ? channelSlug.toLowerCase().trim() : DEFAULT_CHANNEL_SLUG;

  if (!activeSessionsByChannel.has(normalizedSlug)) {
    activeSessionsByChannel.set(normalizedSlug, new Map());
  }

  const channelMap = activeSessionsByChannel.get(normalizedSlug)!;
  channelMap.set(sessionId, now);
}

/**
 * Computes live listener counts for a specific channel and the whole PromptFM network.
 */
export function getLiveListenerStats(channelSlug = DEFAULT_CHANNEL_SLUG, now = Date.now()): LiveListenerStats {
  const normalizedSlug = isValidChannelSlug(channelSlug) ? channelSlug.toLowerCase().trim() : DEFAULT_CHANNEL_SLUG;

  let totalNetworkListeners = 0;
  let targetChannelListeners = 0;

  for (const ch of OFFICIAL_CHANNELS) {
    const baseline = calculateBaselineListeners(ch.slug);
    const activeWeb = getActiveWebSessionCount(ch.slug, now);
    const channelTotal = baseline + activeWeb;

    totalNetworkListeners += channelTotal;
    if (ch.slug === normalizedSlug) {
      targetChannelListeners = channelTotal;
    }
  }

  return {
    channelSlug: normalizedSlug,
    channelListeners: targetChannelListeners,
    totalNetworkListeners,
    activeChannelsCount: OFFICIAL_CHANNELS.length,
    timestamp: now,
  };
}

/**
 * Resets all in-memory listener session maps for unit test isolation.
 */
export function clearListenerSessionsForTesting(): void {
  activeSessionsByChannel.clear();
}
