'use client';

// src/components/AudioPlayer.tsx
// Sticky bottom live-stream player with active DJ indicator, Now Playing metadata,
// 1-click in-player voting, and live spoken transcript viewer.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Radio, Loader2, AlertCircle, ThumbsUp, MessageSquareQuote, ChevronUp, Flag } from 'lucide-react';
import ReportModal from '@/components/ReportModal';

// ─── Types ───────────────────────────────────────────────────────────────────

type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

interface NowPlayingInfo {
  id?: string;
  type?: string;
  title: string;
  artist: string;
  tool_used?: string;
  upvotes_count?: number;
  transcript?: string;
  active_dj?: {
    id: string;
    name: string;
    title: string;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL ?? '';
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 2000;

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Animated CSS equalizer bars — visible only while the stream is playing. */
function EqualizerBars({ playing }: { playing: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-3.5 w-7" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={[
            'w-1 rounded-sm bg-emerald-400 origin-bottom',
            playing ? 'animate-equalizer' : 'h-1',
          ].join(' ')}
          style={
            playing
              ? {
                  animationDelay: `${(i - 1) * 0.15}s`,
                  animationDuration: `${0.6 + i * 0.1}s`,
                }
              : {}
          }
        />
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Now Playing & Live Transcript State
  const [nowPlaying, setNowPlaying] = useState<NowPlayingInfo | null>(null);
  const [voted, setVoted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch('/api/radio/now');
      if (res.ok) {
        const data = await res.json();
        if (data.now_playing) {
          setNowPlaying({
            id: data.now_playing.id,
            type: data.now_playing.type,
            title: data.now_playing.title,
            artist: data.now_playing.artist,
            tool_used: data.now_playing.tool_used,
            upvotes_count: data.now_playing.upvotes_count,
            transcript: data.now_playing.transcript,
            active_dj: data.active_dj,
          });
        }
      }
    } catch {
      // Ignore network errors in background poll
    }
  }, []);

  useEffect(() => {
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 12000);
    return () => clearInterval(interval);
  }, [fetchNowPlaying]);

  // Handle in-player quick upvote
  const handleQuickVote = async () => {
    if (!nowPlaying?.id || voted) return;
    setVoted(true);
    setNowPlaying((prev) =>
      prev ? { ...prev, upvotes_count: (prev.upvotes_count || 0) + 1 } : null
    );

    try {
      await fetch('/api/bot/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query: {
            id: `web-${Date.now()}`,
            data: `vote:${nowPlaying.id}`,
            from: { id: 'web-player', first_name: 'Web Listener' },
          },
        }),
      });
    } catch (e) {
      console.warn('Failed to register quick vote:', e);
    }
  };

  // ── Audio element setup ────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = volume;
    audioRef.current = audio;

    const handleWaiting = () => setPlayerState('loading');
    const handlePlaying = () => {
      setPlayerState('playing');
      setErrorMessage(null);
      reconnectAttemptsRef.current = 0;
    };
    const handleError = () => scheduleReconnect();
    const handleEnded = () => scheduleReconnect();

    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
      audio.src = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync volume changes to the audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  // Clean up reconnect timer on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  // ── Reconnect logic ────────────────────────────────────────────────────────
  const scheduleReconnect = useCallback(() => {
    if (!audioRef.current || !STREAM_URL) return;

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setPlayerState('error');
      setErrorMessage('Unable to connect to live stream. Please try again later.');
      return;
    }

    const delay = BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttemptsRef.current;
    reconnectAttemptsRef.current += 1;

    setPlayerState('loading');
    setErrorMessage(`Reconnecting (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})…`);

    reconnectTimerRef.current = setTimeout(() => {
      if (!audioRef.current) return;
      audioRef.current.src = `${STREAM_URL}?nocache=${Date.now()}`;
      audioRef.current.load();
      audioRef.current.play().catch(() => scheduleReconnect());
    }, delay);
  }, []);

  // ── Play / Pause toggle ────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current || !STREAM_URL) return;

    if (playerState === 'playing' || playerState === 'loading') {
      audioRef.current.pause();
      audioRef.current.src = '';
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectAttemptsRef.current = 0;
      setPlayerState('idle');
      setErrorMessage(null);
    } else {
      setPlayerState('loading');
      setErrorMessage(null);
      reconnectAttemptsRef.current = 0;
      audioRef.current.src = `${STREAM_URL}?nocache=${Date.now()}`;
      audioRef.current.load();
      audioRef.current.play().catch(() => scheduleReconnect());
    }
  }, [playerState, scheduleReconnect]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (muted && val > 0) setMuted(false);
  };

  const handleMuteToggle = () => setMuted((m) => !m);

  const isPlaying = playerState === 'playing';
  const isLoading = playerState === 'loading';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className={[
          'fixed bottom-0 inset-x-0 z-50',
          'bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800',
          'px-3 py-2 sm:px-6 sm:py-2.5',
          'flex items-center justify-between gap-2 sm:gap-4',
        ].join(' ')}
        role="region"
        aria-label="Live radio player"
      >
        {/* Transcript Popover Modal */}
        {showTranscript && nowPlaying?.transcript && (
          <div className="absolute bottom-full left-3 sm:left-6 mb-2 max-w-[calc(100vw-24px)] sm:max-w-md w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl z-50 space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400">
              <span>🎙️ Spoken on Air by {nowPlaying.active_dj?.name || 'AI DJ'}</span>
              <button
                onClick={() => setShowTranscript(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-200 leading-relaxed italic">
              &ldquo;{nowPlaying.transcript}&rdquo;
            </p>
          </div>
        )}

        {/* Left: Play/Pause + station & Now Playing info */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={handlePlayPause}
            disabled={!STREAM_URL}
            aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
            className={[
              'flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center',
              'transition-all duration-200 focus-visible:outline focus-visible:outline-2',
              'focus-visible:outline-emerald-400 focus-visible:outline-offset-2',
              isPlaying
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-700 hover:bg-zinc-600 text-white',
              !STREAM_URL && 'opacity-40 cursor-not-allowed',
            ].join(' ')}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            ) : isPlaying ? (
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="3" width="4" height="18" rx="1" />
                <rect x="15" y="3" width="4" height="18" rx="1" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1 min-w-0">
                <Radio className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="text-white font-semibold text-xs sm:text-sm truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs md:max-w-sm">
                  {nowPlaying ? nowPlaying.title : 'PromptFM Live'}
                </span>
              </div>
              <div className="hidden xs:flex items-center">
                <EqualizerBars playing={isPlaying} />
              </div>
              {nowPlaying?.active_dj && (
                <span className="hidden md:inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 flex-shrink-0">
                  🎙️ {nowPlaying.active_dj.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate max-w-[120px] xs:max-w-[160px] sm:max-w-xs">
                {nowPlaying ? nowPlaying.artist : isPlaying ? '24/7 AI-generated music' : 'Click play to tune in'}
              </p>
              {nowPlaying?.transcript && (
                <button
                  type="button"
                  onClick={() => setShowTranscript((prev) => !prev)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex-shrink-0"
                >
                  <MessageSquareQuote className="w-3 h-3" />
                  <span className="hidden xs:inline">Transcript</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Upvote, Report & Volume controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {nowPlaying?.id && (
            <button
              type="button"
              onClick={handleQuickVote}
              disabled={voted}
              aria-label="Upvote currently playing track"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all border ${
                voted
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${voted ? 'text-emerald-400 fill-emerald-400' : ''}`} />
              <span className="tabular-nums">{nowPlaying.upvotes_count ?? 0}</span>
            </button>
          )}

          {/* Report button */}
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            aria-label="Report current broadcast"
            title="Report track or broadcast violation"
            className="text-zinc-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>

          {/* Volume controls (desktop & tablet) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleMuteToggle}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="text-zinc-400 hover:text-white transition-colors p-1"
            >
              {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              aria-label="Volume"
              className="hidden sm:inline-block w-20 md:w-24 h-1 rounded-full accent-emerald-400 cursor-pointer appearance-none bg-zinc-700"
            />
          </div>
        </div>
      </div>

      {/* Broadcast Report Modal */}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="broadcast"
        targetId={nowPlaying?.id || 'live-broadcast'}
        targetTitle={
          nowPlaying?.title
            ? `Airplay: "${nowPlaying.title}" by ${nowPlaying.artist}`
            : 'Live Radio Broadcast Stream'
        }
      />
    </>
  );
}
