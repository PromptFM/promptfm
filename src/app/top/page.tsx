'use client';

// src/app/top/page.tsx
// Weekly Top 20 chart — sorted by upvotes_count DESC.
// Features:
//   • Server-fetched initial data (hydrated by a parent Server Component wrapper).
//   • Optimistic UI voting — the count updates instantly in the browser.
//   • Inline 30-second preview player per track.
//   • Visual rank badges for positions 1–3.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronUp,
  Play,
  Pause,
  Trophy,
  Music2,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { RankedTrack, AITool } from '@/types/database';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOOL_COLORS: Record<AITool, string> = {
  Suno: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Udio: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Stable Audio': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Other: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
};

const RANK_STYLES: Record<number, string> = {
  1: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  2: 'text-zinc-300 bg-zinc-300/10 border-zinc-300/30',
  3: 'text-amber-600 bg-amber-600/10 border-amber-600/30',
};

// ─── Inline preview player hook ──────────────────────────────────────────────

function usePreviewPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Stop after 30 seconds
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = useCallback((trackId: string, url: string) => {
    // Stop whatever is currently playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (timerRef.current) clearTimeout(timerRef.current);

    if (playingId === trackId) {
      // Toggle off
      setPlayingId(null);
      return;
    }

    setLoadingId(trackId);
    const audio = new Audio(url);
    audio.volume = 0.8;

    audio.addEventListener('playing', () => {
      setPlayingId(trackId);
      setLoadingId(null);
      timerRef.current = setTimeout(() => {
        audio.pause();
        setPlayingId(null);
      }, 30_000);
    });

    audio.addEventListener('error', () => {
      setLoadingId(null);
      setPlayingId(null);
    });

    audioRef.current = audio;
    audio.play().catch(() => {
      setLoadingId(null);
      setPlayingId(null);
    });
  }, [playingId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { playingId, loadingId, play };
}

// ─── Track Row Component ──────────────────────────────────────────────────────

interface TrackRowProps {
  track: RankedTrack;
  rank: number;
  onVote: (trackId: string) => void;
  isVoting: boolean;
  playingId: string | null;
  loadingId: string | null;
  onPlay: (trackId: string, url: string) => void;
}

function TrackRow({
  track,
  rank,
  onVote,
  isVoting,
  playingId,
  loadingId,
  onPlay,
}: TrackRowProps) {
  const rankStyle = RANK_STYLES[rank] ?? 'text-zinc-500 bg-zinc-800/50 border-zinc-700/50';
  const toolStyle = TOOL_COLORS[track.tool_used] ?? TOOL_COLORS['Other'];
  const isPlaying = playingId === track.id;
  const isLoading = loadingId === track.id;

  return (
    <div
      className={[
        'flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl border transition-colors',
        'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
      ].join(' ')}
    >
      {/* Rank badge */}
      <div
        className={[
          'flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center',
          'text-sm font-bold tabular-nums',
          rankStyle,
        ].join(' ')}
      >
        {rank <= 3 ? <Trophy className="w-4 h-4" /> : rank}
      </div>

      {/* Preview play button */}
      <button
        onClick={() => onPlay(track.id, track.audio_url)}
        aria-label={isPlaying ? `Pause preview of ${track.title}` : `Play 30s preview of ${track.title}`}
        className={[
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          'transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400',
          isPlaying
            ? 'bg-emerald-500 text-black'
            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300',
        ].join(' ')}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5 translate-x-[1px]" />
        )}
      </button>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm truncate">{track.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-zinc-400 truncate">{track.artist_name}</span>
          <span
            className={[
              'flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
              toolStyle,
            ].join(' ')}
          >
            {track.tool_used}
          </span>
        </div>
      </div>

      {/* Vote button */}
      <button
        onClick={() => onVote(track.id)}
        disabled={isVoting}
        aria-label={
          track.user_has_voted
            ? `Remove vote from ${track.title}`
            : `Vote for ${track.title}`
        }
        className={[
          'flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border',
          'text-xs font-bold tabular-nums transition-all focus-visible:outline',
          'focus-visible:outline-2 focus-visible:outline-emerald-400',
          isVoting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          track.user_has_voted
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10'
            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white',
        ].join(' ')}
      >
        <ChevronUp
          className={[
            'w-4 h-4 transition-transform',
            track.user_has_voted ? 'text-emerald-400' : '',
          ].join(' ')}
        />
        {track.upvotes_count}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TopPage() {
  const [tracks, setTracks] = useState<RankedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const { playingId, loadingId, play } = usePreviewPlayer();

  const supabase = createClient();

  // ── Initial data fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchTracks() {
      setLoading(true);

      // Fetch top 20 approved tracks
      const { data: trackData, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('status', 'approved')
        .order('upvotes_count', { ascending: false })
        .limit(20);

      if (error || !trackData || cancelled) {
        setLoading(false);
        return;
      }

      // Fetch the current user's votes in parallel
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let userVotedIds = new Set<string>();

      if (user) {
        const { data: voteData } = await supabase
          .from('votes')
          .select('track_id')
          .eq('user_id', user.id)
          .in(
            'track_id',
            trackData.map((t) => t.id),
          );

        userVotedIds = new Set((voteData ?? []).map((v) => v.track_id as string));
      }

      if (!cancelled) {
        setTracks(
          trackData.map((t) => ({
            ...t,
            user_has_voted: userVotedIds.has(t.id as string),
          })) as RankedTrack[],
        );
        setLoading(false);
      }
    }

    fetchTracks();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Optimistic voting ──────────────────────────────────────────────────────
  const handleVote = useCallback(
    async (trackId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Surface a sign-in prompt — implement auth flow as needed
        alert('Please sign in to vote.');
        return;
      }

      if (votingId) return;
      setVotingId(trackId);

      const track = tracks.find((t) => t.id === trackId);
      if (!track) {
        setVotingId(null);
        return;
      }

      const isVoted = track.user_has_voted;

      // ── Optimistic update ──────────────────────────────────────────────────
      setTracks((prev) =>
        prev
          .map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  user_has_voted: !isVoted,
                  upvotes_count: isVoted
                    ? Math.max(t.upvotes_count - 1, 0)
                    : t.upvotes_count + 1,
                }
              : t,
          )
          .sort((a, b) => b.upvotes_count - a.upvotes_count),
      );

      // ── Actual DB mutation ─────────────────────────────────────────────────
      if (isVoted) {
        await supabase
          .from('votes')
          .delete()
          .eq('user_id', user.id)
          .eq('track_id', trackId);
      } else {
        await supabase
          .from('votes')
          .insert({ user_id: user.id, track_id: trackId });
      }

      setVotingId(null);
    },
    [supabase, tracks, votingId],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-28">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Music2 className="w-6 h-6 text-emerald-400" />
            <h1 className="text-3xl font-bold tracking-tight">Weekly Top 20</h1>
          </div>
          <p className="text-zinc-400 text-sm">
            Community-voted AI music chart — updated in real time.
          </p>
        </div>

        {/* Chart */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Music2 className="w-12 h-12 text-zinc-700" />
            <p className="text-zinc-400">No approved tracks yet.</p>
            <a
              href="/submit"
              className="text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
            >
              Be the first to submit →
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                rank={index + 1}
                onVote={handleVote}
                isVoting={votingId === track.id}
                playingId={playingId}
                loadingId={loadingId}
                onPlay={play}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
