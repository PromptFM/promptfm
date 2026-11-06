// @ts-nocheck
// src/lib/mcp/client.ts
// Official Web MCP client, command runner, and typed tool adapters for PromptFM
// Enables unified listener and admin station interaction directly via JSON-RPC 2.0 /api/mcp

export interface McpCallOptions {
  adminKey?: string;
  endpoint?: string;
  fetchFn?: typeof fetch;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface WebMcpCommandResult {
  success: boolean;
  command: string;
  toolName?: string;
  message: string;
  data?: any;
}

export interface ParsedCommand {
  command: string;
  rawArgs: string;
}

/**
 * Universal JSON-RPC 2.0 Client for PromptFM Model Context Protocol (MCP) endpoint.
 */
export async function callMcpTool<T = any>(
  name: string,
  args: Record<string, unknown> = {},
  options: McpCallOptions = {}
): Promise<T> {
  const endpoint = options.endpoint || '/api/mcp';
  const fetchImpl = options.fetchFn || (typeof window !== 'undefined' ? window.fetch : global.fetch);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.adminKey) {
    headers['x-admin-key'] = options.adminKey;
    headers['Authorization'] = `Bearer ${options.adminKey}`;
  }

  const payload = {
    jsonrpc: '2.0',
    id: `web-mcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    method: 'tools/call',
    params: {
      name,
      arguments: args,
    },
  };

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);

  if (!body) {
    throw new Error(`MCP request failed with HTTP ${res.status}`);
  }

  if (body.error) {
    throw new Error(body.error.message || 'MCP tool execution error');
  }

  const result = body.result;
  if (!result) {
    throw new Error('Malformed MCP JSON-RPC response: missing result');
  }

  if (result.isError) {
    const errorText = result.content?.[0]?.text || 'MCP tool execution error';
    throw new Error(errorText);
  }

  const text = result.content?.[0]?.text;
  if (typeof text === 'string') {
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  return result as T;
}

/**
 * Lists available MCP tools exposed by the server.
 */
export async function listMcpTools(options: McpCallOptions = {}): Promise<McpToolDefinition[]> {
  const endpoint = options.endpoint || '/api/mcp';
  const fetchImpl = options.fetchFn || (typeof window !== 'undefined' ? window.fetch : global.fetch);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.adminKey) {
    headers['x-admin-key'] = options.adminKey;
    headers['Authorization'] = `Bearer ${options.adminKey}`;
  }

  const payload = {
    jsonrpc: '2.0',
    id: `web-mcp-list-${Date.now()}`,
    method: 'tools/list',
  };

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (body.error) {
    throw new Error(body.error.message || 'Failed to list MCP tools');
  }

  return body.result?.tools || [];
}

/**
 * Parses user input into a canonical command name and argument string.
 * Supports canonical commands and shorthands (/s, /np, /q, /n, /h),
 * and defaults plain text vibe prompts to the song queue command.
 */
export function parseMcpCommandString(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return {
      command: 'song',
      rawArgs: trimmed,
    };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const rawCmd = (parts[0] || '').toLowerCase();
  const rawArgs = parts.slice(1).join(' ').trim();

  switch (rawCmd) {
    case 's':
    case 'song':
      return { command: 'song', rawArgs };
    case 'np':
    case 'nowplaying':
      return { command: 'nowplaying', rawArgs };
    case 'q':
    case 'queue':
    case 'next':
    case 'n':
      return { command: 'queue', rawArgs };
    case 'v':
    case 'vote':
      return { command: 'vote', rawArgs };
    case 'vibe':
    case 'search':
      return { command: 'search', rawArgs };
    case 'dj':
    case 'djs':
      return { command: 'djs', rawArgs };
    case 'schedule':
      return { command: 'schedule', rawArgs };
    case 'top':
      return { command: 'top', rawArgs };
    case 'r':
    case 'report':
      return { command: 'report', rawArgs };
    case 'h':
    case 'help':
      return { command: 'help', rawArgs };
    default:
      return { command: rawCmd, rawArgs };
  }
}

/**
 * Unified listener command interpreter: executes listener actions directly via Web MCP tools.
 */
export async function executeWebMcpCommand(
  input: string,
  options: {
    channel?: string;
    requester?: string;
    adminKey?: string;
    endpoint?: string;
  } = {}
): Promise<WebMcpCommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      success: false,
      command: '',
      message: 'Please enter a command (e.g. /song synthwave, /np, /queue, or /help)',
    };
  }

  const { command, rawArgs } = parseMcpCommandString(trimmed);
  const channel = options.channel || 'main';
  const requester = options.requester || 'Web Listener';
  const callOpts: McpCallOptions = {
    adminKey: options.adminKey,
    endpoint: options.endpoint,
  };

  try {
    switch (command) {
      case 'help': {
        return {
          success: true,
          command: 'help',
          message: 'PromptFM Web MCP Interactive Commands: /song, /queue, /nowplaying, /search, /vote, /djs, /schedule, /top, /report, /help',
          data: {
            commands: [
              { command: '/song <vibe>', desc: 'Queue an AI track into the live station rotation' },
              { command: '/queue', desc: 'Inspect upcoming 5 tracks and requests' },
              { command: '/nowplaying', desc: 'Live track metadata, active AI DJ, and audio URLs' },
              { command: '/search <vibe>', desc: 'pgvector semantic search matching natural language description' },
              { command: '/vote <track_id>', desc: 'Cast an upvote for any track on weekly charts' },
              { command: '/djs', desc: 'Browse the 5 AI station hosts, voices, and active DJ' },
              { command: '/schedule', desc: 'Inspect 24/7 clock wheel and broadcast programming' },
              { command: '/top [limit]', desc: 'Fetch top community AI tracks' },
              { command: '/report <id> <reason>', desc: 'Submit safety or copyright alert to moderators' },
            ],
          },
        };
      }

      case 'song': {
        if (!rawArgs) {
          return {
            success: false,
            command: 'song',
            message: 'A musical prompt or vibe is required. Example: /song synthwave sunset',
          };
        }
        const data = await callMcpTool(
          'promptfm_queue_song_request',
          {
            prompt: rawArgs,
            channel,
            requested_by: requester,
          },
          callOpts
        );
        return {
          success: true,
          command: 'song',
          toolName: 'promptfm_queue_song_request',
          message: data.message || `Queued track for airplay on ${channel}!`,
          data,
        };
      }

      case 'nowplaying': {
        const data = await callMcpTool(
          'promptfm_get_now_playing',
          { channel },
          callOpts
        );
        const np = data.now_playing;
        const msg = np
          ? `Now Playing on ${channel}: "${np.title}" by ${np.artist} [DJ: ${np.active_dj?.name || 'Live AI'}]`
          : `Station live on ${channel}`;
        return {
          success: true,
          command: 'nowplaying',
          toolName: 'promptfm_get_now_playing',
          message: msg,
          data,
        };
      }

      case 'queue': {
        const data = await callMcpTool(
          'promptfm_get_up_next',
          { channel, limit: 5 },
          callOpts
        );
        return {
          success: true,
          command: 'queue',
          toolName: 'promptfm_get_up_next',
          message: `Station Up Next: ${data.upcoming_count || data.up_next?.length || 0} track(s) in queue for ${channel}.`,
          data,
        };
      }

      case 'search': {
        if (!rawArgs) {
          return {
            success: false,
            command: 'search',
            message: 'Please provide a vibe prompt to search. Example: /search dark cyberpunk synth',
          };
        }
        const data = await callMcpTool(
          'promptfm_search_tracks_by_vibe',
          { prompt: rawArgs, channel, limit: 5 },
          callOpts
        );
        return {
          success: true,
          command: 'search',
          toolName: 'promptfm_search_tracks_by_vibe',
          message: `Found ${data.count || data.tracks?.length || 0} track(s) matching "${rawArgs}".`,
          data,
        };
      }

      case 'vote': {
        if (!rawArgs) {
          return {
            success: false,
            command: 'vote',
            message: 'A track ID is required to cast a vote. Example: /vote <track-uuid>',
          };
        }
        const trackId = rawArgs.split(/\s+/)[0];
        const data = await callMcpTool(
          'promptfm_upvote_track',
          { track_id: trackId },
          callOpts
        );
        return {
          success: true,
          command: 'vote',
          toolName: 'promptfm_upvote_track',
          message: data.message || `Upvoted track ${trackId}!`,
          data,
        };
      }

      case 'djs': {
        const data = await callMcpTool('promptfm_get_djs', {}, callOpts);
        const activeName = data.active_dj_now?.name || 'AI Host';
        return {
          success: true,
          command: 'djs',
          toolName: 'promptfm_get_djs',
          message: `Active DJ on air: ${activeName}. ${data.djs?.length || 0} DJs in station roster.`,
          data,
        };
      }

      case 'schedule': {
        const data = await callMcpTool('promptfm_get_schedule', {}, callOpts);
        return {
          success: true,
          command: 'schedule',
          toolName: 'promptfm_get_schedule',
          message: 'Retrieved station 24/7 broadcast schedule.',
          data,
        };
      }

      case 'top': {
        const parsedLimit = parseInt(rawArgs, 10);
        const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
        const data = await callMcpTool('promptfm_get_top_tracks', { limit }, callOpts);
        return {
          success: true,
          command: 'top',
          toolName: 'promptfm_get_top_tracks',
          message: `Top ${data.count || data.leaderboard?.length || 0} weekly community tracks.`,
          data,
        };
      }

      case 'report': {
        const parts = rawArgs.split(/\s+/);
        const targetId = parts[0];
        const reason = parts[1] || 'other';
        const details = parts.slice(2).join(' ') || undefined;

        if (!targetId) {
          return {
            success: false,
            command: 'report',
            message: 'Target ID is required. Example: /report track-123 copyright_dmca Uncredited sample',
          };
        }

        const data = await callMcpTool(
          'promptfm_report_content',
          {
            target_type: 'track',
            target_id: targetId,
            reason,
            details,
            reporter_id: requester,
          },
          callOpts
        );
        return {
          success: true,
          command: 'report',
          toolName: 'promptfm_report_content',
          message: `Report filed (Ticket ID: ${data.ticket_id || 'submitted'}). Moderation alerted.`,
          data,
        };
      }

      default: {
        return {
          success: false,
          command,
          message: `Unknown command "/${command}". Type /help to see all available actions.`,
        };
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      command,
      message: errorMsg,
    };
  }
}

// ── Listener Action Wrappers ─────────────────────────────────────────────────

export async function webMcpQueueSong(
  prompt: string,
  options: { channel?: string; requester?: string; adminKey?: string } = {}
) {
  return callMcpTool(
    'promptfm_queue_song_request',
    {
      prompt,
      channel: options.channel || 'main',
      requested_by: options.requester || 'Web Listener',
    },
    { adminKey: options.adminKey }
  );
}

export async function webMcpUpvoteTrack(trackId: string, adminKey?: string) {
  return callMcpTool('promptfm_upvote_track', { track_id: trackId }, { adminKey });
}

export async function webMcpSearchVibe(
  prompt: string,
  options: { channel?: string; limit?: number; adminKey?: string } = {}
) {
  return callMcpTool(
    'promptfm_search_tracks_by_vibe',
    {
      prompt,
      channel: options.channel || 'main',
      limit: options.limit ?? 5,
    },
    { adminKey: options.adminKey }
  );
}

export async function webMcpGetNowPlaying(channel = 'main', adminKey?: string) {
  return callMcpTool('promptfm_get_now_playing', { channel }, { adminKey });
}

export async function webMcpGetUpNext(channel = 'main', limit = 5, adminKey?: string) {
  return callMcpTool('promptfm_get_up_next', { channel, limit }, { adminKey });
}

export async function webMcpGetTopTracks(limit = 10, adminKey?: string) {
  return callMcpTool('promptfm_get_top_tracks', { limit }, { adminKey });
}

export async function webMcpGetSchedule(adminKey?: string) {
  return callMcpTool('promptfm_get_schedule', {}, { adminKey });
}

export async function webMcpGetDJs(adminKey?: string) {
  return callMcpTool('promptfm_get_djs', {}, { adminKey });
}

export async function webMcpReportContent(
  payload: {
    target_type?: string;
    target_id: string;
    reason: string;
    details?: string;
    reporter_id?: string;
  },
  adminKey?: string
) {
  return callMcpTool(
    'promptfm_report_content',
    {
      target_type: payload.target_type || 'track',
      target_id: payload.target_id,
      reason: payload.reason,
      details: payload.details,
      reporter_id: payload.reporter_id || 'web-listener',
    },
    { adminKey }
  );
}

// ── Admin Action Wrappers ────────────────────────────────────────────────────

export async function webMcpModerateTrack(
  trackId: string,
  action: 'approved' | 'rejected',
  adminKey?: string
) {
  return callMcpTool(
    'promptfm_admin_moderate_track',
    { track_id: trackId, action },
    { adminKey }
  );
}

export async function webMcpRemoveFromQueue(queueId: string, adminKey?: string) {
  return callMcpTool(
    'promptfm_admin_remove_from_queue',
    { queue_id: queueId },
    { adminKey }
  );
}

export async function webMcpRejectRequest(requestId: string, reason: string, adminKey?: string) {
  return callMcpTool(
    'promptfm_admin_reject_request',
    { request_id: requestId, reason },
    { adminKey }
  );
}

export async function webMcpResolveReport(
  reportId: string,
  action: 'actioned' | 'dismissed',
  notes?: string,
  actor?: string,
  adminKey?: string
) {
  return callMcpTool(
    'promptfm_admin_resolve_report',
    {
      report_id: reportId,
      action,
      notes,
      actor: actor || 'Web Studio Admin',
    },
    { adminKey }
  );
}

export async function webMcpAuditReports(limit = 100, adminKey?: string) {
  return callMcpTool('promptfm_admin_audit_reports', { limit }, { adminKey });
}

export async function webMcpBroadcast(message: string, postToX = false, adminKey?: string) {
  return callMcpTool(
    'promptfm_admin_broadcast',
    { message, post_to_x: postToX },
    { adminKey }
  );
}

export async function webMcpCreateChannel(
  channel: {
    slug: string;
    name: string;
    description?: string;
    dj_id?: string;
    is_18_plus?: boolean;
    min_age?: number;
    disclaimer?: string;
  },
  adminKey?: string
) {
  return callMcpTool(
    'promptfm_admin_create_channel',
    {
      slug: channel.slug,
      name: channel.name,
      description: channel.description,
      dj_id: channel.dj_id,
      is_18_plus: channel.is_18_plus,
      min_age: channel.min_age,
      disclaimer: channel.disclaimer,
    },
    { adminKey }
  );
}

export async function webMcpStartStream(
  platform: 'youtube' | 'tiktok',
  streamKey: string,
  rtmpUrl?: string,
  adminKey?: string
) {
  return callMcpTool(
    'promptfm_admin_start_stream',
    {
      platform,
      stream_key: streamKey,
      rtmp_url: rtmpUrl,
    },
    { adminKey }
  );
}

export async function webMcpStopStream(platform: 'youtube' | 'tiktok', adminKey?: string) {
  return callMcpTool(
    'promptfm_admin_stop_stream',
    { platform },
    { adminKey }
  );
}

export async function webMcpGetStreamStatus(adminKey?: string) {
  return callMcpTool('promptfm_admin_get_stream_status', {}, { adminKey });
}

export async function webMcpVoiceDrop(prompt: string, djId?: string, adminKey?: string) {
  return callMcpTool(
    'promptfm_admin_voice_drop',
    { prompt, dj_id: djId },
    { adminKey }
  );
}

export async function webMcpInjectInterstitial(
  payload: {
    type: 'news' | 'weather' | 'announcement' | 'custom_prompt';
    prompt?: string;
    city?: string;
    dj_id?: string;
  },
  adminKey?: string
) {
  return callMcpTool('promptfm_admin_inject_interstitial', payload, { adminKey });
}

export async function webMcpInjectAd(
  payload: {
    ad_id?: string;
    sponsor?: string;
    copy?: string;
    dj_id?: string;
  },
  adminKey?: string
) {
  return callMcpTool('promptfm_admin_inject_ad', payload, { adminKey });
}

export async function webMcpAirRequest(requestId: string, adminKey?: string) {
  return callMcpTool('promptfm_admin_air_request', { request_id: requestId }, { adminKey });
}
