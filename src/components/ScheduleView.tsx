'use client';

// src/components/ScheduleView.tsx
// Interactive 24/7 Channel Broadcast Schedule Component
// Displays 24-hour daily programming blocks, live shows, AI DJ personas, and clock wheel milestones.

import React, { useState, useEffect, useCallback } from 'react';
import { getPublicChannels, getPublicChannelBySlug, RadioChannel } from '@/lib/radio/channels';
import { formatAudioTime } from '@/lib/radio/progress';
import {
  Calendar,
  Clock,
  Radio,
  Sparkles,
  Volume2,
  Mic,
  Music,
  CloudSun,
  Megaphone,
  ShieldAlert,
  ChevronRight,
  Zap,
  Moon,
  Gamepad2,
  Flame,
  Disc3,
  ThumbsUp,
} from 'lucide-react';
import type { StationSchedule, ScheduleBlock } from '@/lib/radio/schedule';

interface ScheduleViewProps {
  initialChannelSlug?: string;
  onTuneIn?: (channel: RadioChannel) => void;
}

interface ScheduleWithNowPlaying extends StationSchedule {
  now_playing?: {
    id: string;
    title: string;
    artist: string;
    cover_art_url?: string;
    category?: string;
    tool_used?: string;
    upvotes_count?: number;
    elapsed_seconds?: number;
    duration_seconds?: number;
    rank?: number | null;
  };
}

export default function ScheduleView({ initialChannelSlug = 'main', onTuneIn }: ScheduleViewProps) {
  const [activeSlug, setActiveSlug] = useState<string>(initialChannelSlug);
  const [schedule, setSchedule] = useState<ScheduleWithNowPlaying | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [localTimeZone, setLocalTimeZone] = useState<string>('UTC');
  const [currentTimeUtc, setCurrentTimeUtc] = useState<string>('');
  const [currentMinuteUtc, setCurrentMinuteUtc] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [durationSeconds, setDurationSeconds] = useState<number>(180);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setLocalTimeZone(tz);
    } catch {
      // Fallback to UTC
    }

    const updateClock = () => {
      const now = new Date();
      setCurrentMinuteUtc(now.getUTCMinutes());
      setCurrentTimeUtc(
        now.toLocaleTimeString('en-US', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }) + ' UTC'
      );
    };

    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  const fetchSchedule = useCallback(async (slug: string, isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch(`/api/radio/schedule?channel=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.success) {
        setSchedule(data);
        if (typeof data.now_playing?.elapsed_seconds === 'number') {
          setElapsedSeconds(data.now_playing.elapsed_seconds);
        }
        if (typeof data.now_playing?.duration_seconds === 'number') {
          setDurationSeconds(data.now_playing.duration_seconds);
        }
      }
    } catch (err) {
      console.error('Failed to load channel schedule:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Poll schedule every 12 seconds
  useEffect(() => {
    fetchSchedule(activeSlug, true);
    const interval = setInterval(() => fetchSchedule(activeSlug, false), 12000);

    const handleChannelChange = (e: Event) => {
      const custom = e as CustomEvent<{ slug: string }>;
      if (custom.detail?.slug) {
        setActiveSlug(custom.detail.slug);
        fetchSchedule(custom.detail.slug, true);
      }
    };

    window.addEventListener('promptfm:channel-changed', handleChannelChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('promptfm:channel-changed', handleChannelChange);
    };
  }, [activeSlug, fetchSchedule]);

  // Live second-by-second on-air track progress ticker
  useEffect(() => {
    const tick = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= durationSeconds && next % 5 === 0) {
          fetchSchedule(activeSlug, false);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [durationSeconds, activeSlug, fetchSchedule]);

  const publicChannels = getPublicChannels();
  const activeChannel = getPublicChannelBySlug(activeSlug);

  const getChannelIcon = (slug: string) => {
    switch (slug) {
      case 'cyberpunk':
        return <Zap className="w-4 h-4 text-purple-400" />;
      case 'chillout':
        return <Moon className="w-4 h-4 text-teal-400" />;
      case 'kids':
        return <Gamepad2 className="w-4 h-4 text-amber-400" />;
      case 'afterdark':
        return <Flame className="w-4 h-4 text-red-400" />;
      case 'main':
      default:
        return <Radio className="w-4 h-4 text-emerald-400" />;
    }
  };

  /**
   * Formats a UTC hour block into user local time format.
   */
  const formatLocalTime = (startHourUtc: number, endHourUtc: number) => {
    try {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), startHourUtc, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), endHourUtc, 0));

      const formatOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      };

      const startLocal = start.toLocaleTimeString([], formatOptions);
      const endLocal = end.toLocaleTimeString([], formatOptions);
      return `${startLocal} - ${endLocal} Local`;
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Timezone Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-emerald-400" />
            24/7 Broadcast Schedule
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Continuous 24/7 AI-generated music, uninterrupted soundscapes, and community charts.
          </p>
        </div>

        {/* Live Clock & Timezone Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-white font-semibold">{currentTimeUtc || 'UTC'}</span>
          <span className="text-zinc-500">|</span>
          <span className="text-zinc-400 truncate max-w-[140px]" title={localTimeZone}>
            {localTimeZone}
          </span>
        </div>
      </div>

      {/* Channel Switcher Tabs */}
      {publicChannels.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {publicChannels.map((ch) => {
            const isActive = ch.slug === activeSlug;
            return (
              <button
                key={ch.slug}
                type="button"
                onClick={() => setActiveSlug(ch.slug)}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 border',
                  isActive
                    ? 'bg-zinc-800 text-white border-emerald-500/50 shadow-md shadow-emerald-500/10'
                    : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800/60',
                ].join(' ')}
              >
                {getChannelIcon(ch.slug)}
                <span>{ch.shortName}</span>
                {ch.badge && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-zinc-800/80 rounded text-zinc-300">
                    {ch.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Channel Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                {activeChannel.name}
              </span>
              {!activeChannel.isFamilySafe && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-red-950/80 text-red-400 border border-red-800/50 px-1.5 py-0.5 rounded font-semibold">
                  <ShieldAlert className="w-3 h-3" /> 18+
                </span>
              )}
            </div>
            <p className="text-sm sm:text-base font-semibold text-white">{activeChannel.vibe}</p>
            <p className="text-xs text-zinc-400 max-w-xl">{activeChannel.description}</p>
          </div>

          {onTuneIn && (
            <button
              type="button"
              onClick={() => onTuneIn(activeChannel)}
              className="self-start sm:self-auto flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors shadow-lg shadow-emerald-500/20"
            >
              <Volume2 className="w-4 h-4" />
              <span>Tune In Channel</span>
            </button>
          )}
        </div>
      </div>

      {/* Schedule Content */}
      {loading ? (
        <div className="py-16 text-center text-zinc-500 space-y-2">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium">Loading 24-hour broadcast schedule...</p>
        </div>
      ) : schedule ? (
        <div className="space-y-6">
          {/* Active Live Show Highlight */}
          {schedule.current_show && (
            <div className="p-5 rounded-2xl bg-zinc-900 border-2 border-emerald-500/40 shadow-xl shadow-emerald-500/5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500 text-black text-xs font-black tracking-wide uppercase">
                  <span className="w-2 h-2 rounded-full bg-black animate-ping" />
                  Live On Air Now
                </span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  {schedule.current_show.time_utc} • {formatLocalTime(schedule.current_show.start_hour_utc, schedule.current_show.end_hour_utc)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Show Details */}
                <div className="md:col-span-2 space-y-2">
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    {schedule.current_show.show}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300">
                    <span className="text-zinc-500 font-medium">Genre: </span>
                    {schedule.current_show.genre}
                  </p>
                  <p className="text-xs text-zinc-400 italic">
                    &ldquo;{schedule.current_show.dj_prompt_style}&rdquo;
                  </p>

                  {/* AI Tools Badges */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-zinc-500">Models:</span>
                    {schedule.current_show.ai_tools.map((tool) => (
                      <span
                        key={tool}
                        className="text-[10px] font-medium bg-zinc-800 text-emerald-300 border border-zinc-700 px-2 py-0.5 rounded-md"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Host DJ Profile */}
                <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                      {schedule.current_show.dj.name.replace('DJ ', '')[0]}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{schedule.current_show.dj.name}</h4>
                      <p className="text-[10px] text-zinc-400 truncate">{schedule.current_show.dj.title}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed">
                    {schedule.current_show.dj.bio}
                  </p>
                  <div className="text-[10px] text-zinc-500 font-mono pt-1">
                    Voice: {schedule.current_show.dj.voice.name}
                  </div>
                </div>
              </div>

              {/* Currently Playing Track on Air with Live Progress Bar */}
              {schedule.now_playing && schedule.now_playing.title && (
                <div className="p-3.5 bg-zinc-950/80 border border-emerald-500/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <Disc3 className="w-4 h-4 animate-spin text-emerald-400" />
                      Now On Air
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {formatAudioTime(elapsedSeconds)} / {formatAudioTime(durationSeconds)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <img
                      src={schedule.now_playing.cover_art_url || '/logo-mark.png'}
                      alt={schedule.now_playing.title}
                      className="w-10 h-10 rounded-lg object-cover border border-zinc-800"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/logo-mark.png';
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-white truncate">{schedule.now_playing.title}</h4>
                      <p className="text-xs text-zinc-400 truncate">{schedule.now_playing.artist}</p>
                    </div>
                    {schedule.now_playing.rank && (
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                        #{schedule.now_playing.rank} Chart Rank
                      </span>
                    )}
                  </div>

                  {/* Progress Line */}
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${Math.min(100, Math.round((elapsedSeconds / durationSeconds) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Hourly Clock Wheel Milestones */}
              <div className="pt-2 border-t border-zinc-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Hourly Clock Wheel Cadence (:00 to :59)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {schedule.current_show.clock_milestones.map((m) => {
                    const currentMin = currentMinuteUtc;
                    const isMilestoneActive =
                      currentMin !== null &&
                      currentMin >= m.minute &&
                      (currentMin < m.minute + 15 || (m.minute === 45 && currentMin >= 45));

                    return (
                      <div
                        key={m.minute}
                        className={`p-2 rounded-lg text-xs space-y-0.5 transition-all ${
                          isMilestoneActive
                            ? 'bg-emerald-950/40 border-2 border-emerald-500 shadow-sm shadow-emerald-950/50'
                            : 'bg-zinc-950/60 border border-zinc-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <div className="flex items-center gap-1 text-emerald-400">
                            <span>:{String(m.minute).padStart(2, '0')}</span>
                            {m.type === 'music' && <Music className="w-3 h-3 text-emerald-400" />}
                            {m.type === 'news' && <Radio className="w-3 h-3 text-sky-400" />}
                            {m.type === 'weather' && <CloudSun className="w-3 h-3 text-amber-400" />}
                            {m.type === 'ad' && <Sparkles className="w-3 h-3 text-purple-400" />}
                            {m.type === 'dj_banter' && <Mic className="w-3 h-3 text-emerald-400" />}
                          </div>
                          {isMilestoneActive && (
                            <span className="inline-flex items-center gap-1 px-1 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                              <span className="w-1 h-1 rounded-full bg-emerald-400" />
                              Live
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] font-medium truncate ${isMilestoneActive ? 'text-emerald-300' : 'text-white'}`}>
                          {m.title}
                        </p>
                        <p className={`text-[10px] line-clamp-1 ${isMilestoneActive ? 'text-zinc-200' : 'text-zinc-400'}`}>
                          {m.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Full 24-Hour Programming Timeline */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Full 24-Hour Schedule Breakdown
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {schedule.blocks.map((block) => (
                <div
                  key={block.id}
                  className={[
                    'p-4 rounded-xl border transition-colors',
                    block.is_live
                      ? 'bg-zinc-900 border-emerald-500/50'
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700',
                  ].join(' ')}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                        {block.time_utc}
                      </span>
                      <span className="text-xs text-zinc-400">
                        ({formatLocalTime(block.start_hour_utc, block.end_hour_utc)})
                      </span>
                      {block.is_live && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-500 text-black px-1.5 py-0.2 rounded">
                          Now Airing
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                      <Mic className="w-3 h-3 text-zinc-500" /> Host: {block.dj.name}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-white">{block.show}</h4>
                      <p className="text-xs text-zinc-300">
                        <span className="text-zinc-500">Theme: </span>
                        {block.genre}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                      {block.ai_tools.map((tool) => (
                        <span
                          key={tool}
                          className="text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

