// tests/unit/web-mcp-console-mobile.test.ts
// Unit tests verifying mobile-friendly layout and phone-first ergonomics for WebMcpConsole (Issue #111)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import WebMcpConsole, {
  handleConsoleCommand,
  updateCommandHistory,
  QUICK_ACTIONS,
} from '@/components/WebMcpConsole';
import * as mcpClient from '@/lib/mcp/client';
import type { WebMcpCommandResult } from '@/lib/mcp/client';

describe('WebMcpConsole Mobile-Friendly Layout & Ergonomics (Issue #111)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Container & Base Layout', () => {
    it('uses phone-friendly padding on small screens (p-4 sm:p-6)', () => {
      const html = renderToString(React.createElement(WebMcpConsole));
      expect(html).toContain('p-4 sm:p-6');
    });
  });

  describe('Channel Selector Stacking & Responsive Header', () => {
    it('stacks the target channel selector cleanly on mobile with full-width container and select', () => {
      const html = renderToString(React.createElement(WebMcpConsole));

      // The channel selector wrapper should stack on mobile with w-full sm:w-auto
      expect(html).toMatch(/class="[^"]*w-full sm:w-auto[^"]*"/);

      // Select element should expand on mobile (w-full sm:w-auto) for comfortable finger tap
      const selectMatch = html.match(/<select[^>]*class="([^"]*)"/);
      expect(selectMatch).toBeTruthy();
      const selectClasses = selectMatch![1];
      expect(selectClasses).toContain('w-full');
      expect(selectClasses).toContain('sm:w-auto');
    });

    it('provides accessible label and radio icon for channel selection', () => {
      const html = renderToString(React.createElement(WebMcpConsole));
      expect(html).toContain('aria-label="Target radio channel"');
      expect(html).toContain('Channel:');
    });

    it('honors defaultChannel prop', () => {
      const html = renderToString(React.createElement(WebMcpConsole, { defaultChannel: 'chillout' }));
      expect(html).toContain('value="chillout" selected=""');
    });
  });

  describe('Quick Actions Breathing Room', () => {
    it('gives quick action chips breathing room with responsive gap and separated label on mobile', () => {
      const html = renderToString(React.createElement(WebMcpConsole));

      // Quick action container should have responsive gap (gap-2 sm:gap-1.5)
      expect(html).toMatch(/class="[^"]*gap-2 sm:gap-1\.5[^"]*"/);

      // Quick actions label should have w-full sm:w-auto so chips start cleanly on mobile
      const labelMatch = html.match(/<span[^>]*class="([^"]*)"[^>]*>Quick Actions:<\/span>/);
      expect(labelMatch).toBeTruthy();
      const labelClasses = labelMatch![1];
      expect(labelClasses).toContain('w-full');
      expect(labelClasses).toContain('sm:w-auto');
    });

    it('ensures chip buttons have comfortable mobile touch padding', () => {
      const html = renderToString(React.createElement(WebMcpConsole));

      // Quick action buttons should use responsive padding: px-3 py-1.5 on mobile, sm:px-2.5 sm:py-1 on desktop
      const chipMatch = html.match(/<button[^>]*class="([^"]*)"[^>]*>[\s\S]*?<span>\/np<\/span>/);
      expect(chipMatch).toBeTruthy();
      const chipClasses = chipMatch![1];
      expect(chipClasses).toContain('px-3');
      expect(chipClasses).toContain('py-1.5');
      expect(chipClasses).toContain('sm:px-2.5');
      expect(chipClasses).toContain('sm:py-1');
    });

    it('defines QUICK_ACTIONS list with all 8 commands and distinguishes /help styling', () => {
      expect(QUICK_ACTIONS).toHaveLength(8);
      const labels = QUICK_ACTIONS.map((a) => a.label);
      expect(labels).toEqual([
        '/np',
        '/queue',
        '/song synthwave',
        '/search vibe',
        '/djs',
        '/schedule',
        '/top 5',
        '/help',
      ]);
      const helpAction = QUICK_ACTIONS.find((a) => a.label === '/help');
      expect(helpAction?.isHelp).toBe(true);

      const html = renderToString(React.createElement(WebMcpConsole));
      expect(html).toContain('/help');
      expect(html).toContain('text-zinc-400 hover:text-white');
    });
  });

  describe('Command Form & Run MCP Button Stacking', () => {
    it('stacks the command input and Run MCP button vertically on mobile, moving to horizontal/absolute on desktop', () => {
      const html = renderToString(React.createElement(WebMcpConsole));

      // Form element must stack on mobile (flex-col sm:flex-row)
      const formMatch = html.match(/<form[^>]*class="([^"]*)"/);
      expect(formMatch).toBeTruthy();
      const formClasses = formMatch![1];
      expect(formClasses).toContain('flex-col');
      expect(formClasses).toContain('sm:flex-row');

      // The input field should avoid cramped pr-24 on mobile, applying pr-4 sm:pr-24
      const inputMatch = html.match(/<input[^>]*class="([^"]*)"/);
      expect(inputMatch).toBeTruthy();
      const inputClasses = inputMatch![1];
      expect(inputClasses).toContain('pr-4');
      expect(inputClasses).toContain('sm:pr-24');

      // The Run MCP button must be full-width and centered on mobile, and absolute only on sm+
      const buttonMatch = html.match(/<button[^>]*type="submit"[^>]*class="([^"]*)"/);
      expect(buttonMatch).toBeTruthy();
      const buttonClasses = buttonMatch![1];
      expect(buttonClasses).toContain('w-full');
      expect(buttonClasses).toContain('sm:w-auto');
      expect(buttonClasses).toContain('sm:absolute');
      expect(buttonClasses).toContain('justify-center');
      expect(buttonClasses).toContain('sm:justify-start');
    });

    it('renders loading state with disabled input and running spinner when initialLoading is true', () => {
      const html = renderToString(React.createElement(WebMcpConsole, { initialLoading: true, initialCommand: '/np' }));

      expect(html).toContain('disabled=""');
      expect(html).toContain('Running...');
      expect(html).not.toContain('Run MCP');
    });

    it('renders initialCommand in input field', () => {
      const html = renderToString(React.createElement(WebMcpConsole, { initialCommand: '/song synthwave 80s' }));
      expect(html).toContain('value="/song synthwave 80s"');
    });

    it('disables submit button when input contains only whitespace', () => {
      const html = renderToString(React.createElement(WebMcpConsole, { initialCommand: '     ' }));
      const buttonMatch = html.match(/<button[^>]*type="submit"[^>]*class="([^"]*)"/);
      expect(buttonMatch).toBeTruthy();
      expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    });
  });

  describe('Result Card Breakouts on Narrow Screens', () => {
    it('breaks result header into vertical blocks on mobile to prevent crowding channel badge', () => {
      const mockResult: WebMcpCommandResult = {
        success: true,
        command: 'np',
        toolName: 'promptfm_get_now_playing',
        message: 'Currently playing Solar Drift',
      };
      const html = renderToString(React.createElement(WebMcpConsole, { initialResult: mockResult }));

      // Result card header should stack vertically on mobile (flex-col sm:flex-row)
      expect(html).toContain('flex flex-col sm:flex-row sm:items-center justify-between');
      expect(html).toMatch(/target:.*main/);
      expect(html).toContain('promptfm_get_now_playing');
      expect(html).toContain('bg-emerald-950/20');
      expect(html).toContain('Web MCP Action Executed');
    });

    it('renders failure notice with rose colors and AlertCircle when success is false', () => {
      const mockResult: WebMcpCommandResult = {
        success: false,
        command: 'invalid',
        message: 'Unknown command',
      };
      const html = renderToString(React.createElement(WebMcpConsole, { initialResult: mockResult }));

      expect(html).toContain('Execution Notice');
      expect(html).toContain('bg-rose-950/20');
      expect(html).not.toContain('Web MCP Action Executed');
      // When toolName is omitted, toolName code badge should not exist
      expect(html).not.toMatch(/<code[^>]*text-emerald-400/);
    });

    it('breaks track and vibe match info into vertical blocks on mobile with similarity score', () => {
      const mockResult: WebMcpCommandResult = {
        success: true,
        command: 'song synthwave',
        message: 'Queued track',
        data: {
          match_engine: 'chroma-engine',
          track: { title: 'Neon Nightride', artist_name: 'SynthBot' },
          similarity_score: 0.94,
        },
      };
      const html = renderToString(React.createElement(WebMcpConsole, { initialResult: mockResult }));

      expect(html).toContain('Neon Nightride');
      expect(html).toMatch(/Vibe Match:\s*(<!-- -->)?\s*94\s*(<!-- -->)?%/);
      expect(html).toContain('chroma-engine');
      expect(html).toContain('flex flex-col sm:flex-row sm:items-center justify-between');
    });

    it('falls back to Approved Library, artist, and pgvector RAG when optional track fields are missing', () => {
      const mockResult: WebMcpCommandResult = {
        success: true,
        command: 'song jazz',
        message: 'Queued track',
        data: {
          track: { title: 'Midnight Sax', artist: 'Miles Bot' },
        },
      };
      const html = renderToString(React.createElement(WebMcpConsole, { initialResult: mockResult }));

      expect(html).toContain('Midnight Sax');
      expect(html).toContain('Approved Library');
      expect(html).toContain('Miles Bot');
      expect(html).toContain('pgvector RAG');
    });

    it('breaks now playing header into vertical blocks on mobile with non-zero upvotes', () => {
      const mockResult: WebMcpCommandResult = {
        success: true,
        command: 'np',
        message: 'Now playing',
        data: {
          now_playing: {
            title: 'Midnight Echoes',
            upvotes_count: 7,
            tool_used: 'promptfm_get_now_playing',
          },
        },
      };
      const html = renderToString(React.createElement(WebMcpConsole, { initialResult: mockResult }));

      expect(html).toContain('Midnight Echoes');
      expect(html).toMatch(/👍\s*(<!-- -->)?\s*7\s*(<!-- -->)?\s*Upvotes/);
      expect(html).toContain('Automated Host');
      expect(html).toContain('flex flex-col sm:flex-row sm:items-center justify-between');
    });

    it('breaks up-next queue rows into vertical blocks on narrow screens with position fallbacks', () => {
      const mockResult: WebMcpCommandResult = {
        success: true,
        command: 'queue',
        message: 'Queue status',
        data: {
          up_next: [
            { id: '1', position: 5, title: 'Super Long Track Name That Can Overflow', artist: 'Very Long Artist Name' },
            { id: '2', position: 0, title: 'Fallback Position Track', artist: 'Artist Two' },
          ],
        },
      };
      const html = renderToString(React.createElement(WebMcpConsole, { initialResult: mockResult }));

      expect(html).toContain('Super Long Track Name That Can Overflow');
      expect(html).toMatch(/#<!-- -->5|#5/);
      expect(html).toMatch(/#<!-- -->2|#2/);
      expect(html).toMatch(/class="[^"]*flex flex-col sm:flex-row sm:items-center justify-between[^"]*"/);
    });

    it('breaks search results into vertical blocks on mobile and limits to first 3', () => {
      const mockResult: WebMcpCommandResult = {
        success: true,
        command: 'search chillout',
        message: 'Matches',
        data: {
          tracks: [
            { id: 's1', title: 'Sunset Glow 1', similarity_score: 0.9 },
            { id: 's2', title: 'Sunset Glow 2', similarity_score: 0.8 },
            { id: 's3', title: 'Sunset Glow 3', similarity_score: 0.7 },
            { id: 's4', title: 'Sunset Glow 4 (Should Not Show)', similarity_score: 0.6 },
          ],
        },
      };
      const html = renderToString(React.createElement(WebMcpConsole, { initialResult: mockResult }));

      expect(html).toContain('Sunset Glow 1');
      expect(html).toContain('Sunset Glow 3');
      expect(html).not.toContain('Sunset Glow 4 (Should Not Show)');
      expect(html).toMatch(/>\s*90(<!-- -->)?% match\s*</);
      expect(html).toMatch(/class="[^"]*flex flex-col sm:flex-row sm:items-center justify-between[^"]*"/);
    });

    it('breaks DJ list entries into vertical blocks on mobile', () => {
      const mockResult: WebMcpCommandResult = {
        success: true,
        command: 'djs',
        message: 'DJs',
        data: {
          djs: [
            { id: 'dj_neon', name: 'DJ Neon', voice: 'Energetic Female' },
          ],
        },
      };
      const html = renderToString(React.createElement(WebMcpConsole, { initialResult: mockResult }));

      expect(html).toContain('DJ Neon');
      expect(html).toContain('Energetic Female');
      expect(html).toMatch(/class="[^"]*flex flex-col sm:flex-row sm:items-center justify-between[^"]*"/);
    });

    it('ensures footer info badge wraps cleanly on narrow screens', () => {
      const html = renderToString(React.createElement(WebMcpConsole));

      // Footer should use responsive stacking flex-col sm:flex-row
      const footerMatch = html.match(/<div[^>]*class="([^"]*)"[^>]*>[^<]*<span>Unified Station API:/);
      expect(footerMatch).toBeTruthy();
      const footerClasses = footerMatch![1];
      expect(footerClasses).toContain('flex-col');
      expect(footerClasses).toContain('sm:flex-row');
    });

    it('does not render track, list, or DJ grid sections when data arrays are empty or omitted', () => {
      const mockResult: WebMcpCommandResult = {
        success: true,
        command: 'test',
        message: 'Plain message without data sections',
        data: {
          tracks: [],
          up_next: [],
          djs: [],
        },
      };
      const html = renderToString(React.createElement(WebMcpConsole, { initialResult: mockResult }));

      expect(html).not.toContain('Upcoming Items:');
      expect(html).not.toContain('Matching Tracks:');
      expect(html).not.toContain('grid-cols-1 sm:grid-cols-2');
    });
  });

  describe('handleConsoleCommand', () => {
    it('returns null when command is empty or whitespace', async () => {
      expect(await handleConsoleCommand('')).toBeNull();
      expect(await handleConsoleCommand('   ')).toBeNull();
    });

    it('executes command and triggers onComplete callback', async () => {
      const mockRes: WebMcpCommandResult = {
        success: true,
        command: 'np',
        message: 'Success',
      };
      vi.spyOn(mcpClient, 'executeWebMcpCommand').mockResolvedValue(mockRes);
      const onComplete = vi.fn();

      const res = await handleConsoleCommand('  /np  ', 'chillout', onComplete);
      expect(mcpClient.executeWebMcpCommand).toHaveBeenCalledWith('/np', {
        channel: 'chillout',
        requester: 'Web Console Listener',
      });
      expect(res).toEqual(mockRes);
      expect(onComplete).toHaveBeenCalledWith(mockRes);
    });

    it('defaults to main channel when channel is not specified', async () => {
      const mockRes: WebMcpCommandResult = {
        success: true,
        command: 'queue',
        message: 'Success',
      };
      vi.spyOn(mcpClient, 'executeWebMcpCommand').mockResolvedValue(mockRes);

      await handleConsoleCommand('/queue');
      expect(mcpClient.executeWebMcpCommand).toHaveBeenCalledWith('/queue', {
        channel: 'main',
        requester: 'Web Console Listener',
      });
    });

    it('catches Error exceptions and formats error response', async () => {
      vi.spyOn(mcpClient, 'executeWebMcpCommand').mockRejectedValue(new Error('Connection failed'));

      const res = await handleConsoleCommand('/queue', 'main');
      expect(res).toEqual({
        success: false,
        command: '/queue',
        message: 'Connection failed',
      });
    });

    it('catches non-Error exceptions and converts to string message', async () => {
      vi.spyOn(mcpClient, 'executeWebMcpCommand').mockRejectedValue('Fatal network crash');

      const res = await handleConsoleCommand('/queue', 'main');
      expect(res).toEqual({
        success: false,
        command: '/queue',
        message: 'Fatal network crash',
      });
    });
  });

  describe('updateCommandHistory', () => {
    it('prepends new command and removes duplicate from history', () => {
      const prev = ['/queue', '/np', '/help'];
      const updated = updateCommandHistory(prev, '/np');
      expect(updated).toEqual(['/np', '/queue', '/help']);
    });

    it('limits command history to 5 items', () => {
      const prev = ['/cmd1', '/cmd2', '/cmd3', '/cmd4', '/cmd5'];
      const updated = updateCommandHistory(prev, '/cmd6');
      expect(updated).toHaveLength(5);
      expect(updated).toEqual(['/cmd6', '/cmd1', '/cmd2', '/cmd3', '/cmd4']);
    });
  });
});
