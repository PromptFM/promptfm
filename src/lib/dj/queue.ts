// src/lib/dj/queue.ts
// PromptFM Unified Station Queue Service & Multi-Interface Formatters (Issue #86)
// Provides unified queue retrieval and consistent formatting across Discord, Telegram, CLI, Web Admin, and MCP.

import { createAdminClient } from '../supabase/server';
import { getUpNext, type AirplayItem } from './rotation';
import type { RequestType } from './batches';

export interface ScheduledCommunityRequest {
  id: string;
  platform: 'discord' | 'telegram' | 'web';
  platform_user_id?: string;
  platform_user_name: string;
  platform_message_id?: string;
  type: RequestType;
  content: string;
  target?: string | null;
  batch_id?: string | null;
  status: 'pending' | 'scheduled' | 'aired' | 'rejected';
  estimated_air_time?: string | null;
  created_at?: string;
}

export interface StationQueueOptions {
  channelSlug?: string;
  upcomingLimit?: number;
  scheduledLimit?: number;
}

export interface StationQueueResult {
  channel: string;
  upcoming: AirplayItem[];
  scheduledRequests: ScheduledCommunityRequest[];
  hasItems: boolean;
}

/**
 * Formats an ISO string or time string into display format "HH:MM UTC".
 */
export function formatAirTime(airTime?: string | null): string {
  if (!airTime) return 'TBD';
  if (airTime.includes('T')) {
    const date = new Date(airTime);
    if (!isNaN(date.getTime())) {
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const mins = String(date.getUTCMinutes()).padStart(2, '0');
      return `${hours}:${mins} UTC`;
    }
  }
  return airTime;
}

/**
 * Capitalizes status string for readable display (e.g. "scheduled" -> "Scheduled").
 */
export function formatStatus(status?: string | null): string {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Retrieves scheduled community requests pending or scheduled for broadcast batches.
 */
export async function getScheduledRequests(limit = 5): Promise<ScheduledCommunityRequest[]> {
  try {
    const supabase = createAdminClient();
    const query = supabase
      .from('community_requests')
      .select('id, platform, platform_user_name, type, content, target, batch_id, status, estimated_air_time, created_at')
      .in('status', ['pending', 'scheduled'])
      .order('created_at', { ascending: true })
      .limit(limit);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<{ data: null; error: null }>((resolve) => {
      timeoutId = setTimeout(() => resolve({ data: null, error: null }), 600);
    });

    const res = await Promise.race([query, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);

    if (res?.data && Array.isArray(res.data)) {
      return res.data as ScheduledCommunityRequest[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Retrieves the unified station queue consisting of upcoming airplay tracks
 * and scheduled community requests pending or scheduled for broadcast batches.
 */
export async function getStationQueue(options: StationQueueOptions = {}): Promise<StationQueueResult> {
  const channelSlug = options.channelSlug || 'main';
  const upcomingLimit = typeof options.upcomingLimit === 'number' ? options.upcomingLimit : 5;
  const scheduledLimit = typeof options.scheduledLimit === 'number' ? options.scheduledLimit : 5;

  let upcomingTimeoutId: ReturnType<typeof setTimeout> | undefined;
  const upcomingPromise = new Promise<AirplayItem[]>((resolve) => {
    upcomingTimeoutId = setTimeout(() => resolve([]), 1200);
    getUpNext(channelSlug, upcomingLimit)
      .then((res) => resolve(res))
      .catch(() => resolve([]));
  }).finally(() => {
    if (upcomingTimeoutId) clearTimeout(upcomingTimeoutId);
  });

  const [upcoming, scheduledRequests] = await Promise.all([
    upcomingPromise,
    getScheduledRequests(scheduledLimit).catch(() => []),
  ]);

  const hasItems = upcoming.length > 0 || scheduledRequests.length > 0;

  return {
    channel: channelSlug,
    upcoming,
    scheduledRequests,
    hasItems,
  };
}

/**
 * Formats unified queue for Discord slash command (/q, /queue, /next, /n).
 * Guarantees a helpful non-blank output even when no tracks are queued.
 */
export function formatQueueForDiscord(queue: StationQueueResult, siteUrl?: string): string {
  let text = '⏭️ **Up Next on PromptFM:**\n\n';

  if (!queue.hasItems) {
    text += 'No tracks currently queued. Continuous community stream is active!\nRequest a song with `/song <prompt>` or a dedication with `/dedicate <user> <message>`!';
    if (siteUrl) {
      text += `\n\n[Tune in Live](${siteUrl})`;
    }
    return text;
  }

  if (queue.upcoming.length > 0) {
    queue.upcoming.forEach((item, index) => {
      const toolStr = item.tool_used ? ` (${item.tool_used})` : '';
      text += `${index + 1}. **"${item.title}"** by ${item.artist}${toolStr} — 🔥 ${item.upvotes_count ?? 0} votes\n`;
    });
  }

  if (queue.scheduledRequests.length > 0) {
    text += '\n📋 **Scheduled Community Requests:**\n';
    queue.scheduledRequests.forEach((req) => {
      const targetStr = req.target ? ` for @${req.target}` : '';
      const batchStr = req.batch_id || 'Next Batch';
      const timeStr = req.estimated_air_time ? ` ~${formatAirTime(req.estimated_air_time)}` : '';
      const statusStr = formatStatus(req.status);
      text += `• **[${req.type.toUpperCase()}]** "${req.content}"${targetStr} — requested by @${req.platform_user_name} (${req.platform}) (${batchStr}${timeStr} • ⏳ ${statusStr})\n`;
    });
  }

  if (siteUrl) {
    text += `\n[Tune in Live](${siteUrl})`;
  }

  return text;
}

/**
 * Formats unified queue for Telegram bot command (/q, /queue, /next, /n).
 */
export function formatQueueForTelegram(queue: StationQueueResult, siteUrl?: string): string {
  let text = '⏭️ *Up Next on PromptFM:*\n\n';

  if (!queue.hasItems) {
    text += 'Continuous community stream loaded. Request a song with /song <prompt>!';
    if (siteUrl) {
      text += `\n\n[Tune in Live](${siteUrl})`;
    }
    return text;
  }

  if (queue.upcoming.length > 0) {
    queue.upcoming.forEach((item, index) => {
      const toolStr = item.tool_used ? ` (${item.tool_used})` : '';
      text += `${index + 1}. *"${item.title}"* by ${item.artist}${toolStr} — 🔥 ${item.upvotes_count ?? 0} votes\n`;
    });
  }

  if (queue.scheduledRequests.length > 0) {
    text += '\n📋 *Scheduled Community Requests:*\n';
    queue.scheduledRequests.forEach((req) => {
      const targetStr = req.target ? ` for @${req.target}` : '';
      const batchStr = req.batch_id || 'Next Batch';
      const timeStr = req.estimated_air_time ? ` ~${formatAirTime(req.estimated_air_time)}` : '';
      const statusStr = formatStatus(req.status);
      text += `• [*${req.type.toUpperCase()}*] "${req.content}"${targetStr} — @${req.platform_user_name} (${req.platform}) (${batchStr}${timeStr} • ⏳ ${statusStr})\n`;
    });
  }

  if (siteUrl) {
    text += `\n[Tune in Live](${siteUrl})`;
  }

  return text;
}

/**
 * Formats unified queue for CLI terminal display (npm run promptfm q / queue list).
 */
export function formatQueueForCLI(queue: StationQueueResult): string {
  if (!queue.hasItems) {
    return `\n🎵 PromptFM Active Broadcast Queue:
• Queue is empty. Looping community top chart tracks.
• Request a track: npm run promptfm queue "<prompt>"
• Or schedule a song via Discord/Telegram: /song <prompt>\n`;
  }

  let output = `\n🎵 PromptFM Active Broadcast Queue (${queue.upcoming.length} upcoming tracks, ${queue.scheduledRequests.length} scheduled requests):\n`;

  if (queue.upcoming.length > 0) {
    output += `\nUpcoming Tracks:\n`;
    queue.upcoming.forEach((item, index) => {
      const toolStr = item.tool_used ? ` (${item.tool_used})` : '';
      output += `  #${index + 1} "${item.title}" by ${item.artist}${toolStr} [Votes: ${item.upvotes_count ?? 0}]\n`;
    });
  }

  if (queue.scheduledRequests.length > 0) {
    output += `\nScheduled Listener Requests:\n`;
    queue.scheduledRequests.forEach((req) => {
      const targetStr = req.target ? ` for @${req.target}` : '';
      const batchStr = req.batch_id || 'Next Batch';
      const timeStr = req.estimated_air_time ? ` ~${formatAirTime(req.estimated_air_time)}` : '';
      const statusStr = formatStatus(req.status);
      output += `  • [${req.type.toUpperCase()}] "${req.content}"${targetStr} requested by @${req.platform_user_name} (${req.platform}) [${batchStr}${timeStr} | ${statusStr}]\n`;
    });
  }

  return output;
}
