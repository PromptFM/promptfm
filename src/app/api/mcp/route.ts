// src/app/api/mcp/route.ts
// Official Model Context Protocol (MCP) HTTP Endpoint for PromptFM on Vercel
// Supports both Public listener tools and Authorized Admin tools.
// Authenticate for admin tools via:
//   Header: Authorization: Bearer <ADMIN_API_KEY>
//   or Header: x-admin-key: <ADMIN_API_KEY>
//   or Query Param: ?key=<ADMIN_API_KEY>

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { broadcastToCommunity } from '@/lib/chat/bridge';
import { createBroadcastDrop } from '@/lib/dj/engine';
import { fetchLiveWeatherSummary, getNowPlaying, getUpNext } from '@/lib/dj/rotation';
import { getStationQueue, formatQueueForDiscord, formatQueueForTelegram } from '@/lib/dj/queue';
import { getAllDJs, getActiveDJ, getDJById, getAdsConfig, getActiveAdSpot } from '@/lib/dj/roster';
import { rejectScheduledRequest, synthesizeScheduledRequest } from '@/lib/dj/batches';
import {
  submitContentReport,
  getRecentReports,
  resolveContentReport,
  auditContentReports,
} from '@/lib/safety/reports';
import { autoGenerateChannelGuardrails } from '@/lib/safety/channel-guardrails';
import {
  getAllChannels,
  setChannelActiveOverride,
  isChannelActive,
} from '@/lib/radio/channels';
import { findTracksByVibe, indexTrackEmbedding } from '@/lib/dj/rag';
import { queueSong, getSongQueueStatus } from '@/lib/song/pathway';
import { getRequestLifecycle, formatRequestLifecycleMessage } from '@/lib/song/lifecycle';
import { postTweetToX } from '@/lib/social/x-client';
import { editTrackMetadata, deleteTrack } from '@/lib/dj/track-management';
import {
  startStream,
  stopStream,
  getStreamStatus,
  type StreamPlatform,
} from '@/lib/streaming/rtmp-controller';
import { getConfiguredStreamUrl } from '@/lib/audio/stream-config';
import { getInfraBudgetPolicy } from '@/lib/infra/budget-gate';
import type { ReportReason, ReportTargetType } from '@/types/database';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// ── Public MCP Tools ─────────────────────────────────────────────────────────

const PUBLIC_MCP_TOOLS = [
  {
    name: 'promptfm_get_top_tracks',
    description:
      'Fetches the weekly top community-voted AI music tracks on PromptFM with rank, title, artist, upvote count, tool used (Suno, Udio, etc.), and audio URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of tracks to fetch (default: 10, max: 20)',
        },
      },
    },
  },
  {
    name: 'promptfm_upvote_track',
    description: 'Casts an upvote for an AI music track on the PromptFM leaderboard by track ID.',
    inputSchema: {
      type: 'object',
      properties: {
        track_id: {
          type: 'string',
          description: 'The UUID of the track to upvote',
        },
      },
      required: ['track_id'],
    },
  },
  {
    name: 'promptfm_queue_song_request',
    description:
      'Queues an approved song for live radio airplay based on a descriptive prompt or vibe (e.g. "energetic cyberpunk synth" or "lofi chillout").',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The musical vibe, genre, or keyword to match against community tracks.',
        },
        requested_by: {
          type: 'string',
          description: 'Name or handle of the user making the request (default: "AI Assistant Listener")',
        },
        channel: {
          type: 'string',
          description: 'Target broadcast channel slug (e.g. "main", "cyberpunk", "chillout", "kids", "afterdark")',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'promptfm_search_tracks_by_vibe',
    description:
      'Performs a pgvector semantic RAG similarity search across the PromptFM music catalog based on natural language vibe prompts (e.g. "dark heavy metal about lost love", "chill morning lo-fi study", "high energy cyberpunk synth"). Returns top matching tracks with similarity scores.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The natural language vibe, genre, emotion, or thematic description to match.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tracks to return (default: 5, max: 15)',
        },
        channel: {
          type: 'string',
          description: 'Target broadcast channel slug (e.g. "main", "cyberpunk", "chillout", "kids", "afterdark")',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'promptfm_get_schedule',
    description: 'Retrieves the active 24/7 radio programming schedule, theme blocks, sponsor ad rotations, and automated AI news times.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'promptfm_get_djs',
    description: 'Lists all available AI radio DJs, their bios, voice profiles, time shifts, and shows who is currently live on air.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'promptfm_get_now_playing',
    description:
      'Retrieves real-time details of the audio item currently playing on the live radio stream (title, artist, model, upvotes, stream URL, active AI DJ on air, and elapsed playback seconds).',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel slug (default: "main")',
        },
      },
    },
  },
  {
    name: 'promptfm_get_up_next',
    description: 'Retrieves the list of upcoming tracks and scheduled items in the live radio queue.',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Channel slug (default: "main")',
        },
        limit: {
          type: 'number',
          description: 'Number of upcoming items to return (default: 5)',
        },
      },
    },
  },
  {
    name: 'promptfm_get_request_status',
    description:
      'Tracks the live lifecycle status, queue position, ETA, and attribution for a listener song request on PromptFM (accepted, in queue, airing soon, on air now, played, or rejected).',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Request ID (UUID), song title, or search prompt to track.',
        },
        channel: {
          type: 'string',
          description: 'Broadcast channel slug (default: "main")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'promptfm_report_content',
    description:
      'Files a formal safety, copyright (DMCA), broadcast ethics, or 18+ explicit violation report against an audio track, live stream broadcast, or community request on PromptFM.',
    inputSchema: {
      type: 'object',
      properties: {
        target_type: {
          type: 'string',
          enum: ['track', 'broadcast', 'request', 'user'],
          description: 'Type of content being reported (default: "track")',
        },
        target_id: {
          type: 'string',
          description: 'The track ID, title, or request identifier being reported',
        },
        reason: {
          type: 'string',
          enum: [
            'copyright_dmca',
            'hate_harassment',
            'religious_ethical',
            'unlabeled_18_plus',
            'spam_abuse',
            'other',
          ],
          description: 'Category of safety, copyright, or ethics violation',
        },
        details: {
          type: 'string',
          description: 'Optional detailed explanation or evidence',
        },
        reporter_id: {
          type: 'string',
          description: 'Identifier or handle of the agent or user filing the report (default: "mcp-agent")',
        },
      },
      required: ['target_id', 'reason'],
    },
  },
];

// ── Admin-Only MCP Tools ─────────────────────────────────────────────────────

const ADMIN_MCP_TOOLS = [
  {
    name: 'promptfm_admin_audit_reports',
    description:
      'Audits community content reports to identify unattributed status changes, potential tampering from unauthenticated windows, or dismissed DMCA/harassment reports.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max number of reports to audit (default: 100)' },
      },
    },
  },
  {
    name: 'promptfm_admin_list_reports',
    description: 'Lists all filed safety, copyright, and ethics reports currently awaiting moderation action.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max number of reports to return (default: 20)' },
      },
    },
  },
  {
    name: 'promptfm_admin_list_pending',
    description: 'Lists all community-submitted AI tracks currently waiting for admin moderation.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'promptfm_admin_moderate_track',
    description: 'Approves or rejects a pending community track by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        track_id: { type: 'string', description: 'The UUID of the track' },
        action: {
          type: 'string',
          enum: ['approved', 'rejected'],
          description: 'Whether to approve or reject the track for live airplay',
        },
      },
      required: ['track_id', 'action'],
    },
  },
  {
    name: 'promptfm_admin_broadcast',
    description: 'Pushes a live announcement to connected community Discord & Telegram channels, and optionally X (Twitter).',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message to broadcast' },
        post_to_x: {
          type: 'boolean',
          description: 'Whether to post this broadcast to X (Twitter) @promptfm_live',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'promptfm_admin_post_tweet',
    description: 'Publishes a station announcement or now-playing update tweet directly to X (formerly Twitter) @promptfm_live.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Tweet text to publish (maximum 280 characters)' },
        url: { type: 'string', description: 'Optional URL link to include at the end of the tweet' },
      },
      required: ['text'],
    },
  },
  {
    name: 'promptfm_admin_voice_drop',
    description: 'Sends a custom prompt to Gemini to write and synthesize an AI DJ voice announcement, saving the MP3 to R2.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt or instruction for the AI radio host' },
        dj_id: {
          type: 'string',
          description: 'Optional DJ ID (e.g. "dj_neon", "dj_luna", "dj_cipher", "dj_pixel", "dj_vance")',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'promptfm_admin_update_schedule',
    description: 'Updates the station schedule.yaml configuration (programming blocks, weather regions, news cron).',
    inputSchema: {
      type: 'object',
      properties: {
        schedule_yaml: { type: 'string', description: 'The complete updated YAML string' },
      },
      required: ['schedule_yaml'],
    },
  },
  {
    name: 'promptfm_admin_inject_interstitial',
    description: 'Force-injects a live audio drop (news, weather, announcement, or custom prompt) to play NEXT on air.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['news', 'weather', 'announcement', 'custom_prompt'],
          description: 'Type of interstitial drop',
        },
        prompt: { type: 'string', description: 'Prompt or announcement message' },
        city: { type: 'string', description: 'Optional target city for weather (e.g. "Tokyo", "London", "San Francisco")' },
        dj_id: { type: 'string', description: 'Optional DJ to deliver the drop' },
      },
      required: ['type'],
    },
  },
  {
    name: 'promptfm_admin_inject_ad',
    description: 'Injects a sponsor/ad spot into the live radio stream to play NEXT on air. Can play an existing sponsor ID or perform a live AI read.',
    inputSchema: {
      type: 'object',
      properties: {
        ad_id: { type: 'string', description: 'Optional ID of an ad spot from schedule.yaml (e.g. "suno_promo", "patreon_community")' },
        sponsor: { type: 'string', description: 'Name of the sponsor' },
        copy: { type: 'string', description: 'Sponsor copy for the AI DJ to read on air' },
        dj_id: { type: 'string', description: 'Optional DJ ID to deliver the sponsor read' },
      },
    },
  },
  {
    name: 'promptfm_admin_reject_request',
    description:
      'Removes or rejects a scheduled listener request (song, dedication, weather, zodiac) from an upcoming broadcast batch, specifies an ethical/parental/broadcast reason, and immediately notifies the listener on Discord or Telegram.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The UUID of the request to remove' },
        reason: {
          type: 'string',
          description: 'Broadcast or ethical reason for removal (e.g. "Religious mockery", "18+ explicit adult content")',
        },
      },
      required: ['request_id', 'reason'],
    },
  },
  {
    name: 'promptfm_admin_resolve_report',
    description:
      'Resolves a safety, copyright, or ethics content report by taking action (e.g. removing offending item from rotation) or dismissing as false report.',
    inputSchema: {
      type: 'object',
      properties: {
        report_id: { type: 'string', description: 'The UUID/ID of the report to resolve' },
        action: {
          type: 'string',
          enum: ['actioned', 'dismissed'],
          description: 'Action to take: "actioned" (quarantine/remove content) or "dismissed" (cleared)',
        },
        notes: {
          type: 'string',
          description: 'Optional admin notes explaining the moderation decision',
        },
        actor: {
          type: 'string',
          description: 'Admin or operator identifier taking moderation action (default: "mcp_admin")',
        },
      },
      required: ['report_id', 'action'],
    },
  },
  {
    name: 'promptfm_admin_remove_from_queue',
    description: 'Removes an item from the live "Up Next" airplay queue by its queue ID.',
    inputSchema: {
      type: 'object',
      properties: {
        queue_id: { type: 'string', description: 'The UUID of the queued airplay item to remove' },
      },
      required: ['queue_id'],
    },
  },
  {
    name: 'promptfm_admin_list_requests',
    description: 'Lists upcoming community requests (dedications, songs, weather, zodiac) organized by batch.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'scheduled', 'all'],
          description: 'Filter by request status (default: "all")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of requests to retrieve (default: 20)',
        },
      },
    },
  },
  {
    name: 'promptfm_admin_air_request',
    description:
      'Forces immediate AI DJ voice synthesis and airplay for a scheduled listener request or dedication.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The UUID of the request to air immediately' },
      },
      required: ['request_id'],
    },
  },
  {
    name: 'promptfm_admin_create_channel',
    description:
      'Creates a new radio broadcast channel with automated content guardrails, statutory 18+ age gating disclaimers, DJ assignment, and airplay policies.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Unique URL slug for the channel (e.g. "underground", "synthwave")' },
        name: { type: 'string', description: 'Display name for the channel' },
        description: { type: 'string', description: 'Channel description and format' },
        dj_id: { type: 'string', description: 'Optional assigned AI DJ ID (e.g. "dj_cipher", "dj_neon")' },
        is_18_plus: { type: 'boolean', description: 'Whether the channel allows 18+ explicit content 24/7' },
        is_family_safe: { type: 'boolean', description: 'Whether the channel is strictly family friendly / child safe' },
        min_age: { type: 'number', description: 'Explicit minimum age requirement (default: 18 for 18+, 0 for standard)' },
      },
      required: ['slug', 'name'],
    },
  },
  {
    name: 'promptfm_admin_list_channels',
    description:
      'Lists all active radio channels with their guardrail policies, legal age gate requirements, and assigned AI DJs.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'promptfm_admin_set_channel_status',
    description:
      'Enables or disables a radio broadcast channel for airplay, public discovery, and station rotation.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug of the channel to update (e.g. "cyberpunk", "kids")' },
        is_active: { type: 'boolean', description: 'true to enable channel, false to disable / take offline' },
      },
      required: ['slug', 'is_active'],
    },
  },
  {
    name: 'promptfm_admin_toggle_channel',
    description:
      'Toggles a radio broadcast channel between active/enabled and disabled/offline.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug of the channel to toggle' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'promptfm_admin_start_stream',
    description:
      'Starts an RTMP video/audio live stream broadcast of PromptFM to YouTube Live or TikTok Live.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['youtube', 'tiktok'],
          description: 'Destination live streaming platform',
        },
        stream_key: {
          type: 'string',
          description: 'The stream key from YouTube Studio or TikTok Live Producer',
        },
        rtmp_url: {
          type: 'string',
          description:
            'Optional RTMP server ingest URL (required for TikTok session URLs; defaults to YouTube if omitted)',
        },
      },
      required: ['platform', 'stream_key'],
    },
  },
  {
    name: 'promptfm_admin_stop_stream',
    description: 'Stops an active RTMP live stream broadcast on YouTube or TikTok.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['youtube', 'tiktok'],
          description: 'Platform to stop streaming to',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'promptfm_admin_get_stream_status',
    description:
      'Retrieves the real-time status of PromptFM RTMP live streams on YouTube and TikTok.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'promptfm_admin_get_infra_budget',
    description:
      'Retrieves the PromptFM $0 infrastructure policy constraints, Vercel Fluid Active CPU budget metrics, and CI trimming thresholds.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'promptfm_admin_edit_track',
    description:
      'Updates track metadata (title, artist_name, category, description, lyrics, is_explicit, tool_used) for an existing track in the PromptFM catalog by UUID or exact title match.',
    inputSchema: {
      type: 'object',
      properties: {
        track_id: { type: 'string', description: 'The UUID or title of the track to edit' },
        title: { type: 'string', description: 'Updated title of the track' },
        artist_name: { type: 'string', description: 'Updated artist or producer name' },
        category: { type: 'string', description: 'Updated musical genre or theme category' },
        description: { type: 'string', description: 'Updated description of vibe or generation prompt' },
        lyrics: { type: 'string', description: 'Updated track lyrics transcript' },
        is_explicit: { type: 'boolean', description: 'Whether the track contains explicit lyrics' },
        tool_used: { type: 'string', description: 'AI music generator tool used (Suno, Udio, etc.)' },
        audit_actor: { type: 'string', description: 'Station operator or agent making the update' },
      },
      required: ['track_id'],
    },
  },
  {
    name: 'promptfm_admin_delete_track',
    description:
      'Deletes or archives a track from the PromptFM library by UUID or title match. Supports permanent hard delete or soft-delete archival.',
    inputSchema: {
      type: 'object',
      properties: {
        track_id: { type: 'string', description: 'The UUID or title of the track to delete' },
        soft_delete: {
          type: 'boolean',
          description: 'If true, sets status to "rejected" (soft delete archive); if false, permanently deletes track record',
        },
        audit_actor: { type: 'string', description: 'Station operator or agent executing the deletion' },
      },
      required: ['track_id'],
    },
  },
];

function isAuthorizedAdmin(req: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return true; // Default allow in local dev if not configured

  const authHeader = req.headers.get('authorization');
  const xAdminKey = req.headers.get('x-admin-key');
  const urlKey = req.nextUrl.searchParams.get('key');

  return (
    authHeader === `Bearer ${adminKey}` ||
    xAdminKey === adminKey ||
    urlKey === adminKey
  );
}

// ── JSON-RPC 2.0 Handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400, headers: corsHeaders() }
    );
  }

  const { jsonrpc, id, method, params } = body as {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, unknown>;
  };

  if (jsonrpc !== '2.0') {
    return NextResponse.json(
      { jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid Request: jsonrpc must be 2.0' } },
      { status: 400, headers: corsHeaders() }
    );
  }

  const isAdmin = isAuthorizedAdmin(req);
  const availableTools = isAdmin ? [...PUBLIC_MCP_TOOLS, ...ADMIN_MCP_TOOLS] : PUBLIC_MCP_TOOLS;

  // 1. Initialize Handshake
  if (method === 'initialize') {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'promptfm-mcp',
            version: '1.0.0',
            description: isAdmin
              ? 'PromptFM 24/7 AI Radio MCP Server [ADMIN PRIVILEGES UNLOCKED]'
              : 'PromptFM 24/7 AI Radio MCP Server [Public Listener Mode]',
          },
        },
      },
      { headers: corsHeaders() }
    );
  }

  // 2. Tools List
  if (method === 'tools/list') {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id,
        result: {
          tools: availableTools,
        },
      },
      { headers: corsHeaders() }
    );
  }

  // 3. Tool Execution
  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = (params || {}) as {
      name?: string;
      arguments?: Record<string, unknown>;
    };

    try {
      const toolResult = await handleToolCall(name, toolArgs || {}, isAdmin);
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }],
          },
        },
        { headers: corsHeaders() }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [{ type: 'text', text: `Tool error: ${message}` }],
          },
        },
        { headers: corsHeaders() }
      );
    }
  }

  // 4. Ping
  if (method === 'ping') {
    return NextResponse.json({ jsonrpc: '2.0', id, result: {} }, { headers: corsHeaders() });
  }

  return NextResponse.json(
    { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } },
    { status: 404, headers: corsHeaders() }
  );
}

// ── Tool Execution Implementation ────────────────────────────────────────────

async function handleToolCall(name?: string, args: Record<string, unknown> = {}, isAdmin = false) {
  const supabase = createAdminClient();

  // Public tools
  switch (name) {
    case 'promptfm_get_top_tracks': {
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 20) : 10;
      const { data, error } = await supabase
        .from('tracks')
        .select('id, title, artist_name, tool_used, upvotes_count, audio_url')
        .eq('status', 'approved')
        .order('upvotes_count', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return {
        count: data?.length || 0,
        leaderboard: data?.map((t, idx) => ({ rank: idx + 1, ...t })),
      };
    }

    case 'promptfm_upvote_track': {
      const trackId = args.track_id as string;
      if (!trackId) throw new Error('Missing track_id');

      const { data: track, error: fetchErr } = await supabase
        .from('tracks')
        .select('id, title, upvotes_count')
        .eq('id', trackId)
        .single();

      if (fetchErr || !track) throw new Error('Track not found');

      const { data: updated, error: updateErr } = await supabase
        .from('tracks')
        .update({ upvotes_count: (track.upvotes_count || 0) + 1 })
        .eq('id', trackId)
        .select()
        .single();

      if (updateErr) throw new Error(updateErr.message);
      return {
        success: true,
        message: `Upvoted "${updated.title}"!`,
        new_upvotes_count: updated.upvotes_count,
      };
    }

    case 'promptfm_queue_song_request': {
      const prompt = args.prompt as string;
      const requester = (args.requested_by as string) || 'AI Agent';
      const channelSlug = (args.channel as string) || 'main';
      if (!prompt) throw new Error('Missing prompt');

      const result = await queueSong({
        source: 'mcp',
        requestedBy: requester,
        prompt,
        channelSlug,
      });

      if (result.status === 'rejected') {
        throw new Error(result.confirmationMessage);
      }
      if (result.status === 'no_match') {
        throw new Error(result.confirmationMessage);
      }

      return {
        success: result.status === 'queued' || result.status === 'already_queued',
        status: result.status,
        message: result.confirmationMessage,
        track: result.track,
        queue_position: result.position,
        estimated_air_time: result.eta.displayTime,
        estimated_wait_minutes: result.eta.waitMinutes,
        similarity_score: result.track?.similarity,
        match_engine: result.track?.matchMethod,
      };
    }

    case 'promptfm_search_tracks_by_vibe': {
      const prompt = args.prompt as string;
      const limit = typeof args.limit === 'number' ? Math.min(Math.max(args.limit, 1), 15) : 5;
      const channelSlug = (args.channel as string) || 'main';
      if (!prompt) throw new Error('Missing prompt');

      const matches = await findTracksByVibe(prompt, {
        channelSlug,
        limit,
        matchThreshold: 0.15,
      });

      return {
        success: true,
        prompt,
        channel: channelSlug,
        count: matches.length,
        tracks: matches.map((m) => ({
          id: m.id,
          title: m.title,
          artist: m.artist_name,
          category: m.category,
          vibe_description: m.description,
          similarity_score: m.similarity,
          match_engine: m.matchMethod,
          audio_url: m.audio_url,
          upvotes: m.upvotes_count,
        })),
      };
    }

    case 'promptfm_get_schedule': {
      const schedulePath = join(process.cwd(), 'config', 'schedule.yaml');
      const activeDJ = getActiveDJ();
      const adsConfig = getAdsConfig();
      if (existsSync(schedulePath)) {
        const raw = readFileSync(schedulePath, 'utf8');
        return {
          active_schedule_yaml: raw,
          current_dj_on_air: {
            id: activeDJ.id,
            name: activeDJ.name,
            title: activeDJ.title,
            voice: activeDJ.voice.name,
          },
          ads_summary: {
            enabled: adsConfig.enabled,
            frequency_tracks: adsConfig.frequencyTracks,
            active_spots: adsConfig.spots.filter((s) => s.active).map((s) => s.sponsor),
          },
        };
      }
      return { message: '24/7 continuous stream with hourly AI News' };
    }

    case 'promptfm_get_djs': {
      const allDJs = getAllDJs();
      const activeDJ = getActiveDJ();
      return {
        active_dj_now: {
          id: activeDJ.id,
          name: activeDJ.name,
          title: activeDJ.title,
        },
        djs: allDJs.map((dj) => ({
          id: dj.id,
          name: dj.name,
          title: dj.title,
          bio: dj.bio,
          voice: dj.voice.name,
          gender: dj.voice.ssmlGender,
          shifts: dj.shifts,
          is_on_air_now: dj.id === activeDJ.id,
        })),
      };
    }

    case 'promptfm_get_now_playing': {
      const channel = (args.channel as string) || 'main';
      const np = await getNowPlaying(channel);
      return {
        now_playing: {
          id: np.item.id,
          type: np.item.type,
          title: np.item.title,
          artist: np.item.artist,
          tool_used: np.item.tool_used || 'AI',
          upvotes_count: np.item.upvotes_count ?? 0,
          audio_url: np.item.audio_url,
          rank: np.rank ?? null,
          total_approved_tracks: np.totalApprovedTracks ?? null,
          stream_listen_url: process.env.NEXT_PUBLIC_SITE_URL || 'https://promptfm.live',
          audio_stream_url: getConfiguredStreamUrl(),
          active_dj: {
            id: np.activeDJ.id,
            name: np.activeDJ.name,
            title: np.activeDJ.title,
          },
          elapsed_seconds: np.elapsedSeconds,
          started_at: np.startedAt,
        },
      };
    }

    case 'promptfm_get_up_next': {
      const channel = (args.channel as string) || 'main';
      const limit = typeof args.limit === 'number' ? Math.min(args.limit, 10) : 5;
      const stationQueue = await getStationQueue({ channelSlug: channel, upcomingLimit: limit, scheduledLimit: limit });
      return {
        channel,
        upcoming_count: stationQueue.upcoming.length,
        scheduled_count: stationQueue.scheduledRequests.length,
        up_next: stationQueue.upcoming.map((item, idx) => ({
          position: idx + 1,
          id: item.id,
          title: item.title,
          artist: item.artist,
          tool_used: item.tool_used,
          upvotes_count: item.upvotes_count ?? 0,
        })),
        scheduled_requests: stationQueue.scheduledRequests.map((req) => ({
          id: req.id,
          type: req.type,
          content: req.content,
          target: req.target,
          platform: req.platform,
          platform_user_name: req.platform_user_name,
          batch_id: req.batch_id,
          status: req.status,
          estimated_air_time: req.estimated_air_time,
        })),
        formatted_discord: formatQueueForDiscord(stationQueue),
        formatted_telegram: formatQueueForTelegram(stationQueue),
      };
    }

    case 'promptfm_get_request_status': {
      const query = (args.query as string) || (args.request_id as string) || '';
      const channel = (args.channel as string) || 'main';
      const result = await getRequestLifecycle(query, channel);
      if (!result) {
        return {
          found: false,
          query,
          message: `No active or queued song request matching "${query}" was found on PromptFM.`,
        };
      }
      return {
        found: true,
        request_id: result.requestId,
        status: result.status,
        display_status: result.displayStatus,
        badge_label: result.badgeLabel,
        platform: result.platform,
        platform_user_name: result.platformUserName,
        type: result.type,
        prompt: result.prompt,
        batch_id: result.batchId,
        position: result.position,
        items_ahead: result.itemsAhead,
        eta: result.eta,
        track: result.track,
        channel: result.channel || channel,
        message: formatRequestLifecycleMessage(result, 'plain'),
      };
    }

    case 'promptfm_report_content': {
      const target_type = (args.target_type as ReportTargetType) || 'track';
      const target_id = args.target_id as string;
      const reason = args.reason as ReportReason;
      const details = args.details as string | undefined;
      const reporter_id = (args.reporter_id as string) || 'mcp-agent';

      if (!target_id || !reason) {
        throw new Error('target_id and reason are required to file a report.');
      }

      const rep = await submitContentReport({
        target_type,
        target_id: String(target_id),
        reason,
        details: details ? String(details) : undefined,
        reporter_platform: 'mcp',
        reporter_id,
      });

      return {
        success: true,
        ticket_id: rep.reportId,
        message: rep.message,
        status: 'pending_moderation',
      };
    }
  }

  // Admin-only tools
  if (!isAdmin) {
    throw new Error(`Unauthorized: Tool "${name}" requires admin authorization.`);
  }

  switch (name) {
    case 'promptfm_admin_audit_reports': {
      const limit = typeof args.limit === 'number' ? args.limit : 100;
      const audit = await auditContentReports({ limit });
      return {
        success: true,
        audit,
      };
    }

    case 'promptfm_admin_list_reports': {
      const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 20;
      const reports = await getRecentReports(limit);
      return {
        count: reports.length,
        reports,
      };
    }

    case 'promptfm_admin_list_pending': {
      const { data: pending, error } = await supabase
        .from('tracks')
        .select('id, title, artist_name, tool_used, audio_url, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return { pending_tracks: pending || [] };
    }

    case 'promptfm_admin_moderate_track': {
      const trackId = args.track_id as string;
      const action = args.action as 'approved' | 'rejected';
      if (!trackId || !action) throw new Error('Missing track_id or action');

      const { data: updated, error } = await supabase
        .from('tracks')
        .update({ status: action })
        .eq('id', trackId)
        .select()
        .single();

      if (error) throw new Error(error.message);

      if (action === 'approved') {
        // Asynchronously embed and index track in pgvector
        indexTrackEmbedding(updated.id, {
          title: updated.title,
          artist_name: updated.artist_name,
          category: updated.category,
          description: updated.description,
          lyrics: updated.lyrics,
        }).catch((err) => console.warn('[RAG Index Error]', err));
      }

      return {
        success: true,
        message: `Track "${updated.title}" marked as ${action.toUpperCase()}`,
        track: updated,
      };
    }

    case 'promptfm_admin_broadcast': {
      const message = args.message as string;
      const postToX = Boolean(args.post_to_x);
      if (!message) throw new Error('Missing message');
      await broadcastToCommunity(
        {
          title: 'Station Announcement (via Admin MCP)',
          message,
          author: 'AI Agent Admin',
        },
        { postToX }
      );
      return {
        success: true,
        message: `Dispatched broadcast to community channels${postToX ? ' and X (Twitter)' : ''}.`,
      };
    }

    case 'promptfm_admin_post_tweet': {
      const text = args.text as string;
      const url = args.url as string | undefined;
      if (!text) throw new Error('Missing tweet text');
      const result = await postTweetToX(text, { url });
      return result;
    }

    case 'promptfm_admin_voice_drop': {
      const prompt = args.prompt as string;
      if (!prompt) throw new Error('Missing prompt');
      const djId = args.dj_id as string | undefined;
      const dj = djId ? getDJById(djId) : getActiveDJ();
      const { script, audioUrl } = await createBroadcastDrop({
        type: 'custom_prompt',
        topicOrText: prompt,
        dj,
      });
      return {
        success: true,
        dj: { id: dj.id, name: dj.name },
        script_generated: script,
        audio_url: audioUrl,
      };
    }

    case 'promptfm_admin_update_schedule': {
      const scheduleYaml = args.schedule_yaml as string;
      if (!scheduleYaml) throw new Error('Missing schedule_yaml');
      const p = join(process.cwd(), 'config', 'schedule.yaml');
      writeFileSync(p, scheduleYaml, 'utf8');
      return { success: true, message: 'Updated config/schedule.yaml successfully' };
    }

    case 'promptfm_admin_inject_interstitial': {
      const type = (args.type as 'news' | 'weather' | 'announcement' | 'custom_prompt') || 'custom_prompt';
      const djId = args.dj_id as string | undefined;
      const dj = djId ? getDJById(djId) : getActiveDJ();
      let promptText = (args.prompt as string) || '';

      if (type === 'weather') {
        const city = args.city as string | undefined;
        const weather = await fetchLiveWeatherSummary(city);
        promptText = `Give a 15-second radio station weather check for ${weather.city}: "${weather.text}". Add a fun radio station vibe.`;
      }

      const { script, audioUrl } = await createBroadcastDrop({
        type: type === 'weather' ? 'custom_prompt' : type,
        topicOrText: promptText,
        dj,
      });

      // Insert as high-priority track in Supabase
      const { data: track, error } = await supabase
        .from('tracks')
        .insert({
          title: `Live Drop: ${type.toUpperCase()}`,
          artist_name: `${dj.name} (Admin Injected)`,
          tool_used: 'Other',
          audio_url: audioUrl,
          status: 'approved',
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Prioritize to front of queue
      const { data: channel } = await supabase.from('channels').select('id').eq('slug', 'main').single();
      if (channel) {
        await supabase.from('channel_queue').insert({
          channel_id: channel.id,
          track_id: track.id,
          requested_by: 'Admin MCP',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        });
      }

      return {
        success: true,
        dj: { id: dj.id, name: dj.name },
        message: `Injected [${type.toUpperCase()}] with ${dj.name} to play NEXT on air!`,
        script_spoken: script,
        audio_url: audioUrl,
      };
    }

    case 'promptfm_admin_inject_ad': {
      const adsConfig = getAdsConfig();
      const adId = args.ad_id as string | undefined;
      const customSponsor = args.sponsor as string | undefined;
      const customCopy = args.copy as string | undefined;
      const djId = args.dj_id as string | undefined;
      const dj = djId ? getDJById(djId) : getActiveDJ();

      let targetAd = adId ? adsConfig.spots.find((s) => s.id === adId) : null;
      let audioUrl = '';
      let scriptSpoken = '';
      const sponsorName = customSponsor || targetAd?.sponsor || 'PromptFM Sponsor';

      if (targetAd && targetAd.type === 'pre_recorded' && targetAd.audioUrl) {
        audioUrl = targetAd.audioUrl;
        scriptSpoken = '[Pre-recorded Audio Commercial]';
      } else {
        const copyToRead = customCopy || targetAd?.copy || `Check out ${sponsorName} for the latest in generative AI tools.`;
        const drop = await createBroadcastDrop({
          type: 'ad',
          topicOrText: copyToRead,
          dj,
        });
        audioUrl = drop.audioUrl;
        scriptSpoken = drop.script;
      }

      // Insert as high-priority track in Supabase
      const { data: track, error } = await supabase
        .from('tracks')
        .insert({
          title: `[Sponsor Ad] ${targetAd?.title || sponsorName}`,
          artist_name: `${dj.name} for ${sponsorName}`,
          tool_used: 'Other',
          audio_url: audioUrl,
          status: 'approved',
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      const { data: channel } = await supabase.from('channels').select('id').eq('slug', 'main').single();
      if (channel) {
        await supabase.from('channel_queue').insert({
          channel_id: channel.id,
          track_id: track.id,
          requested_by: 'Admin MCP (Ad Injection)',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        });
      }

      return {
        success: true,
        message: `Injected sponsor ad for "${sponsorName}" to play NEXT on air!`,
        sponsor: sponsorName,
        dj: { id: dj.id, name: dj.name },
        script_spoken: scriptSpoken,
        audio_url: audioUrl,
      };
    }

    case 'promptfm_admin_reject_request': {
      const requestId = args.request_id as string;
      const reason = (args.reason as string) || 'Declined by broadcast standards & practices';
      if (!requestId) throw new Error('Missing request_id');

      const result = await rejectScheduledRequest(requestId, reason, 'Admin MCP');
      return {
        success: true,
        message: result.message,
      };
    }

    case 'promptfm_admin_resolve_report': {
      const reportId = args.report_id as string;
      const action = args.action as 'actioned' | 'dismissed';
      const notes = args.notes as string | undefined;
      const actor = (args.actor as string | undefined) || 'mcp_admin';

      if (!reportId || !action) throw new Error('Missing report_id or action');

      const result = await resolveContentReport(reportId, action, notes, actor);
      return {
        success: true,
        report_id: result.reportId,
        action: result.status,
        notes: result.notes,
        resolved_by: result.resolved_by,
        resolved_at: result.resolved_at,
        message: `Report ${reportId} marked as ${action} by ${result.resolved_by}.`,
      };
    }

    case 'promptfm_admin_remove_from_queue': {
      const queueId = args.queue_id as string;
      if (!queueId) throw new Error('Missing queue_id');

      try {
        const supabase = createAdminClient();
        await supabase.from('channel_queue').delete().eq('id', queueId);
      } catch (err) {
        console.warn('[MCP Admin] Queue remove DB fallback note:', err);
      }

      return {
        success: true,
        queue_id: queueId,
        message: `Removed queue item ${queueId}.`,
      };
    }

    case 'promptfm_admin_list_requests': {
      const limit = typeof args.limit === 'number' ? args.limit : 20;
      const status = (args.status as string) || 'all';

      let requests: unknown[] = [];
      try {
        const supabase = createAdminClient();
        let query = supabase.from('community_requests').select('*');
        if (status !== 'all') {
          query = query.eq('status', status);
        } else {
          query = query.in('status', ['pending', 'scheduled']);
        }
        const { data } = await query.order('created_at', { ascending: true }).limit(limit);
        if (data) requests = data;
      } catch (err) {
        console.warn('[MCP Admin] List requests DB fallback note:', err);
      }

      return {
        success: true,
        requests,
        count: requests.length,
      };
    }

    case 'promptfm_admin_air_request': {
      const requestId = args.request_id as string;
      if (!requestId) throw new Error('Missing request_id');

      const result = await synthesizeScheduledRequest(requestId);
      return {
        success: true,
        request_id: requestId,
        script: result.script,
        audio_url: result.audioUrl,
        message: `Successfully synthesized and aired request ${requestId}.`,
      };
    }

    case 'promptfm_admin_create_channel': {
      const slug = (args.slug as string)?.trim().toLowerCase();
      const name = (args.name as string)?.trim();
      const description = (args.description as string)?.trim() || '';
      const djId = (args.dj_id as string)?.trim() || 'dj_neon';
      const is18Plus = Boolean(args.is_18_plus);
      const minAge = typeof args.min_age === 'number' ? args.min_age : undefined;
      const customDisclaimer = (args.disclaimer as string)?.trim();

      if (!slug || !name) {
        throw new Error('Channel slug and name are required.');
      }

      const guardrails = autoGenerateChannelGuardrails({
        is18Plus,
        minAge,
        allowExplicit247: is18Plus,
        customDisclaimer,
      });

      const isActive = typeof args.is_active === 'boolean' ? args.is_active : true;
      setChannelActiveOverride(slug, isActive);

      const newChannel = {
        slug,
        name,
        short_name: name,
        description,
        vibe: description || (guardrails.allow_explicit_24_7 ? '18+ Explicit Underground' : 'AI Generated Radio'),
        badge: guardrails.allow_explicit_24_7 ? '🔞 18+ Explicit' : '📻 Live Channel',
        accent_color: guardrails.allow_explicit_24_7 ? 'rose' : 'emerald',
        icon: guardrails.allow_explicit_24_7 ? 'Flame' : 'Radio',
        dj_id: djId,
        is_family_safe: guardrails.is_family_safe,
        min_age: guardrails.min_age,
        requires_age_gate: guardrails.requires_age_gate,
        allow_explicit_24_7: guardrails.allow_explicit_24_7,
        age_gate_disclaimer: guardrails.age_gate_disclaimer,
        stream_url: `https://stream.promptfm.live/live?channel=${slug}`,
        is_active: isActive,
      };

      const dbPayload = {
        slug,
        name,
        description,
        is_family_safe: guardrails.is_family_safe,
        min_age: guardrails.min_age,
        requires_age_gate: guardrails.requires_age_gate,
        allow_explicit_24_7: guardrails.allow_explicit_24_7,
        age_gate_disclaimer: guardrails.age_gate_disclaimer,
        is_active: isActive,
      };

      try {
        const supabase = createAdminClient();
        const { error } = await supabase.from('channels').upsert(dbPayload, { onConflict: 'slug' });
        if (error) {
          await supabase.from('channels').upsert(
            { slug, name, description, is_active: isActive },
            { onConflict: 'slug' }
          );
        }
      } catch (err) {
        console.warn('[MCP Admin] Channel upsert DB fallback note:', err);
      }

      return {
        success: true,
        message: `Channel "${name}" (${slug}) created with automated guardrails.`,
        channel: newChannel,
      };
    }

    case 'promptfm_admin_list_channels': {
      const official = getAllChannels();
      let dbChannels: any[] = [];
      try {
        const supabase = createAdminClient();
        const { data } = await supabase.from('channels').select('*');
        if (data && data.length > 0) {
          dbChannels = data;
        }
      } catch (err) {
        console.warn('[MCP Admin] Channels list DB fallback note:', err);
      }

      const channelMap = new Map<string, any>();
      for (const ch of official) {
        channelMap.set(ch.slug, {
          slug: ch.slug,
          name: ch.name,
          short_name: ch.shortName,
          description: ch.description,
          vibe: ch.vibe,
          badge: ch.badge,
          accent_color: ch.accentColor,
          icon: ch.icon,
          dj_id: ch.djId,
          is_family_safe: ch.isFamilySafe,
          min_age: ch.minAge ?? 0,
          requires_age_gate: ch.requiresAgeGate ?? false,
          allow_explicit_24_7: ch.allowExplicitAllDay ?? false,
          age_gate_disclaimer: ch.ageGateDisclaimer ?? '',
          stream_url: ch.streamUrl,
          is_active: ch.isActive,
        });
      }
      for (const ch of dbChannels) {
        const existing = channelMap.get(ch.slug) || {};
        const isExplicitHint = Boolean(
          ch.allow_explicit_24_7 ||
          ch.requires_age_gate ||
          ch.name?.includes('18+') ||
          ch.description?.toLowerCase().includes('explicit') ||
          ch.description?.toLowerCase().includes('uncensored')
        );
        const guard = autoGenerateChannelGuardrails({ is18Plus: isExplicitHint });
        channelMap.set(ch.slug, {
          ...existing,
          ...ch,
          slug: ch.slug,
          name: ch.name || existing.name,
          short_name: ch.name || existing.name,
          description: ch.description || '',
          vibe: ch.description || (guard.allow_explicit_24_7 ? '18+ Explicit Underground' : 'AI Generated Radio'),
          badge: guard.allow_explicit_24_7 ? '🔞 18+ Explicit' : '📻 Live Channel',
          accent_color: guard.allow_explicit_24_7 ? 'rose' : 'emerald',
          icon: guard.allow_explicit_24_7 ? 'Flame' : 'Radio',
          dj_id: ch.dj_id || existing.dj_id || 'dj_neon',
          is_family_safe: ch.is_family_safe ?? existing.is_family_safe ?? guard.is_family_safe,
          min_age: ch.min_age ?? existing.min_age ?? guard.min_age,
          requires_age_gate: ch.requires_age_gate ?? existing.requires_age_gate ?? guard.requires_age_gate,
          allow_explicit_24_7: ch.allow_explicit_24_7 ?? existing.allow_explicit_24_7 ?? guard.allow_explicit_24_7,
          age_gate_disclaimer: ch.age_gate_disclaimer || existing.age_gate_disclaimer || guard.age_gate_disclaimer,
          stream_url: `https://stream.promptfm.live/live?channel=${ch.slug}`,
          is_active: ch.is_active !== undefined ? Boolean(ch.is_active) : (existing.is_active ?? true),
        });
      }

      const channels = Array.from(channelMap.values());
      return {
        success: true,
        count: channels.length,
        channels,
      };
    }

    case 'promptfm_admin_set_channel_status': {
      const slug = String(args.slug || '').toLowerCase().trim();
      if (!slug) {
        throw new Error('Channel slug is required.');
      }
      const isActive = Boolean(args.is_active ?? args.enabled);
      setChannelActiveOverride(slug, isActive);

      try {
        const supabase = createAdminClient();
        await supabase.from('channels').upsert({ slug, is_active: isActive }, { onConflict: 'slug' });
      } catch (err) {
        console.warn('[MCP Admin] Channel status update DB fallback note:', err);
      }

      return {
        success: true,
        slug,
        is_active: isActive,
        message: `Channel "${slug}" has been ${isActive ? 'enabled' : 'disabled'}.`,
      };
    }

    case 'promptfm_admin_toggle_channel': {
      const slug = String(args.slug || '').toLowerCase().trim();
      if (!slug) {
        throw new Error('Channel slug is required.');
      }
      const currentActive = isChannelActive(slug);
      const nextActive = !currentActive;
      setChannelActiveOverride(slug, nextActive);

      try {
        const supabase = createAdminClient();
        await supabase.from('channels').upsert({ slug, is_active: nextActive }, { onConflict: 'slug' });
      } catch (err) {
        console.warn('[MCP Admin] Channel toggle DB fallback note:', err);
      }

      return {
        success: true,
        slug,
        is_active: nextActive,
        message: `Channel "${slug}" toggled to ${nextActive ? 'enabled' : 'disabled'}.`,
      };
    }

    case 'promptfm_admin_start_stream': {
      const platform = args.platform as StreamPlatform;
      const streamKey = (args.stream_key as string)?.trim();
      const rtmpUrl = (args.rtmp_url as string)?.trim();

      if (!platform || (platform !== 'youtube' && platform !== 'tiktok')) {
        throw new Error('Valid platform ("youtube" | "tiktok") is required');
      }
      if (!streamKey) {
        throw new Error('stream_key is required');
      }

      const result = await startStream({ platform, streamKey, rtmpUrl });
      return result;
    }

    case 'promptfm_admin_stop_stream': {
      const platform = args.platform as StreamPlatform;
      if (!platform || (platform !== 'youtube' && platform !== 'tiktok')) {
        throw new Error('Valid platform ("youtube" | "tiktok") is required');
      }

      const result = await stopStream(platform);
      return result;
    }

    case 'promptfm_admin_get_stream_status': {
      const status = await getStreamStatus();
      return {
        success: true,
        ...status,
      };
    }

    case 'promptfm_admin_get_infra_budget': {
      const policy = getInfraBudgetPolicy();
      return {
        success: true,
        policy,
        budget_status: 'operational_zero_cost',
        note: 'PromptFM $0 infra path: Vercel previews gated, crawlers blocked on preview, CI trimmed.',
      };
    }

    case 'promptfm_admin_edit_track': {
      const trackId = args.track_id as string;
      if (!trackId) throw new Error('Missing track_id');
      const actor = (args.audit_actor as string) || (isAdmin ? 'Admin MCP' : 'Unknown');

      const result = await editTrackMetadata(
        trackId,
        {
          title: args.title as string | undefined,
          artist_name: args.artist_name as string | undefined,
          category: args.category as string | undefined,
          description: args.description as string | undefined,
          lyrics: args.lyrics as string | undefined,
          is_explicit: args.is_explicit !== undefined ? Boolean(args.is_explicit) : undefined,
          tool_used: args.tool_used as string | undefined,
        },
        actor
      );

      return result;
    }

    case 'promptfm_admin_delete_track': {
      const trackId = args.track_id as string;
      if (!trackId) throw new Error('Missing track_id');
      const softDelete = Boolean(args.soft_delete);
      const actor = (args.audit_actor as string) || (isAdmin ? 'Admin MCP' : 'Unknown');

      const result = await deleteTrack(trackId, { softDelete, actor });
      return result;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── GET Discovery Endpoint ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const isAdmin = isAuthorizedAdmin(req);
  const tools = isAdmin ? [...PUBLIC_MCP_TOOLS, ...ADMIN_MCP_TOOLS] : PUBLIC_MCP_TOOLS;

  return NextResponse.json(
    {
      name: 'promptfm-mcp',
      description: 'Model Context Protocol (MCP) Server for PromptFM Radio',
      version: '1.0.0',
      admin_unlocked: isAdmin,
      endpoint: '/api/mcp',
      supported_methods: ['initialize', 'tools/list', 'tools/call', 'ping'],
      tools: tools.map((t) => ({ name: t.name, description: t.description })),
    },
    { headers: corsHeaders() }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
  };
}
