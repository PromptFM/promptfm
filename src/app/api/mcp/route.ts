// src/app/api/mcp/route.ts
// Official Model Context Protocol (MCP) HTTP Endpoint for PromptFM on Vercel
// Allows AI Agents (Claude Desktop, Cursor, ChatGPT, etc.) to:
//   1. Inspect the weekly top 20 leaderboard
//   2. Upvote tracks
//   3. Queue songs via natural language prompts
//   4. Read the 24/7 radio schedule

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// ── MCP Tool Definitions ──────────────────────────────────────────────────────

const MCP_TOOLS = [
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
    description: 'Retrieves the active 24/7 radio programming schedule, theme blocks, and automated AI news times.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

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
            description: 'PromptFM 24/7 AI Radio MCP Server on Vercel',
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
          tools: MCP_TOOLS,
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
      const toolResult = await handleToolCall(name, toolArgs || {});
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

async function handleToolCall(name?: string, args: Record<string, unknown> = {}) {
  const supabase = createAdminClient();

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

      // Increment track upvotes
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

      // Search matching track
      const { data: matches } = await supabase
        .from('tracks')
        .select('id, title, artist_name, tool_used, audio_url')
        .eq('status', 'approved')
        .ilike('title', `%${prompt}%`)
        .limit(1);

      let selected = matches?.[0];
      if (!selected) {
        // Fallback to top track
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

      // Find main channel
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
      if (existsSync(schedulePath)) {
        const raw = readFileSync(schedulePath, 'utf8');
        return { active_schedule_yaml: raw };
      }
      return { message: '24/7 continuous stream with hourly AI News at 07:00 UTC' };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── GET Discovery Endpoint ───────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json(
    {
      name: 'promptfm-mcp',
      description: 'Model Context Protocol (MCP) Server for PromptFM Radio',
      version: '1.0.0',
      endpoint: '/api/mcp',
      supported_methods: ['initialize', 'tools/list', 'tools/call', 'ping'],
      tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

