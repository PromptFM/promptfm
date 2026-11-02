'use client';

// src/components/AudioPlayer.tsx
// Sticky bottom live-stream player.
// – Connects to the Icecast/AzuraCast mount URL from NEXT_PUBLIC_STREAM_URL.
// – CSS-animated equalizer visualizer when playing.
// – Volume + mute controls.
// – Automatic reconnect with exponential back-off on stream error.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Radio, Loader2, AlertCircle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

// ─── Constants ───────────────────────────────────────────────────────────────

const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL ?? '';
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 2000;

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Animated CSS equalizer bars — visible only while the stream is playing. */
function EqualizerBars({ playing }: { playing: boolean }) {
  return (
    <div
      className="flex items-end gap-[2px] h-4 w-8"
      aria-hidden="true"
    >
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

  // ── Reconnect logic ────────────────────────────────────────────────────────
  const scheduleReconnect = useCallback(() => {
    const attempts = reconnectAttemptsRef.current;

    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      setPlayerState('error');
      setErrorMessage('Stream unavailable. Click to retry.');
      return;
    }

    setPlayerState('loading');
    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, attempts);
    setErrorMessage(`Reconnecting… (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    reconnectAttemptsRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      if (audioRef.current) {
        // Append a cache-busting query param to force a fresh connection
        audioRef.current.src = `${STREAM_URL}?t=${Date.now()}`;
        audioRef.current.load();
        audioRef.current.play().catch(() => scheduleReconnect());
      }
    }, delay);
  }, []);

  // ── Play / Pause toggle ────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playerState === 'error') {
      // Manual retry
      reconnectAttemptsRef.current = 0;
      setErrorMessage(null);
    }

    if (playerState === 'playing') {
      audio.pause();
      audio.src = '';
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      setPlayerState('idle');
    } else {
      setPlayerState('loading');
      audio.src = `${STREAM_URL}?t=${Date.now()}`;
      audio.load();
      audio.play().catch(() => scheduleReconnect());
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
    <div
      className={[
        'fixed bottom-0 inset-x-0 z-50',
        'bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800',
        'flex items-center justify-between gap-4 px-4 py-3 sm:px-6',
      ].join(' ')}
      role="region"
      aria-label="Live radio player"
    >
      {/* Left: Play/Pause + station info */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={handlePlayPause}
          disabled={!STREAM_URL}
          aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
          className={[
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            'transition-all duration-200 focus-visible:outline focus-visible:outline-2',
            'focus-visible:outline-emerald-400 focus-visible:outline-offset-2',
            isPlaying
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
              : 'bg-zinc-700 hover:bg-zinc-600 text-white',
            !STREAM_URL && 'opacity-40 cursor-not-allowed',
          ].join(' ')}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isPlaying ? (
            // Pause icon (two bars)
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="5" y="3" width="4" height="18" rx="1" />
              <rect x="15" y="3" width="4" height="18" rx="1" />
            </svg>
          ) : (
            // Play icon
            <svg className="w-4 h-4 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-white font-semibold text-sm truncate">PromptFM Live</span>
            <EqualizerBars playing={isPlaying} />
          </div>

          <p className="text-xs text-zinc-400 truncate">
            {isPlaying
              ? '24/7 AI-generated music'
              : isLoading
              ? (errorMessage ?? 'Connecting…')
              : playerState === 'error'
              ? (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  {errorMessage ?? 'Stream error'}
                </span>
              )
              : 'Click play to tune in'}
          </p>
        </div>
      </div>

      {/* Right: Volume controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleMuteToggle}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="text-zinc-400 hover:text-white transition-colors p-1"
        >
          {muted || volume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={handleVolumeChange}
          aria-label="Volume"
          className={[
            'w-20 sm:w-28 h-1 rounded-full accent-emerald-400 cursor-pointer',
            'appearance-none bg-zinc-700',
          ].join(' ')}
        />
      </div>
    </div>
  );
}
