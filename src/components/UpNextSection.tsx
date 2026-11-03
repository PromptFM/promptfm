'use client';

// src/components/UpNextSection.tsx
// Up Next on Air broadcast queue component for the PromptFM home and channels pages.

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { ListMusic, ThumbsUp, Radio, Sparkles } from 'lucide-react';
import { DEFAULT_CHANNEL_SLUG, getChannelBySlug } from '@/lib/radio/channels';

export interface UpNextItem {
  id: string;
  type: string;
  title: string;
  artist: string;
  cover_art_url?: string;
  category?: string;
  tool_used?: string;
  upvotes_count?: number;
}

export default function UpNextSection() {
  const [channelSlug, setChannelSlug] = useState<string>(DEFAULT_CHANNEL_SLUG);
  const [upNextList, setUpNextList] = useState<UpNextItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUpNext = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/radio/now?channel=${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.up_next)) {
          setUpNextList(data.up_next);
        }
      }
    } catch {
      // Retain existing items on network hiccups
    } finally {
      setLoading(false);
    }
  }, []);

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
    const interval = setInterval(() => fetchUpNext(channelSlug), 20000);

    return () => {
      window.removeEventListener('promptfm:channel-changed', handleChannelChange);
      clearInterval(interval);
    };
  }, [channelSlug, fetchUpNext]);

  const channel = getChannelBySlug(channelSlug);

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

        {loading && upNextList.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
            <Radio className="w-4 h-4 animate-spin mr-2 text-emerald-400" />
            Loading upcoming tracks...
          </div>
        ) : upNextList.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            <Sparkles className="w-5 h-5 mx-auto mb-2 text-zinc-600" />
            No user requests in the queue — station is dynamically rotating top library tracks.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {upNextList.slice(0, 3).map((item, idx) => (
              <div
                key={item.id || idx}
                className="relative flex items-center gap-3 p-3 bg-zinc-950/60 hover:bg-zinc-850/80 border border-zinc-800/80 rounded-xl transition-all group"
              >
                {/* Queue Position Pill */}
                <span className="absolute -top-2 left-3 bg-emerald-900/80 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 px-1.5 py-0.2 rounded-md shadow-sm">
                  #{idx + 1} NEXT
                </span>

                {/* Cover Art Preview */}
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 flex-shrink-0">
                  <img
                    src={item.cover_art_url || '/logo-mark.png'}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/logo-mark.png';
                    }}
                  />
                </div>

                {/* Track Details */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
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
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
