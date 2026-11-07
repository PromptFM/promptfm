// @ts-nocheck
'use client';

// src/components/WebMcpConsole.tsx
// Interactive Web MCP Console & Action Runner for PromptFM Listeners
// Exposes PromptFM Model Context Protocol tools directly in the web UI

import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Play,
  Loader2,
  Sparkles,
  Radio,
  ListMusic,
  Search,
  Users,
  Calendar,
  Trophy,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Send,
  Flame,
  Volume2,
} from 'lucide-react';
import { executeWebMcpCommand, type WebMcpCommandResult } from '@/lib/mcp/client';
import { OFFICIAL_CHANNELS } from '@/lib/radio/channels';

interface WebMcpConsoleProps {
  initialCommand?: string;
  defaultChannel?: string;
  onCommandComplete?: (res: WebMcpCommandResult) => void;
}

export default function WebMcpConsole({
  initialCommand = '',
  defaultChannel = 'main',
  onCommandComplete,
}: WebMcpConsoleProps) {
  const [input, setInput] = useState(initialCommand);
  const [selectedChannel, setSelectedChannel] = useState(defaultChannel);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WebMcpCommandResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialCommand) {
      setInput(initialCommand);
    }
  }, [initialCommand]);

  const runCommand = async (cmdToRun: string) => {
    const trimmed = cmdToRun.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await executeWebMcpCommand(trimmed, {
        channel: selectedChannel,
        requester: 'Web Console Listener',
      });

      setResult(res);
      setHistory((prev) => [trimmed, ...prev.filter((c) => c !== trimmed)].slice(0, 5));
      if (onCommandComplete) {
        onCommandComplete(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({
        success: false,
        command: trimmed,
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runCommand(input);
  };

  const handleQuickChip = (cmd: string) => {
    setInput(cmd);
    runCommand(cmd);
  };

  return (
    <div className="w-full bg-zinc-950/80 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-md text-left space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                PromptFM Web MCP Console
              </h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                JSON-RPC 2.0
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Run station actions and live listener tools directly from your browser.
            </p>
          </div>
        </div>

        {/* Target Channel Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-zinc-400 flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Channel:
          </span>
          <select
            aria-label="Target radio channel"
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {OFFICIAL_CHANNELS.map((ch) => (
              <option key={ch.slug} value={ch.slug}>
                {ch.shortName || ch.name} ({ch.slug})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[11px] text-zinc-500 font-medium mr-1">Quick Actions:</span>
        <button
          type="button"
          onClick={() => handleQuickChip('/nowplaying')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          <Radio className="w-3 h-3 text-emerald-400" />
          <span>/np</span>
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip('/queue')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          <ListMusic className="w-3 h-3 text-emerald-400" />
          <span>/queue</span>
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip('/song synthwave sunset')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>/song synthwave</span>
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip('/search cyberpunk heavy')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          <Search className="w-3 h-3 text-emerald-400" />
          <span>/search vibe</span>
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip('/djs')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          <Users className="w-3 h-3 text-emerald-400" />
          <span>/djs</span>
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip('/schedule')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          <Calendar className="w-3 h-3 text-emerald-400" />
          <span>/schedule</span>
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip('/top 5')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          <Trophy className="w-3 h-3 text-emerald-400" />
          <span>/top 5</span>
        </button>
        <button
          type="button"
          onClick={() => handleQuickChip('/help')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          <HelpCircle className="w-3 h-3" />
          <span>/help</span>
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 flex items-center pointer-events-none text-emerald-400">
          <ChevronRight className="w-4 h-4 font-bold" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter command (e.g. /song chillout lofi, /np, /queue, or /search synthwave)..."
          disabled={loading}
          className="w-full bg-zinc-900/90 border border-zinc-800 hover:border-emerald-500/50 focus:border-emerald-500 rounded-xl pl-9 pr-24 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono transition-all"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-black font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Run MCP</span>
            </>
          )}
        </button>
      </form>

      {/* Result Card */}
      {result && (
        <div
          className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in transition-all ${
            result.success
              ? 'bg-emerald-950/20 border-emerald-500/30 text-zinc-200'
              : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span className="font-semibold text-white">
                {result.success ? 'Web MCP Action Executed' : 'Execution Notice'}
              </span>
              {result.toolName && (
                <code className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-emerald-400">
                  {result.toolName}
                </code>
              )}
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              target: {selectedChannel}
            </span>
          </div>

          <p className="text-zinc-300 leading-relaxed font-sans">{result.message}</p>

          {/* Formatted data views */}
          {result.data && (
            <div className="pt-2 border-t border-zinc-800/60">
              {/* Song request data */}
              {result.data.track && (
                <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{result.data.track.title}</span>
                    <span className="text-emerald-400 font-mono">
                      {result.data.similarity_score !== undefined
                        ? `Vibe Match: ${(result.data.similarity_score * 100).toFixed(0)}%`
                        : 'Approved Library'}
                    </span>
                  </div>
                  <p className="text-zinc-400">
                    Artist: <span className="text-zinc-200">{result.data.track.artist_name || result.data.track.artist}</span> · Engine:{' '}
                    <span className="text-zinc-200">{result.data.match_engine || 'pgvector RAG'}</span>
                  </p>
                </div>
              )}

              {/* Now playing data */}
              {result.data.now_playing && (
                <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{result.data.now_playing.title}</span>
                    <span className="text-emerald-400 font-mono">
                      👍 {result.data.now_playing.upvotes_count || 0} Upvotes
                    </span>
                  </div>
                  <p className="text-zinc-400">
                    Host DJ:{' '}
                    <span className="text-emerald-300 font-semibold">
                      {result.data.now_playing.active_dj?.name || 'Automated Host'}
                    </span>{' '}
                    · Tool: <span className="text-zinc-200">{result.data.now_playing.tool_used}</span>
                  </p>
                </div>
              )}

              {/* Up next queue list */}
              {Array.isArray(result.data.up_next) && result.data.up_next.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                    Upcoming Items:
                  </span>
                  <div className="space-y-1">
                    {result.data.up_next.map((item: any, idx: number) => (
                      <div
                        key={item.id || idx}
                        className="flex items-center justify-between p-1.5 px-2 rounded bg-zinc-900/80 border border-zinc-800 text-[11px]"
                      >
                        <span className="text-white font-medium">
                          #{item.position || idx + 1} {item.title}
                        </span>
                        <span className="text-zinc-400">{item.artist}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search tracks list */}
              {Array.isArray(result.data.tracks) && result.data.tracks.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                    Matching Tracks:
                  </span>
                  <div className="space-y-1">
                    {result.data.tracks.slice(0, 3).map((item: any, idx: number) => (
                      <div
                        key={item.id || idx}
                        className="flex items-center justify-between p-1.5 px-2 rounded bg-zinc-900/80 border border-zinc-800 text-[11px]"
                      >
                        <span className="text-white font-medium">{item.title}</span>
                        <span className="text-emerald-400 font-mono">
                          {(item.similarity_score * 100).toFixed(0)}% match
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DJ list */}
              {Array.isArray(result.data.djs) && result.data.djs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {result.data.djs.map((dj: any) => (
                    <div
                      key={dj.id}
                      className="p-1.5 px-2 rounded bg-zinc-900/80 border border-zinc-800 text-[11px] flex items-center justify-between"
                    >
                      <span className="text-white font-medium">{dj.name}</span>
                      <span className="text-xs text-zinc-400">{dj.voice}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer info badge */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
        <span>Unified Station API: Dispatches to official <code className="text-zinc-400">/api/mcp</code></span>
        <a
          href="/api/mcp"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 font-mono text-[10px] hover:underline"
        >
          View /api/mcp Spec ↗
        </a>
      </div>
    </div>
  );
}
