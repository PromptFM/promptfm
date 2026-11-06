'use client';

// src/components/ChannelsGrid.tsx
// Responsive interactive channel switcher grid for PromptFM stations.
// Allows listeners to discover the 4 theme stations, view DJ rosters, and tune in with 1 click.

import React, { useEffect, useState } from 'react';
import { Radio, Zap, Moon, Gamepad2, Play, Volume2, ShieldCheck, Flame } from 'lucide-react';
import { OFFICIAL_CHANNELS, RadioChannel } from '@/lib/radio/channels';

interface ChannelsGridProps {
  className?: string;
}

export default function ChannelsGrid({ className = '' }: ChannelsGridProps) {
  const [activeChannelSlug, setActiveChannelSlug] = useState<string>('main');
  const [isPlayerPlaying, setIsPlayerPlaying] = useState<boolean>(false);

  useEffect(() => {
    // Read persisted channel from localStorage or URL parameter
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const channelParam = urlParams.get('channel');
        const stored = localStorage.getItem('promptfm_channel');
        const initial = channelParam || stored || 'main';
        setActiveChannelSlug(initial);
      } catch {
        // Ignore localStorage restrictions
      }
    }

    // Listen to channel changes from the bottom AudioPlayer
    const handleChannelChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ slug: string }>;
      if (customEvent.detail?.slug) {
        setActiveChannelSlug(customEvent.detail.slug);
      }
    };

    // Listen to play/pause state from the bottom AudioPlayer
    const handlePlayerState = (e: Event) => {
      const customEvent = e as CustomEvent<{ state: string }>;
      if (customEvent.detail?.state) {
        setIsPlayerPlaying(customEvent.detail.state === 'playing');
      }
    };

    window.addEventListener('promptfm:channel-changed', handleChannelChanged);
    window.addEventListener('promptfm:player-state', handlePlayerState);

    return () => {
      window.removeEventListener('promptfm:channel-changed', handleChannelChanged);
      window.removeEventListener('promptfm:player-state', handlePlayerState);
    };
  }, []);

  const handleTuneIn = (channel: RadioChannel) => {
    if (channel.isActive === false) {
      return;
    }
    setActiveChannelSlug(channel.slug);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('promptfm_channel', channel.slug);
      } catch {
        // Ignore localStorage restrictions
      }

      // Dispatch event to AudioPlayer to switch stream and start playback immediately
      window.dispatchEvent(
        new CustomEvent('promptfm:switch-channel', {
          detail: { slug: channel.slug, autoPlay: true },
        })
      );
    }
  };

  const getStationIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap':
        return <Zap className="w-5 h-5 text-purple-400" />;
      case 'Moon':
        return <Moon className="w-5 h-5 text-teal-400" />;
      case 'Gamepad2':
        return <Gamepad2 className="w-5 h-5 text-amber-400" />;
      case 'Flame':
        return <Flame className="w-5 h-5 text-rose-400" />;
      case 'Radio':
      default:
        return <Radio className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getCardTheme = (slug: string, isActive: boolean) => {
    switch (slug) {
      case 'cyberpunk':
        return isActive
          ? 'border-purple-500 bg-gradient-to-b from-purple-950/40 via-zinc-900 to-zinc-950 ring-1 ring-purple-500 shadow-[0_0_24px_rgba(168,85,247,0.25)]'
          : 'border-zinc-800 hover:border-purple-500/50 bg-zinc-900/60 hover:bg-zinc-900/90';
      case 'chillout':
        return isActive
          ? 'border-teal-400 bg-gradient-to-b from-teal-950/40 via-zinc-900 to-zinc-950 ring-1 ring-teal-400 shadow-[0_0_24px_rgba(45,212,191,0.25)]'
          : 'border-zinc-800 hover:border-teal-400/50 bg-zinc-900/60 hover:bg-zinc-900/90';
      case 'kids':
        return isActive
          ? 'border-amber-400 bg-gradient-to-b from-amber-950/40 via-zinc-900 to-zinc-950 ring-1 ring-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.25)]'
          : 'border-zinc-800 hover:border-amber-400/50 bg-zinc-900/60 hover:bg-zinc-900/90';
      case 'afterdark':
        return isActive
          ? 'border-rose-500 bg-gradient-to-b from-rose-950/40 via-zinc-900 to-zinc-950 ring-1 ring-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.25)]'
          : 'border-zinc-800 hover:border-rose-500/50 bg-zinc-900/60 hover:bg-zinc-900/90';
      case 'main':
      default:
        return isActive
          ? 'border-emerald-500 bg-gradient-to-b from-emerald-950/40 via-zinc-900 to-zinc-950 ring-1 ring-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
          : 'border-zinc-800 hover:border-emerald-500/50 bg-zinc-900/60 hover:bg-zinc-900/90';
    }
  };

  const getButtonTheme = (slug: string, isActive: boolean, isPlaying: boolean) => {
    if (isActive && isPlaying) {
      return 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20';
    }
    switch (slug) {
      case 'cyberpunk':
        return isActive
          ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
          : 'bg-zinc-800 hover:bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:border-purple-400';
      case 'chillout':
        return isActive
          ? 'bg-teal-500 hover:bg-teal-400 text-black shadow-lg shadow-teal-500/30'
          : 'bg-zinc-800 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:border-teal-400';
      case 'kids':
        return isActive
          ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/30'
          : 'bg-zinc-800 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400';
      case 'afterdark':
        return isActive
          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
          : 'bg-zinc-800 hover:bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:border-rose-400';
      case 'main':
      default:
        return isActive
          ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30'
          : 'bg-zinc-800 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400';
    }
  };

  return (
    <section id="channels" className={`w-full max-w-6xl mx-auto px-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 mb-6 sm:mb-8 text-left">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>5 LIVE THEME CHANNELS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Choose Your Radio Station
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Stream 24/7 distinct AI-generated music genres curated live by our roster of AI DJs.
            Switch with 1 click to update your live broadcast feed.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
        {OFFICIAL_CHANNELS.map((channel) => {
          const isActive = activeChannelSlug === channel.slug;
          const isCurrentChannelPlaying = isActive && isPlayerPlaying;

          return (
            <div
              key={channel.slug}
              className={`rounded-2xl p-5 border flex flex-col justify-between transition-all duration-200 text-left relative overflow-hidden ${getCardTheme(
                channel.slug,
                isActive
              )}`}
            >
              {/* Active Pulsing Indicator Badge */}
              {isActive && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>{isPlayerPlaying ? 'ON AIR' : 'SELECTED'}</span>
                </div>
              )}

              {/* Station Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center flex-shrink-0">
                    {getStationIcon(channel.icon)}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">
                      {channel.shortName}
                    </h3>
                    <p className="text-[11px] font-medium text-zinc-400">
                      {channel.badge}
                    </p>
                  </div>
                </div>

                {/* Vibe / Genre */}
                <div className="text-xs font-medium text-zinc-300 bg-zinc-800/40 rounded-lg px-2.5 py-1.5 border border-zinc-700/40">
                  {channel.vibe}
                </div>

                {/* Description */}
                <p className="text-xs text-zinc-400 leading-relaxed min-h-[3rem]">
                  {channel.description}
                </p>

                {/* DJ & Parental Rating Row */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/80">
                  <span className="font-semibold text-zinc-300 flex items-center gap-1">
                    🎙️ {channel.djName}
                  </span>
                  {channel.requiresAgeGate ? (
                    <span className="inline-flex items-center gap-0.5 text-rose-400 font-bold">
                      <Flame className="w-3 h-3" />
                      18+ Explicit
                    </span>
                  ) : channel.isFamilySafe ? (
                    <span className="inline-flex items-center gap-0.5 text-emerald-400 font-medium">
                      <ShieldCheck className="w-3 h-3" />
                      Family Safe
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-purple-400 font-medium">
                      <Flame className="w-3 h-3" />
                      16+ Cyber
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3">
                <button
                  type="button"
                  disabled={channel.isActive === false}
                  onClick={() => handleTuneIn(channel)}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    channel.isActive === false
                      ? 'bg-zinc-800/50 text-zinc-500 border border-zinc-800 cursor-not-allowed opacity-60'
                      : getButtonTheme(channel.slug, isActive, isPlayerPlaying)
                  }`}
                >
                  {channel.isActive === false ? (
                    <span>Offline (Standby)</span>
                  ) : isCurrentChannelPlaying ? (
                    <>
                      <Volume2 className="w-4 h-4 animate-pulse" />
                      <span>Listening Now</span>
                    </>
                  ) : isActive ? (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Listening</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Tune In Station</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
