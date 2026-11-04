'use client';

// src/components/UpNextSection.tsx
// Up Next on Air broadcast queue component for the PromptFM home and channels pages.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { ListMusic, ThumbsUp, Radio, Sparkles, Disc3 } from 'lucide-react';
import { DEFAULT_CHANNEL_SLUG, getChannelBySlug } from '@/lib/radio/channels';
import { buildQueueDisplayItems, QueueDisplayItem } from '@/lib/radio/progress';
import type { AirplayItem } from '@/lib/dj/rotation';

export type UpNextItem = QueueDisplayItem;

export default function UpNextSection() {
  const [channelSlug, setChannelSlug] = useState<string>(DEFAULT_CHANNEL_SLUG);
  const [nowPlaying, setNowPlaying] = useState<AirplayItem | null>(null);
  const [upNextList, setUpNextList] = useState<AirplayItem[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [durationSeconds, setDurationSeconds] = useState<number>(180);
  const [loading, setLoading] = useState<boolean>(true);
  const lastFetchedRef = useRef<number>(Date.now());

  const fetchUpNext = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/radio/now?channel=${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.now_playing) {
          setNowPlaying(data.now_playing);
        }
        if (Array.isArray(data.up_next)) {
          setUpNextList(data.up_next);
        }
        if (typeof data.elapsed_seconds === 'number') {
          setElapsedSeconds(data.elapsed_seconds);
          lastFetchedRef.current = Date.now();
        }
        if (typeof data.duration_seconds === 'number') {
          setDurationSeconds(data.duration_seconds);
        }
      }
    } catch {
      // Retain existing items on network hiccups
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for latest radio status
  useEffect(() => {
    fetchUpNext(channelSlug);

    const handleChannelChange = (e: Event) => {
      const custom = e as CustomEvent<{ slug: string }>;
      if (custom.detail?.slug) {
        setChannelSlug(custom.detail.slug);
        fetchUpNext(custom.detail.slug);
      }
    };

    window.addEventListener('promptfm:channel-changed', handleChannelChange);
    const interval = setInterval(() => fetchUpNext(channelSlug), 10000);

    return () => {
      window.removeEventListener('promptfm:channel-changed', handleChannelChange);
      clearInterval(interval);
    };
  }, [channelSlug, fetchUpNext]);

  // Second-by-second progress ticker for active track
  useEffect(() => {
    const tick = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        // If track duration elapsed, re-fetch immediately to progress to next track
        if (next >= durationSeconds && next % 5 === 0) {
          fetchUpNext(channelSlug);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [durationSeconds, channelSlug, fetchUpNext]);

  const channel = getChannelBySlug(channelSlug);
  const displayCards = buildQueueDisplayItems(nowPlaying, upNextList, elapsedSeconds, durationSeconds);

  return (
    <section className="w-full max-w-4xl mx-auto px-4 mt-6">
      <div className="bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ListMusic className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Up Next on Air
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                  {channel.name}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Community queued requests & top-charting tracks queued by {channel.djName}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 self-end sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Live Airplay Queue</span>
          </div>
        </div>

        {loading && displayCards.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
            <Radio className="w-4 h-4 animate-spin mr-2 text-emerald-400" />
            Loading upcoming tracks...
          </div>
        ) : displayCards.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            <Sparkles className="w-5 h-5 mx-auto mb-2 text-zinc-600" />
            No user requests in the queue — station is dynamically rotating top library tracks.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {displayCards.slice(0, 3).map((item, idx) => {
              const isCurrent = item.isCurrent;
              return (
                <div
                  key={item.id || idx}
                  className={[
                    'relative flex flex-col justify-between p-3.5 rounded-xl transition-all group overflow-hidden',
                    isCurrent
                      ? 'bg-zinc-900/90 border-2 border-emerald-500/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                      : 'bg-zinc-950/60 hover:bg-zinc-850/80 border border-zinc-800/80',
                  ].join(' ')}
                >
                  {/* Queue Position / Now Playing Pill */}
                  <span
                    className={[
                      'absolute -top-2 left-3 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1 z-10',
                      isCurrent
                        ? 'bg-emerald-500 text-black border border-emerald-400 font-extrabold'
                        : 'bg-emerald-900/80 border border-emerald-500/40 text-emerald-300',
                    ].join(' ')}
                  >
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />}
                    {item.badgeLabel}
                  </span>

                  <div className="flex items-center gap-3">
                    {/* Cover Art Preview with Spinning Disc on Active Track */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 flex-shrink-0">
                      <img
                        src={item.cover_art_url || '/logo-mark.png'}
                        alt={item.title}
                        className={[
                          'w-full h-full object-cover transition-transform duration-300',
                          isCurrent ? 'group-hover:scale-110' : 'group-hover:scale-105',
                        ].join(' ')}
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/logo-mark.png';
                        }}
                      />
                      {isCurrent && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Disc3 className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: '4s' }} />
                        </div>
                      )}
                    </div>

                    {/* Track Details */}
                    <div className="min-w-0 flex-1">
                      <h4
                        className={[
                          'text-sm font-semibold truncate transition-colors',
                          isCurrent ? 'text-emerald-300 font-bold' : 'text-white group-hover:text-emerald-400',
                        ].join(' ')}
                      >
                        {item.title}
                      </h4>
                      <p className="text-xs text-zinc-400 truncate">{item.artist}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.category && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded truncate max-w-[90px]">
                            {item.category}
                          </span>
                        )}
                        {typeof item.upvotes_count === 'number' && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400/90 font-medium ml-auto">
                            <ThumbsUp className="w-2.5 h-2.5" />
                            {item.upvotes_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active Track Progress Bar */}
                  {isCurrent && item.progressPercent !== undefined && (
                    <div className="mt-3 pt-2 border-t border-zinc-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                        <span className="text-emerald-400 font-bold">On Air Progress</span>
                        <span>{item.formattedTime}</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-linear rounded-full"
                          style={{ width: `${item.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

