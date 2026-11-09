// @ts-nocheck
'use client';

// src/components/WebMcpConsole.tsx
// Interactive Web MCP Console & Action Runner for PromptFM Listeners
// Exposes PromptFM Model Context Protocol tools directly in the web UI

import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
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
} from 'lucide-react';
import { executeWebMcpCommand, type WebMcpCommandResult } from '@/lib/mcp/client';
import { OFFICIAL_CHANNELS } from '@/lib/radio/channels';

export interface WebMcpConsoleProps {
  initialCommand?: string;
  defaultChannel?: string;
  initialResult?: WebMcpCommandResult | null;
  initialLoading?: boolean;
  onCommandComplete?: (res: WebMcpCommandResult) => void;
}

export const QUICK_ACTIONS = [
  { label: '/np', cmd: '/nowplaying', icon: Radio },
  { label: '/queue', cmd: '/queue', icon: ListMusic },
  { label: '/song synthwave', cmd: '/song synthwave sunset', icon: Sparkles },
  { label: '/search vibe', cmd: '/search cyberpunk heavy', icon: Search },
  { label: '/djs', cmd: '/djs', icon: Users },
  { label: '/schedule', cmd: '/schedule', icon: Calendar },
  { label: '/top 5', cmd: '/top 5', icon: Trophy },
  { label: '/help', cmd: '/help', icon: HelpCircle, isHelp: true },
] as const;

export function updateCommandHistory(prev: string[], trimmed: string): string[] {
  return [trimmed, ...prev.filter((c) => c !== trimmed)].slice(0, 5);
}

export async function handleConsoleCommand(
  cmd: string,
  channel: string = 'main',
  onComplete?: (res: WebMcpCommandResult) => void
): Promise<WebMcpCommandResult | null> {
  const trimmed = cmd.trim();
  if (!trimmed) return null;

  try {
    const res = await executeWebMcpCommand(trimmed, {
      channel,
      requester: 'Web Console Listener',
    });
    if (onComplete) {
      onComplete(res);
    }
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      command: trimmed,
      message: msg,
    };
  }
}

export default function WebMcpConsole({
  initialCommand = '',
  defaultChannel = 'main',
  initialResult = null,
  initialLoading = false,
  onCommandComplete,
}: WebMcpConsoleProps) {
  const [input, setInput] = useState(initialCommand);
  const [selectedChannel, setSelectedChannel] = useState(defaultChannel);
  const [loading, setLoading] = useState(initialLoading);
  const [result, setResult] = useState<WebMcpCommandResult | null>(initialResult);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialCommand) {
      setInput(initialCommand);
    }
  }, [initialCommand]);

  useEffect(() => {
    if (initialResult) {
      setResult(initialResult);
    }
  }, [initialResult]);

  const runCommand = async (cmdToRun: string) => {
    const trimmed = cmdToRun.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await handleConsoleCommand(trimmed, selectedChannel, onCommandComplete);
      if (res) {
        setResult(res);
        setHistory((prev) => updateCommandHistory(prev, trimmed));
      }
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
    <div className="w-full bg-zinc-950/80 border border-emerald-500/30 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md text-left space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
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
        <div className="w-full sm:w-auto flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
          <label htmlFor="target-channel-select" className="text-xs text-zinc-400 flex items-center gap-1 shrink-0">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Channel:
          </label>
          <select
            id="target-channel-select"
            aria-label="Target radio channel"
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="w-full sm:w-auto bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded-lg px-2.5 py-1.5 sm:py-1 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
      <div className="flex flex-wrap items-center gap-2 sm:gap-1.5 text-xs">
        <span className="w-full sm:w-auto text-[11px] text-zinc-400 sm:text-zinc-500 font-medium mr-1">Quick Actions:</span>
        {QUICK_ACTIONS.map((action, idx) => {
          const Icon = action.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickChip(action.cmd)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors ${
                action.isHelp ? 'text-zinc-400 hover:text-white' : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Icon className={`w-3 h-3 ${action.isHelp ? '' : 'text-emerald-400'}`} />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:relative sm:items-center">
        <div className="relative flex-1 w-full">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-emerald-400">
            <ChevronRight className="w-4 h-4 font-bold" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter command (e.g. /song chillout lofi, /np, /queue, or /search synthwave)..."
            disabled={loading}
            className="w-full bg-zinc-900/90 border border-zinc-800 hover:border-emerald-500/50 focus:border-emerald-500 rounded-xl pl-9 pr-4 sm:pr-24 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 font-mono transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-full sm:w-auto sm:absolute sm:right-1.5 sm:top-1/2 sm:-translate-y-1/2 px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-xl sm:rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-black font-semibold text-xs flex items-center justify-center sm:justify-start gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
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
            <span className="text-[10px] text-zinc-500 font-mono self-start sm:self-auto">
              target: {selectedChannel}
            </span>
          </div>

          <p className="text-zinc-300 leading-relaxed font-sans break-words">{result.message}</p>

          {/* Formatted data views */}
          {result.data && (
            <div className="pt-2 border-t border-zinc-800/60 space-y-2">
              {/* Song request data */}
              {result.data.track && (
                <div className="p-3 sm:p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs sm:text-[11px] space-y-1.5 sm:space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-white break-words">{result.data.track.title}</span>
                    <span className="text-emerald-400 font-mono text-[11px] sm:text-xs self-start sm:self-auto">
                      {result.data.similarity_score !== undefined
                        ? `Vibe Match: ${(result.data.similarity_score * 100).toFixed(0)}%`
                        : 'Approved Library'}
                    </span>
                  </div>
                  <p className="text-zinc-400 break-words">
                    Artist: <span className="text-zinc-200">{result.data.track.artist_name || result.data.track.artist}</span> · Engine: <span className="text-zinc-200">{result.data.match_engine || 'pgvector RAG'}</span>
                  </p>
                </div>
              )}

              {/* Now playing data */}
              {result.data.now_playing && (
                <div className="p-3 sm:p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs sm:text-[11px] space-y-1.5 sm:space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-white break-words">{result.data.now_playing.title}</span>
                    <span className="text-emerald-400 font-mono text-[11px] sm:text-xs self-start sm:self-auto">
                      👍 {result.data.now_playing.upvotes_count || 0} Upvotes
                    </span>
                  </div>
                  <p className="text-zinc-400 break-words">
                    Host DJ: <span className="text-emerald-300 font-semibold">{result.data.now_playing.active_dj?.name || 'Automated Host'}</span> · Tool: <span className="text-zinc-200">{result.data.now_playing.tool_used}</span>
                  </p>
                </div>
              )}

              {/* Up next queue list */}
              {Array.isArray(result.data.up_next) && result.data.up_next.length > 0 && (
                <div className="space-y-1.5 sm:space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                    Upcoming Items:
                  </span>
                  <div className="space-y-1.5 sm:space-y-1">
                    {result.data.up_next.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 sm:p-1.5 px-3 sm:px-2 rounded bg-zinc-900/80 border border-zinc-800 text-xs sm:text-[11px]"
                      >
                        <span className="text-white font-medium break-words">
                          #{item.position || idx + 1} {item.title}
                        </span>
                        <span className="text-zinc-400 text-[11px] sm:text-xs self-start sm:self-auto">{item.artist}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search tracks list */}
              {Array.isArray(result.data.tracks) && result.data.tracks.length > 0 && (
                <div className="space-y-1.5 sm:space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                    Matching Tracks:
                  </span>
                  <div className="space-y-1.5 sm:space-y-1">
                    {result.data.tracks.slice(0, 3).map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 sm:p-1.5 px-3 sm:px-2 rounded bg-zinc-900/80 border border-zinc-800 text-xs sm:text-[11px]"
                      >
                        <span className="text-white font-medium break-words">{item.title}</span>
                        <span className="text-emerald-400 font-mono text-[11px] sm:text-xs self-start sm:self-auto">
                          {(item.similarity_score * 100).toFixed(0)}% match
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DJ list */}
              {Array.isArray(result.data.djs) && result.data.djs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-1.5">
                  {result.data.djs.map((dj: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 sm:p-1.5 px-3 sm:px-2 rounded bg-zinc-900/80 border border-zinc-800 text-xs sm:text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                    >
                      <span className="text-white font-medium break-words">{dj.name}</span>
                      <span className="text-[11px] sm:text-xs text-zinc-400 self-start sm:self-auto">{dj.voice}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer info badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-1 text-[11px] text-zinc-500 pt-1">
        <span>Unified Station API: Dispatches to official <code className="text-zinc-400">/api/mcp</code></span>
        <a
          href="/api/mcp"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 font-mono text-[10px] hover:underline self-start sm:self-auto"
        >
          View /api/mcp Spec ↗
        </a>
      </div>
    </div>
  );
}
