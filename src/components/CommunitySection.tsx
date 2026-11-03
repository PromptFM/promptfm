'use client';

// src/components/CommunitySection.tsx
// Visual community banner connecting listeners to Discord & Telegram channels

import React from 'react';
import { MessageSquare, Send, Bot, Radio, Users, Sparkles } from 'lucide-react';
import { getCommunityLinks } from '@/lib/community/links';

export default function CommunitySection() {
  const links = getCommunityLinks();

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
    </section>
  );
}

