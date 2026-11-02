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
import { getAllDJs, getActiveDJ, getDJById, getAdsConfig, getActiveAdSpot } from '@/lib/dj/roster';
import { rejectScheduledRequest } from '@/lib/dj/batches';
import { submitContentReport, getRecentReports } from '@/lib/safety/reports';
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
    description: 'Pushes a live announcement to connected community Discord & Telegram channels.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message to broadcast' },
      },
      required: ['message'],
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
      if (!prompt) throw new Error('Missing prompt');

      const { data: matches } = await supabase
        .from('tracks')
        .select('id, title, artist_name, tool_used, audio_url')
        .eq('status', 'approved')
        .ilike('title', `%${prompt}%`)
        .limit(1);

      let selected = matches?.[0];
      if (!selected) {
        const { data: top } = await supabase
          .from('tracks')
          .select('id, title, artist_name, tool_used, audio_url')
          .eq('status', 'approved')
          .order('upvotes_count', { ascending: false })
          .limit(1)
          .single();
        selected = top || undefined;
      }

      if (!selected) {
        throw new Error('No approved tracks currently available in library to queue.');
      }

      const { data: channel } = await supabase
        .from('channels')
        .select('id')
        .eq('slug', 'main')
        .single();

      if (channel) {
        await supabase.from('channel_queue').insert({
          channel_id: channel.id,
          track_id: selected.id,
          prompt_used: prompt,
          requested_by: requester,
        });
      }

      return {
        success: true,
        message: `Queued "${selected.title}" by ${selected.artist_name} for airplay!`,
        track: selected,
        prompt_used: prompt,
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
      const np = getNowPlaying(channel);
      return {
        now_playing: {
          id: np.item.id,
          type: np.item.type,
          title: np.item.title,
          artist: np.item.artist,
          tool_used: np.item.tool_used || 'AI',
          upvotes_count: np.item.upvotes_count ?? 0,
          audio_url: np.item.audio_url,
          stream_listen_url: 'https://promptfm.vercel.app',
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
      const upcoming = await getUpNext(channel, limit);
      return {
        channel,
        upcoming_count: upcoming.length,
        up_next: upcoming.map((item, idx) => ({
          position: idx + 1,
          id: item.id,
          title: item.title,
          artist: item.artist,
          tool_used: item.tool_used,
          upvotes_count: item.upvotes_count ?? 0,
        })),
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
      return {
        success: true,
        message: `Track "${updated.title}" marked as ${action.toUpperCase()}`,
        track: updated,
      };
    }

    case 'promptfm_admin_broadcast': {
      const message = args.message as string;
      if (!message) throw new Error('Missing message');
      await broadcastToCommunity({
        title: 'Station Announcement (via Admin MCP)',
        message,
        author: 'AI Agent Admin',
      });
      return { success: true, message: 'Dispatched broadcast to community channels.' };
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
