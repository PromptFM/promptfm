'use client';

// src/app/library/page.tsx
// Public Song Library: Listeners can browse the approved catalog, preview tracks for 15 seconds,
// vote for songs, and enqueue tracks for live broadcast airplay.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, ChevronUp, Plus, Search, Loader2, Music2 } from 'lucide-react';
import type { PublicCatalogItem, PublicCatalogResponse } from '@/lib/library/public-catalog';

export const dynamic = 'force-dynamic';

export default function PublicLibraryPage() {
  const [tracks, setTracks] = useState<PublicCatalogItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<string>('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCatalog = useCallback(async (targetPage: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: '20',
      });
      if (q.trim()) {
        params.set('q', q.trim());
      }
      const res = await fetch(`/api/library?${params.toString()}`);
      if (res.ok) {
        const data: PublicCatalogResponse = await res.json();
        setTracks(data.items || []);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
        setHasNext(Boolean(data.hasNext));
        setTotal(data.total || 0);

        // Pre-populate vote counts
        setVoteCounts((prev) => {
          const next = { ...prev };
          for (const item of data.items || []) {
            if (next[item.id] === undefined) {
              next[item.id] = item.upvotesCount;
            }
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to load library catalog:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog(page, activeQuery);
  }, [fetchCatalog, page, activeQuery]);

  // Audio preview cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleTogglePreview = (track: PublicCatalogItem) => {
    if (playingId === track.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setPlayingId(track.id);

    try {
      const audio = new Audio(track.audioUrl);
      audioRef.current = audio;
      audio.volume = 0.8;
      audio.play().catch(() => {
        // Ignored in test environments or autoplay restricted contexts
      });

      const seconds = track.previewSeconds || 15;
      timerRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        setPlayingId(null);
      }, seconds * 1000);
    } catch {
      // Audio unsupported context
    }
  };

  const handleVote = async (track: PublicCatalogItem) => {
    if (votedIds.has(track.id)) return;

    // Optimistic update
    setVotedIds((prev) => new Set(prev).add(track.id));
    setVoteCounts((prev) => ({
      ...prev,
      [track.id]: (prev[track.id] ?? track.upvotesCount) + 1,
    }));

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.upvotes_count === 'number') {
          setVoteCounts((prev) => ({
            ...prev,
            [track.id]: data.upvotes_count,
          }));
        }
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const handleQueue = async (track: PublicCatalogItem) => {
    try {
      const res = await fetch('/api/library/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQueuedIds((prev) => new Set(prev).add(track.id));
        setToastMessage(data.message || `Queued ${track.title}`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setToastMessage(data.error || 'Could not queue track.');
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err) {
      console.error('Queue request failed:', err);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveQuery(searchQuery);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <Music2 className="w-3.5 h-3.5" />
            Station Catalog
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Song Library
          </h1>
          <p className="text-sm sm:text-base text-zinc-300 max-w-2xl">
            Explore all {total > 0 ? `${total} ` : ''}approved AI tracks in the PromptFM catalog.
            Listen to 15-second audio previews, vote for your favorites, and queue tracks for live airplay.
          </p>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-sm font-medium shadow-lg transition-all"
          >
            {toastMessage}
          </div>
        )}

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="library-search" className="sr-only">
              Search the library
            </label>
            <input
              id="library-search"
              type="text"
              aria-label="Search the library"
              placeholder="Search by title or artist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>
        </form>

        {/* Track Grid / List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-sm">Loading library catalog...</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="py-16 text-center space-y-2 border border-dashed border-zinc-800 rounded-2xl p-8">
            <p className="text-lg font-medium text-zinc-300">No tracks found</p>
            <p className="text-sm text-zinc-400">
              Try adjusting your search terms or clearing filters to browse the full catalog.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tracks.map((track) => {
              const isPlaying = playingId === track.id;
              const hasVoted = votedIds.has(track.id);
              const isQueued = queuedIds.has(track.id);
              const currentVotes = voteCounts[track.id] ?? track.upvotesCount;

              return (
                <div
                  key={track.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700/80 transition-colors"
                >
                  {/* Track Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      aria-label={`Preview ${track.title} for ${track.previewSeconds} seconds`}
                      aria-pressed={isPlaying}
                      onClick={() => handleTogglePreview(track)}
                      className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                        isPlaying
                          ? 'bg-emerald-500 text-zinc-950 ring-2 ring-emerald-400'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                      }`}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current translate-x-0.5" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-base truncate">
                          {track.title}
                        </span>
                        {track.toolUsed && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                            {track.toolUsed}
                          </span>
                        )}
                        {track.category && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
                            {track.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate">
                        {track.artistName || 'Unknown AI Artist'}
                      </p>
                    </div>
                  </div>

                  {/* Actions (Vote & Queue) */}
                  <div className="flex items-center gap-2.5 sm:self-center self-end flex-shrink-0">
                    {/* Vote Button */}
                    <button
                      type="button"
                      aria-label={`Vote for ${track.title}`}
                      aria-pressed={hasVoted}
                      onClick={() => handleVote(track)}
                      disabled={hasVoted}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                        hasVoted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/70'
                      }`}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>{currentVotes}</span>
                    </button>

                    {/* Add to Queue Button */}
                    <button
                      type="button"
                      aria-label={`Add ${track.title} to queue`}
                      onClick={() => handleQueue(track)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                        isQueued
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-600/40'
                          : 'bg-zinc-800 hover:bg-emerald-500 hover:text-zinc-950 text-zinc-200 border border-zinc-700/70'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isQueued ? 'Queued' : 'Add to queue'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-750 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            Previous
          </button>

          <span className="text-xs text-zinc-400">
            Page {page} of {totalPages || 1}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-750 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
