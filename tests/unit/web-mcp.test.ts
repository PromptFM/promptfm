// @ts-nocheck
// tests/unit/web-mcp.test.ts
// Unit tests for Web MCP client, command dispatcher, and listener/admin action adapters

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  callMcpTool,
  listMcpTools,
  executeWebMcpCommand,
  webMcpQueueSong,
  webMcpUpvoteTrack,
  webMcpSearchVibe,
  webMcpGetNowPlaying,
  webMcpGetUpNext,
  webMcpGetTopTracks,
  webMcpGetSchedule,
  webMcpGetDJs,
  webMcpReportContent,
  webMcpModerateTrack,
  webMcpRemoveFromQueue,
  webMcpRejectRequest,
  webMcpResolveReport,
  webMcpAuditReports,
  webMcpBroadcast,
  webMcpCreateChannel,
  webMcpStartStream,
  webMcpStopStream,
  webMcpGetStreamStatus,
  webMcpVoiceDrop,
  webMcpInjectInterstitial,
  webMcpInjectAd,
  webMcpAirRequest,
  webMcpEditTrack,
  webMcpDeleteTrack,
  parseMcpCommandString,
} from '@/lib/mcp/client';

describe('Web MCP Client & Command Protocol', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('callMcpTool (JSON-RPC 2.0 Client)', () => {
    it('dispatches valid JSON-RPC 2.0 payload to /api/mcp and returns parsed data', async () => {
      const mockResult = { success: true, count: 5, leaderboard: [] };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'web-mcp-123',
          result: {
            content: [{ type: 'text', text: JSON.stringify(mockResult) }],
          },
        }),
      } as unknown as Response);

      const data = await callMcpTool('promptfm_get_top_tracks', { limit: 5 });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"method":"tools/call"'),
        })
      );
      expect(data).toEqual(mockResult);
    });

    it('attaches admin authorization headers when adminKey is provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'web-mcp-admin',
          result: {
            content: [{ type: 'text', text: JSON.stringify({ success: true, audit: {} }) }],
          },
        }),
      } as unknown as Response);

      await callMcpTool(
        'promptfm_admin_audit_reports',
        { limit: 10 },
        { adminKey: 'super-secret-admin-key' }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-admin-key': 'super-secret-admin-key',
            Authorization: 'Bearer super-secret-admin-key',
          }),
        })
      );
    });

    it('throws error when tool execution returns isError = true in content', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'err-1',
          result: {
            isError: true,
            content: [{ type: 'text', text: 'Tool error: Channel not found' }],
          },
        }),
      } as unknown as Response);

      await expect(callMcpTool('promptfm_queue_song_request', { prompt: 'fail' })).rejects.toThrow(
        'Tool error: Channel not found'
      );
    });

    it('throws error when server responds with JSON-RPC error payload', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Invalid JSON-RPC request' },
        }),
      } as unknown as Response);

      await expect(callMcpTool('unknown_tool')).rejects.toThrow('Invalid JSON-RPC request');
    });

    it('throws error on network failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      await expect(callMcpTool('promptfm_get_schedule')).rejects.toThrow('Network offline');
    });
  });

  describe('listMcpTools', () => {
    it('queries tools/list and returns available MCP tools', async () => {
      const mockTools = [
        { name: 'promptfm_get_top_tracks', description: 'Top tracks' },
        { name: 'promptfm_queue_song_request', description: 'Queue song' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'list-1',
          result: { tools: mockTools },
        }),
      } as unknown as Response);

      const tools = await listMcpTools();
      expect(tools).toEqual(mockTools);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          body: expect.stringContaining('"method":"tools/list"'),
        })
      );
    });
  });

  describe('parseMcpCommandString', () => {
    it('parses /song with arguments', () => {
      const parsed = parseMcpCommandString('/song synthwave 80s neon');
      expect(parsed).toEqual({
        command: 'song',
        rawArgs: 'synthwave 80s neon',
      });
    });

    it('parses shorthand /s and /np', () => {
      expect(parseMcpCommandString('/s chillout')).toEqual({
        command: 'song',
        rawArgs: 'chillout',
      });
      expect(parseMcpCommandString('/np')).toEqual({
        command: 'nowplaying',
        rawArgs: '',
      });
      expect(parseMcpCommandString('/q')).toEqual({
        command: 'queue',
        rawArgs: '',
      });
    });

    it('defaults plain natural language prompts without slash to /song', () => {
      const parsed = parseMcpCommandString('cyberpunk heavy bass drop');
      expect(parsed).toEqual({
        command: 'song',
        rawArgs: 'cyberpunk heavy bass drop',
      });
    });
  });

  describe('executeWebMcpCommand (Listener Command Execution)', () => {
    it('executes /song command via promptfm_queue_song_request tool', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'song-1',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: 'Queued "Neon Sunset" by SynthBot for airplay on main!',
                  track: { id: 't-1', title: 'Neon Sunset', artist_name: 'SynthBot' },
                }),
              },
            ],
          },
        }),
      } as unknown as Response);

      const res = await executeWebMcpCommand('/song cyberpunk sunset', {
        channel: 'main',
        requester: 'Web Guest',
      });

      expect(res.success).toBe(true);
      expect(res.toolName).toBe('promptfm_queue_song_request');
      expect(res.message).toContain('Queued "Neon Sunset"');
      expect(res.data?.track?.title).toBe('Neon Sunset');
    });

    it('executes /nowplaying or /np command via promptfm_get_now_playing tool', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'np-1',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  now_playing: {
                    id: 't-2',
                    title: 'Cyber Drift',
                    artist: 'DJ Vance',
                    active_dj: { name: 'DJ Vance' },
                  },
                }),
              },
            ],
          },
        }),
      } as unknown as Response);

      const res = await executeWebMcpCommand('/np');
      expect(res.success).toBe(true);
      expect(res.toolName).toBe('promptfm_get_now_playing');
      expect(res.data?.now_playing?.title).toBe('Cyber Drift');
    });

    it('executes /queue or /next command via promptfm_get_up_next tool', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'q-1',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  channel: 'main',
                  upcoming_count: 2,
                  up_next: [{ position: 1, title: 'Next Song' }],
                }),
              },
            ],
          },
        }),
      } as unknown as Response);

      const res = await executeWebMcpCommand('/queue');
      expect(res.success).toBe(true);
      expect(res.toolName).toBe('promptfm_get_up_next');
      expect(res.data?.up_next?.length).toBe(1);
    });

    it('executes /search or /vibe command via promptfm_search_tracks_by_vibe tool', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'vibe-1',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  count: 1,
                  tracks: [{ id: 'v-1', title: 'Deep Ocean Ambient' }],
                }),
              },
            ],
          },
        }),
      } as unknown as Response);

      const res = await executeWebMcpCommand('/search ambient underwater');
      expect(res.success).toBe(true);
      expect(res.toolName).toBe('promptfm_search_tracks_by_vibe');
      expect(res.data?.tracks[0]?.title).toBe('Deep Ocean Ambient');
    });

    it('executes /vote command via promptfm_upvote_track tool', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'vote-1',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: 'Upvoted "Solar Flare"!',
                  new_upvotes_count: 42,
                }),
              },
            ],
          },
        }),
      } as unknown as Response);

      const res = await executeWebMcpCommand('/vote track-uuid-1234');
      expect(res.success).toBe(true);
      expect(res.toolName).toBe('promptfm_upvote_track');
      expect(res.message).toContain('Upvoted');
    });

    it('executes /djs command via promptfm_get_djs tool', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'dj-1',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  active_dj_now: { name: 'DJ Neon' },
                  djs: [{ id: 'dj_neon', name: 'DJ Neon' }],
                }),
              },
            ],
          },
        }),
      } as unknown as Response);

      const res = await executeWebMcpCommand('/djs');
      expect(res.success).toBe(true);
      expect(res.toolName).toBe('promptfm_get_djs');
    });

    it('executes /schedule command via promptfm_get_schedule tool', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'sched-1',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  current_dj_on_air: { name: 'DJ Cipher' },
                  ads_summary: { enabled: true },
                }),
              },
            ],
          },
        }),
      } as unknown as Response);

      const res = await executeWebMcpCommand('/schedule');
      expect(res.success).toBe(true);
      expect(res.toolName).toBe('promptfm_get_schedule');
    });

    it('executes /report command via promptfm_report_content tool', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'rep-1',
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  ticket_id: 'rep-99',
                  message: 'Report received',
                }),
              },
            ],
          },
        }),
      } as unknown as Response);

      const res = await executeWebMcpCommand('/report track-uuid-44 copyright_dmca Stolen riff');
      expect(res.success).toBe(true);
      expect(res.toolName).toBe('promptfm_report_content');
      expect(res.data?.ticket_id).toBe('rep-99');
    });

    it('handles /help locally without network dispatch', async () => {
      const res = await executeWebMcpCommand('/help');
      expect(res.success).toBe(true);
      expect(res.command).toBe('help');
      expect(res.message).toContain('PromptFM Web MCP Interactive Commands');
      expect(res.data?.commands).toBeDefined();
    });

    it('returns error when command is empty or missing required argument', async () => {
      const res = await executeWebMcpCommand('/vote');
      expect(res.success).toBe(false);
      expect(res.message).toContain('track ID is required');
    });

    it('returns friendly message for unrecognized command', async () => {
      const res = await executeWebMcpCommand('/foobar');
      expect(res.success).toBe(false);
      expect(res.message).toContain('Unknown command "/foobar"');
    });
  });

  describe('Typed Web MCP Listener & Admin Action Wrappers', () => {
    it('webMcpQueueSong calls promptfm_queue_song_request with defaults', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] },
        }),
      } as unknown as Response);

      await webMcpQueueSong('dreamy lofi', { channel: 'chillout' });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          body: expect.stringContaining('"prompt":"dreamy lofi"'),
        })
      );
    });

    it('webMcpModerateTrack calls promptfm_admin_moderate_track with action', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: { content: [{ type: 'text', text: JSON.stringify({ success: true, track: {} }) }] },
        }),
      } as unknown as Response);

      await webMcpModerateTrack('track-1', 'approved', 'admin-key');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          body: expect.stringContaining('"name":"promptfm_admin_moderate_track"'),
        })
      );
    });

    it('webMcpRemoveFromQueue calls promptfm_admin_remove_from_queue', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] },
        }),
      } as unknown as Response);

      await webMcpRemoveFromQueue('queue-123');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          body: expect.stringContaining('"name":"promptfm_admin_remove_from_queue"'),
        })
      );
    });

    it('webMcpResolveReport calls promptfm_admin_resolve_report with notes and actor', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: { content: [{ type: 'text', text: JSON.stringify({ success: true, action: 'actioned' }) }] },
        }),
      } as unknown as Response);

      await webMcpResolveReport('rep-1', 'actioned', 'DMCA takedown notice verified', 'Station Director');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          body: expect.stringContaining('"name":"promptfm_admin_resolve_report"'),
        })
      );
    });

    it('webMcpBroadcast calls promptfm_admin_broadcast', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] },
        }),
      } as unknown as Response);

      await webMcpBroadcast('Live DJ battle starting now!', true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          body: expect.stringContaining('"name":"promptfm_admin_broadcast"'),
        })
      );
    });

    it('webMcpStartStream and webMcpStopStream call stream administration tools', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] },
        }),
      } as unknown as Response);

      await webMcpStartStream('youtube', 'yt-key-123');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          body: expect.stringContaining('"name":"promptfm_admin_start_stream"'),
        })
      );

      await webMcpStopStream('youtube');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          body: expect.stringContaining('"name":"promptfm_admin_stop_stream"'),
        })
      );
    });

    it('webMcpEditTrack calls promptfm_admin_edit_track with metadata updates', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: { content: [{ type: 'text', text: JSON.stringify({ success: true, track: { title: 'New Title' } }) }] },
        }),
      } as unknown as Response);

      await webMcpEditTrack('track-123', { title: 'New Title', artist_name: 'New Artist' });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          body: expect.stringContaining('"name":"promptfm_admin_edit_track"'),
        })
      );
    });

    it('webMcpDeleteTrack calls promptfm_admin_delete_track with track_id', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: { content: [{ type: 'text', text: JSON.stringify({ success: true, deleted_id: 'track-123' }) }] },
        }),
      } as unknown as Response);

      await webMcpDeleteTrack('track-123', { softDelete: false });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/mcp',
        expect.objectContaining({
          body: expect.stringContaining('"name":"promptfm_admin_delete_track"'),
        })
      );
    });
  });
});
