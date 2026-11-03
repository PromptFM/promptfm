'use client';

// src/components/CommunitySection.tsx
// Visual community banner connecting listeners to Discord & Telegram channels

import React, { useState } from 'react';
import { MessageSquare, Send, Bot, Radio, Users, Sparkles, Clock, Music, Terminal, Copy, Check } from 'lucide-react';
import { getCommunityLinks } from '@/lib/community/links';
import { LISTENER_COMMANDS } from '@/lib/community/commands';

export default function CommunitySection() {
  const links = getCommunityLinks();
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleCopy = (cmd: string) => {
    navigator.clipboard?.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-emerald-400 font-medium mb-2">
          <Users className="w-3.5 h-3.5" />
          <span>PromptFM Live Community</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Join the Conversation on Air
        </h2>
        <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto mt-1">
          Receive real-time track updates, vote directly in chat, and prompt the AI DJs from your favorite platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Discord Card */}
        <div className="flex flex-col justify-between p-6 rounded-2xl bg-gradient-to-b from-indigo-950/30 to-zinc-900/60 border border-indigo-500/20 hover:border-indigo-500/40 transition-all text-left group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                #now-playing & #radio-feed
              </span>
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
              Discord Community
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Live automated Now Playing embeds, 1-click in-chat song voting, spoken DJ transcripts, and creator lounges for Suno & Udio prompters.
            </p>
          </div>

          <div className="pt-6">
            <a
              href={links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-indigo-600/20"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Join Discord Server</span>
            </a>
          </div>
        </div>

        {/* Telegram Card */}
        <div className="flex flex-col justify-between p-6 rounded-2xl bg-gradient-to-b from-sky-950/30 to-zinc-900/60 border border-sky-500/20 hover:border-sky-500/40 transition-all text-left group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                <Send className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                @promptfm_live
              </span>
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
              Telegram Broadcast & Bot
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Tune into the live channel for instant drop alerts, or chat with <span className="text-sky-300 font-medium">@PromptFMLiveBot</span> for semantic vibe requests and live AI weather forecasts.
            </p>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row gap-2">
            <a
              href={links.telegramChannel}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs transition-colors shadow-lg shadow-sky-500/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Join Channel</span>
            </a>
            <a
              href={links.telegramBot}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium text-xs transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-sky-400" />
              <span>AI DJ Bot</span>
            </a>
          </div>
        </div>
      </div>

      {/* Interactive Command Reference & Scheduling Schedule Breakdown */}
      <div className="mt-8 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-left space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
              <Terminal className="w-3.5 h-3.5" />
              <span>Listener Chat Prompts & Commands</span>
            </div>
            <h4 className="text-lg font-bold text-white">How to Control the Station from Discord & Telegram</h4>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono bg-zinc-800/60 border border-zinc-700/60 px-2.5 py-1 rounded-full self-start sm:self-auto">
            Click command to copy
          </span>
        </div>

        {/* Command grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {LISTENER_COMMANDS.map((cmd) => (
            <div
              key={cmd.command}
              onClick={() => handleCopy(cmd.command)}
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/90 hover:border-emerald-500/40 hover:bg-zinc-950 transition-all cursor-pointer group"
            >
              <div className="space-y-0.5 pr-2 overflow-hidden">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono font-semibold text-emerald-400 group-hover:text-emerald-300">
                    {cmd.command}
                  </code>
                  <span className="text-[10px] text-zinc-500 font-medium px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 rounded">
                    {cmd.category}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate">{cmd.desc}</p>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-lg text-zinc-500 group-hover:text-emerald-400 transition-colors flex-shrink-0"
                aria-label={`Copy ${cmd.command}`}
              >
                {copiedCmd === cmd.command ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Programming Clock Wheel & Airplay Schedule Policy */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Airplay Clock Wheel: When Do Songs & Requests Play?</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            PromptFM broadcasts continuous 24/7 uninterrupted music with 4 recurring quarter-hour clock segments:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/60 rounded-xl space-y-1">
              <span className="font-mono text-emerald-400 font-bold">:00 – :15</span>
              <p className="font-semibold text-white text-[11px]">Top 40 Power</p>
              <p className="text-[10px] text-zinc-400 leading-snug">Highest voted community tracks from weekly charts.</p>
            </div>
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/60 rounded-xl space-y-1">
              <span className="font-mono text-emerald-400 font-bold">:15 – :30</span>
              <p className="font-semibold text-white text-[11px]">Deep Cuts</p>
              <p className="text-[10px] text-zinc-400 leading-snug">Lo-Fi, ambient soundscapes, and hidden gems.</p>
            </div>
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/60 rounded-xl space-y-1">
              <span className="font-mono text-emerald-400 font-bold">:30 – :45</span>
              <p className="font-semibold text-white text-[11px]">Rhythm Transition</p>
              <p className="text-[10px] text-zinc-400 leading-snug">High-tempo synthwave, breakbeats, and remixes.</p>
            </div>
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-1">
              <span className="font-mono text-emerald-400 font-bold">:45 – :00</span>
              <p className="font-semibold text-emerald-300 text-[11px]">Listener Showcase</p>
              <p className="text-[10px] text-zinc-300 leading-snug">
                <strong>Your time slot!</strong> Songs requested via <code className="text-emerald-300 font-mono">/song</code> take live priority.
              </p>
            </div>
          </div>

          <div className="mt-3 p-3 bg-zinc-950/40 border border-zinc-800/50 rounded-xl text-[11px] text-zinc-400 space-y-1">
            <p>
              💡 <strong className="text-zinc-200">24/7 Queueing:</strong> You can submit <code className="text-emerald-400 font-mono">/song</code> at any minute of the day. As soon as the active song finishes, the queue engine prioritizes listener submissions before returning to automated rotation.
            </p>
            <p>
              🎙️ <strong className="text-zinc-200">Shoutouts & Dedications:</strong> Dedications are collected into 15-minute batches (<span className="font-mono text-zinc-300">:00, :15, :30, :45</span>) and aired in a single consolidated spoken drop to prevent audio stream interruptions.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

