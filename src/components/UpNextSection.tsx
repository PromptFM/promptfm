'use client';

// src/components/UpNextSection.tsx
// Up Next on Air broadcast queue component for the PromptFM home and channels pages.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { ListMusic, ThumbsUp, Radio, Sparkles, Disc3 } from 'lucide-react';
import { DEFAULT_CHANNEL_SLUG, getChannelBySlug } from '@/lib/radio/channels';
import {
  buildQueueDisplayItems,
  getQueueDisplayMode,
  QueueDisplayItem,
} from '@/lib/radio/progress';
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
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchUpNext(channelSlug);
    }, 10000);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchUpNext(channelSlug);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      window.removeEventListener('promptfm:channel-changed', handleChannelChange);
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
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
  const queueMode = getQueueDisplayMode(nowPlaying, upNextList);

  return (
    <section className="w-full max-w-4xl mx-auto px-4 mt-6" aria-label="Live airplay and broadcast queue">
      <div className="bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ListMusic className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {queueMode === 'now-playing-only' ? 'Now on Air' : queueMode === 'active-queue' ? 'Up Next on Air' : 'Broadcast Queue'}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                  {channel.name}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                {queueMode === 'now-playing-only'
                  ? `Currently playing on ${channel.name}. Next track will be auto-selected from the community library by ${channel.djName}.`
                  : queueMode === 'active-queue'
                  ? `Community queued requests & top-charting tracks queued by ${channel.djName}.`
                  : `Automated broadcast rotation curated by ${channel.djName}.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 self-end sm:self-auto" aria-live="polite">
            {queueMode === 'active-queue' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Airplay Queue</span>
              </>
            ) : queueMode === 'now-playing-only' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Live Airplay &bull; Queue Standing By</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                <span>Queue Inactive</span>
              </>
            )}
          </div>
        </div>

        {loading && displayCards.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 text-sm" role="status" aria-live="polite">
            <Radio className="w-4 h-4 animate-spin mr-2 text-emerald-400" aria-hidden="true" />
            Loading upcoming tracks...
          </div>
        ) : queueMode === 'empty' ? (
          <div className="text-center py-8 text-zinc-500 text-sm" data-testid="queue-empty-message">
            <Sparkles className="w-5 h-5 mx-auto mb-2 text-zinc-600" aria-hidden="true" />
            No user requests in the queue &mdash; station is dynamically rotating top library tracks.
          </div>
        ) : queueMode === 'now-playing-only' ? (
          /* Collapsed balanced 2-column layout when only now playing exists */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayCards.slice(0, 1).map((item) => (
              <article
                key={item.id}
                aria-label={`Currently playing: ${item.title} by ${item.artist}`}
                className="flex flex-col justify-between p-4 rounded-xl transition-all group bg-zinc-900/95 border-2 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40"
              >
                {/* Card Status Banner Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5 uppercase tracking-wide bg-emerald-500 text-black border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                    {item.badgeLabel}
                  </span>

                  <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ON AIR
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 flex-shrink-0">
                    <img
                      src={item.cover_art_url || '/logo-mark.png'}
                      alt={`${item.title} cover art`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/logo-mark.png';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Disc3 className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: '4s' }} aria-hidden="true" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="text-sm font-semibold truncate transition-colors text-emerald-300 font-bold">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate">{item.artist}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.category && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded truncate max-w-[90px]">
                          {item.category}
                        </span>
                      )}
                      {typeof item.upvotes_count === 'number' && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400/90 font-medium ml-auto">
                          <ThumbsUp className="w-2.5 h-2.5" aria-hidden="true" />
                          {item.upvotes_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {item.progressPercent !== undefined && (
                  <div className="mt-3 pt-2 border-t border-zinc-800/80 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                      <span className="text-emerald-400 font-bold">On Air Progress</span>
                      <span>{item.formattedTime}</span>
                    </div>
                    <div
                      className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={item.progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Track playback progress"
                    >
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-linear rounded-full"
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </article>
            ))}

            {/* Queue Standing By Status Card */}
            <div
              className="flex flex-col justify-between p-4 rounded-xl bg-zinc-950/70 border border-dashed border-zinc-800 text-left"
              data-testid="queue-standing-by-card"
              role="region"
              aria-label="Upcoming queue status"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                  Queue Standing By
                </span>
                <span className="text-[10px] font-mono text-zinc-500 font-medium">Auto-Rotation</span>
              </div>

              <div className="space-y-1.5 my-auto">
                <h3 className="text-sm font-semibold text-zinc-300">No upcoming tracks queued</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  The station will automatically spin the next high-ranking track from the community library when this song ends.
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <a
                  href="/top"
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors focus:outline-none focus:underline"
                >
                  Vote on tracks &rarr;
                </a>
                <a
                  href="/submit"
                  className="text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus:underline"
                >
                  Submit a track
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${displayCards.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3.5`}>
            {displayCards.slice(0, 3).map((item, idx) => {
              const isCurrent = item.isCurrent;
              return (
                <article
                  key={item.id || idx}
                  aria-label={isCurrent ? `Currently playing: ${item.title} by ${item.artist}` : `Upcoming track ${item.badgeLabel}: ${item.title} by ${item.artist}`}
                  className={[
                    'flex flex-col justify-between p-4 rounded-xl transition-all group',
                    isCurrent
                      ? 'bg-zinc-900/95 border-2 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                      : 'bg-zinc-950/70 hover:bg-zinc-900/80 border border-zinc-800/80',
                  ].join(' ')}
                >
                  {/* Card Status Banner Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={[
                        'text-[11px] font-black px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5 uppercase tracking-wide',
                        isCurrent
                          ? 'bg-emerald-500 text-black border border-emerald-300'
                          : 'bg-emerald-950/90 border border-emerald-500/40 text-emerald-300',
                      ].join(' ')}
                    >
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />}
                      {item.badgeLabel}
                    </span>

                    {isCurrent ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ON AIR
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-500 font-medium">
                        Upcoming
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Cover Art Preview with Spinning Disc on Active Track */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 flex-shrink-0">
                      <img
                        src={item.cover_art_url || '/logo-mark.png'}
                        alt={`${item.title} cover art`}
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
                          <Disc3 className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: '4s' }} aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    {/* Track Details */}
                    <div className="min-w-0 flex-1 text-left">
                      <h3
                        className={[
                          'text-sm font-semibold truncate transition-colors',
                          isCurrent ? 'text-emerald-300 font-bold' : 'text-white group-hover:text-emerald-400',
                        ].join(' ')}
                      >
                        {item.title}
                      </h3>
                      <p className="text-xs text-zinc-400 truncate">{item.artist}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.category && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded truncate max-w-[90px]">
                            {item.category}
                          </span>
                        )}
                        {typeof item.upvotes_count === 'number' && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400/90 font-medium ml-auto">
                            <ThumbsUp className="w-2.5 h-2.5" aria-hidden="true" />
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
                      <div
                        className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={item.progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Track playback progress"
                      >
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-linear rounded-full"
                          style={{ width: `${item.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

