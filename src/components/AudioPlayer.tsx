'use client';

// src/components/AudioPlayer.tsx
// Sticky bottom live-stream player with active DJ indicator, Now Playing metadata,
// 1-click in-player voting, live spoken transcript viewer, and live theme channel switcher.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Radio,
  Loader2,
  AlertCircle,
  ThumbsUp,
  MessageSquareQuote,
  ChevronUp,
  Flag,
  Check,
  Zap,
  Moon,
  Gamepad2,
  Sparkles,
} from 'lucide-react';
import ReportModal from '@/components/ReportModal';
import {
  createStreamPlayerController,
  StreamPlayerController,
  DEFAULT_STREAM_URL,
  PlayerState,
} from '@/lib/audio/player-controller';
import {
  OFFICIAL_CHANNELS,
  RadioChannel,
  DEFAULT_CHANNEL_SLUG,
  getChannelBySlug,
  getStreamUrlForChannel,
  isValidChannelSlug,
} from '@/lib/radio/channels';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NowPlayingInfo {
  id?: string;
  type?: string;
  title: string;
  artist: string;
  cover_art_url?: string;
  tool_used?: string;
  upvotes_count?: number;
  transcript?: string;
  active_dj?: {
    id: string;
    name: string;
    title: string;
  };
}

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
  const controllerRef = useRef<StreamPlayerController | null>(null);

  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Channel State
  const [currentChannelSlug, setCurrentChannelSlug] = useState<string>(DEFAULT_CHANNEL_SLUG);
  const [showChannelMenu, setShowChannelMenu] = useState(false);

  // Now Playing & Live Transcript State
  const [nowPlaying, setNowPlaying] = useState<NowPlayingInfo | null>(null);
  const [voted, setVoted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const currentChannel = getChannelBySlug(currentChannelSlug);

  // Fetch Now Playing info for a given channel
  const fetchNowPlaying = useCallback(async (slug?: string) => {
    const targetSlug = slug || currentChannelSlug;
    try {
      const res = await fetch(`/api/radio/now?channel=${encodeURIComponent(targetSlug)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.now_playing) {
          const trackId = data.now_playing.id;
          if (trackId && typeof window !== 'undefined') {
            try {
              const alreadyVoted = localStorage.getItem(`promptfm_voted_${trackId}`) === 'true';
              setVoted(alreadyVoted);
            } catch {
              // Ignore localStorage restrictions
            }
          }

          setNowPlaying({
            id: trackId,
            type: data.now_playing.type,
            title: data.now_playing.title,
            artist: data.now_playing.artist,
            cover_art_url: data.now_playing.cover_art_url || '/logo-mark.png',
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
  }, [currentChannelSlug]);

  // Periodic polling for Now Playing updates
  useEffect(() => {
    fetchNowPlaying(currentChannelSlug);
    const interval = setInterval(() => fetchNowPlaying(currentChannelSlug), 12000);
    return () => clearInterval(interval);
  }, [fetchNowPlaying, currentChannelSlug]);

  // Handle in-player quick upvote
  const handleQuickVote = async () => {
    if (!nowPlaying?.id || voted) return;

    // Optimistically mark as voted and persist to localStorage
    setVoted(true);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`promptfm_voted_${nowPlaying.id}`, 'true');
      } catch {
        // Ignore localStorage restrictions
      }
    }

    setNowPlaying((prev) =>
      prev ? { ...prev, upvotes_count: (prev.upvotes_count || 0) + 1 } : null
    );

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: nowPlaying.id }),
      });

      if (res.ok) {
        const json = await res.json();
        if (typeof json.upvotes_count === 'number') {
          setNowPlaying((prev) =>
            prev ? { ...prev, upvotes_count: json.upvotes_count } : null
          );
        }
      }
    } catch (e) {
      console.warn('Failed to register quick vote:', e);
    }
  };

  // ── Switch Channel Method ─────────────────────────────────────────────────
  const switchChannel = useCallback((slug: string, autoPlay = false) => {
    const validSlug = isValidChannelSlug(slug) ? slug.toLowerCase().trim() : DEFAULT_CHANNEL_SLUG;
    setCurrentChannelSlug(validSlug);
    setShowChannelMenu(false);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('promptfm_channel', validSlug);
      } catch {
        // Ignore localStorage restrictions
      }

      // Notify external components of channel change
      window.dispatchEvent(
        new CustomEvent('promptfm:channel-changed', {
          detail: { slug: validSlug },
        })
      );
    }

    const streamUrl = getStreamUrlForChannel(validSlug);
    controllerRef.current?.setUrl(streamUrl);

    if (autoPlay) {
      controllerRef.current?.play();
    }

    // Refresh Now Playing immediately for the selected channel
    fetchNowPlaying(validSlug);
  }, [fetchNowPlaying]);

  // ── Stream player controller setup ───────────────────────────────────────
  useEffect(() => {
    // Initial channel detection from URL or localStorage
    let initialSlug = DEFAULT_CHANNEL_SLUG;
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlChannel = urlParams.get('channel');
        const storedChannel = localStorage.getItem('promptfm_channel');
        if (urlChannel && isValidChannelSlug(urlChannel)) {
          initialSlug = urlChannel;
        } else if (storedChannel && isValidChannelSlug(storedChannel)) {
          initialSlug = storedChannel;
        }
      } catch {
        // Ignore localStorage restrictions
      }
    }
    setCurrentChannelSlug(initialSlug);

    const initialStreamUrl = getStreamUrlForChannel(initialSlug);
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = muted ? 0 : volume;
    audioRef.current = audio;

    const controller = createStreamPlayerController(audio, initialStreamUrl, {
      onStateChange: (newState) => {
        setPlayerState(newState);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('promptfm:player-state', {
              detail: { state: newState },
            })
          );
        }
      },
      onError: (msg) => {
        setErrorMessage(msg);
      },
    });
    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── External Channel Switch Event Listener ────────────────────────────────
  useEffect(() => {
    const handleExternalSwitch = (e: Event) => {
      const customEvent = e as CustomEvent<{ slug: string; autoPlay?: boolean }>;
      if (customEvent.detail?.slug) {
        switchChannel(customEvent.detail.slug, !!customEvent.detail.autoPlay);
      }
    };

    window.addEventListener('promptfm:switch-channel', handleExternalSwitch);
    return () => {
      window.removeEventListener('promptfm:switch-channel', handleExternalSwitch);
    };
  }, [switchChannel]);

  // Sync volume changes to the audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  // ── Play / Pause toggle ────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    controllerRef.current?.toggle();
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (muted && val > 0) setMuted(false);
  };

  const handleMuteToggle = () => setMuted((m) => !m);

  const isPlaying = playerState === 'playing';
  const isLoading = playerState === 'loading';

  const getStationIcon = (slug: string) => {
    switch (slug) {
      case 'cyberpunk':
        return <Zap className="w-3.5 h-3.5 text-purple-400" />;
      case 'chillout':
        return <Moon className="w-3.5 h-3.5 text-teal-400" />;
      case 'kids':
        return <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'main':
      default:
        return <Radio className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

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
        {/* Channel Switcher Popover Menu */}
        {showChannelMenu && (
          <div className="absolute bottom-full left-3 sm:left-6 mb-2 w-[calc(100vw-24px)] sm:w-80 bg-zinc-900 border border-zinc-700/80 rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 space-y-2">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-zinc-300 border-b border-zinc-800 pb-2">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Radio className="w-3.5 h-3.5" />
                Live Radio Channels
              </span>
              <button
                type="button"
                onClick={() => setShowChannelMenu(false)}
                className="text-zinc-500 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              {OFFICIAL_CHANNELS.map((ch) => {
                const isSelected = ch.slug === currentChannelSlug;
                return (
                  <button
                    key={ch.slug}
                    type="button"
                    onClick={() => switchChannel(ch.slug, isPlaying)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-zinc-800 text-white border border-emerald-500/50 shadow-sm'
                        : 'hover:bg-zinc-800/60 text-zinc-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-zinc-950 flex items-center justify-center flex-shrink-0 border border-zinc-800">
                        {getStationIcon(ch.slug)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">{ch.shortName}</span>
                          <span className="text-[10px] text-zinc-400 font-medium">({ch.djName})</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate">{ch.badge}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Transcript Popover Modal */}
        {showTranscript && nowPlaying?.transcript && (
          <div className="absolute bottom-full left-3 sm:left-6 mb-2 max-w-[calc(100vw-24px)] sm:max-w-md w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl z-50 space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400">
              <span>🎙️ Spoken on Air by {nowPlaying.active_dj?.name || currentChannel.djName}</span>
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
            aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
            className={[
              'flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center',
              'transition-all duration-200 focus-visible:outline focus-visible:outline-2',
              'focus-visible:outline-emerald-400 focus-visible:outline-offset-2',
              isPlaying
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-700 hover:bg-zinc-600 text-white',
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

          {/* Track Cover Art with Active Singing Aura */}
          <div className="relative flex-shrink-0">
            {isPlaying && (
              <div
                className="absolute -inset-1 rounded-xl bg-gradient-to-r from-emerald-500/40 via-teal-400/30 to-emerald-500/40 blur-[3px] animate-pulse pointer-events-none"
                aria-hidden="true"
              />
            )}
            <div
              className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden border transition-all ${
                isPlaying
                  ? 'border-emerald-400/80 ring-1 ring-emerald-400/50 shadow-md shadow-emerald-500/20'
                  : 'border-zinc-800'
              } bg-zinc-900 flex items-center justify-center`}
            >
              <img
                src={nowPlaying?.cover_art_url || '/logo-mark.png'}
                alt={nowPlaying?.title || 'PromptFM Cover Art'}
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                }`}
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo-mark.png';
                }}
              />
              {/* Pulsating Singing Equalizer Waves */}
              {isPlaying && (
                <div className="absolute inset-0 bg-black/30 flex items-end justify-center pb-0.5 pointer-events-none">
                  <span className="flex items-end gap-[1.5px] h-2.5">
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-equalizer" style={{ animationDuration: '0.6s' }} />
                    <span className="w-0.5 bg-emerald-300 rounded-full animate-equalizer" style={{ animationDuration: '0.8s', animationDelay: '0.15s' }} />
                    <span className="w-0.5 bg-emerald-400 rounded-full animate-equalizer" style={{ animationDuration: '0.5s', animationDelay: '0.3s' }} />
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Channel Selector Button */}
              <button
                type="button"
                onClick={() => setShowChannelMenu((prev) => !prev)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-800 hover:bg-zinc-750 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 transition-colors flex-shrink-0"
                title="Switch radio channel"
                aria-label={`Current channel: ${currentChannel.shortName}. Click to change channel`}
              >
                {getStationIcon(currentChannel.slug)}
                <span className="hidden xs:inline">{currentChannel.shortName}</span>
                <ChevronUp
                  className={`w-3 h-3 text-emerald-400 transition-transform ${
                    showChannelMenu ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div className="flex items-center gap-1 min-w-0">
                <span className="text-white font-semibold text-xs sm:text-sm truncate max-w-[110px] xs:max-w-[160px] sm:max-w-xs md:max-w-sm">
                  {nowPlaying ? nowPlaying.title : currentChannel.name}
                </span>
              </div>

              <div className="hidden xs:flex items-center">
                <EqualizerBars playing={isPlaying} />
              </div>

              {/* Active DJ Tag */}
              <span className="hidden md:inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 flex-shrink-0">
                🎙️ {nowPlaying?.active_dj?.name || currentChannel.djName}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate max-w-[120px] xs:max-w-[160px] sm:max-w-xs">
                {nowPlaying ? nowPlaying.artist : isPlaying ? currentChannel.vibe : 'Click play to tune in'}
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
        targetId={nowPlaying?.id || `channel-${currentChannelSlug}`}
        targetTitle={
          nowPlaying?.title
            ? `Airplay: "${nowPlaying.title}" by ${nowPlaying.artist} (${currentChannel.name})`
            : `Live Radio Stream: ${currentChannel.name}`
        }
      />
    </>
  );
}
