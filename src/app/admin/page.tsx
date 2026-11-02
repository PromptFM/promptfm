'use client';

// src/app/admin/page.tsx
// PromptFM Station Admin & Program Director Console
// 1. Moderate community submissions (listen, approve, reject).
// 2. View and manage the live "Up Next" airplay queue.
// 3. Direct upload local MP3s into the active rotation (pre-approved).

import React, { useEffect, useState, useRef } from 'react';
import {
  Check,
  X,
  Play,
  Pause,
  Upload,
  Radio,
  ListMusic,
  Trash2,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Track, AITool } from '@/types/database';

export const dynamic = 'force-dynamic';

interface QueuedItem {
  id: string;
  track_id: string;
  prompt_used: string | null;
  requested_by: string;
  created_at: string;
  track: Track;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'submissions' | 'queue' | 'upload'>('submissions');
  const [pendingTracks, setPendingTracks] = useState<Track[]>([]);
  const [queueItems, setQueueItems] = useState<QueuedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Audio preview state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Direct MP3 upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    artist_name: '',
    tool_used: 'Suno' as AITool,
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const supabase = createClient();

  // ── 1. Fetch data ──────────────────────────────────────────────────────────

  const refreshData = async () => {
    setLoading(true);

    // Fetch pending submissions
    const { data: pending } = await supabase
      .from('tracks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (pending) setPendingTracks(pending as Track[]);

    // Fetch upcoming queue
    const { data: qData } = await supabase
      .from('channel_queue')
      .select('id, track_id, prompt_used, requested_by, created_at, track:tracks(*)')
      .is('played_at', null)
      .order('created_at', { ascending: true })
      .limit(20);

    if (qData) {
      // Format queued items
      const formatted = (qData as unknown as { id: string; track_id: string; prompt_used: string | null; requested_by: string; created_at: string; track: Track }[])
        .filter((item) => Boolean(item.track));
      setQueueItems(formatted);
    }

    setLoading(false);
  };

  useEffect(() => {
    refreshData();
    return () => {
      audioRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Audio Preview Player ────────────────────────────────────────────────

  const togglePreview = (id: string, url: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingId(id);

    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
  };

  // ── 3. Moderate Submissions ────────────────────────────────────────────────

  const handleModerate = async (trackId: string, status: 'approved' | 'rejected') => {
    setActionLoadingId(trackId);
    try {
      const { error } = await supabase
        .from('tracks')
        .update({ status })
        .eq('id', trackId);

      if (!error) {
        setPendingTracks((prev) => prev.filter((t) => t.id !== trackId));
        if (playingId === trackId) {
          audioRef.current?.pause();
          setPlayingId(null);
        }
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── 4. Remove from Queue ───────────────────────────────────────────────────

  const handleRemoveFromQueue = async (queueId: string) => {
    setActionLoadingId(queueId);
    try {
      const { error } = await supabase.from('channel_queue').delete().eq('id', queueId);
      if (!error) {
        setQueueItems((prev) => prev.filter((item) => item.id !== queueId));
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── 5. Direct MP3 Upload to Station (Pre-Approved) ─────────────────────────

  const handleDirectUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadForm.title || !uploadForm.artist_name) return;

    setUploading(true);
    setUploadProgress(10);
    setUploadSuccess(false);

    try {
      // Get presigned URL
      const urlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadFile.name,
          contentType: uploadFile.type || 'audio/mpeg',
        }),
      });

      if (!urlRes.ok) throw new Error('Failed to get presigned upload URL.');
      const { presignedUrl, publicUrl } = await urlRes.json();
      setUploadProgress(40);

      // Upload raw file to R2
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', uploadFile.type || 'audio/mpeg');
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setUploadProgress(40 + Math.round((evt.loaded / evt.total) * 50));
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject());
        xhr.onerror = reject;
        xhr.send(uploadFile);
      });

      setUploadProgress(95);

      // Insert directly into Supabase with 'approved' status
      const { error } = await supabase.from('tracks').insert({
        title: uploadForm.title.trim(),
        artist_name: uploadForm.artist_name.trim(),
        tool_used: uploadForm.tool_used,
        audio_url: publicUrl,
        status: 'approved',
      });

      if (error) throw error;

      setUploadProgress(100);
      setUploadSuccess(true);
      setUploadFile(null);
      setUploadForm({ title: '', artist_name: '', tool_used: 'Suno' });
      refreshData();
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-32">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Radio className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight">Station Manager Console</h1>
            </div>
            <p className="text-sm text-zinc-400">
              Review community submissions, curate the live queue, and upload official radio tracks.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('submissions')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'submissions'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Submissions ({pendingTracks.length})
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'queue'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              Live Queue ({queueItems.length})
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'upload'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Local MP3
            </button>
          </div>
        </div>

        {/* ── TAB 1: PENDING SUBMISSIONS ──────────────────────────────────── */}
        {activeTab === 'submissions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-200">Pending Review</h2>
              <button
                onClick={refreshData}
                className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : pendingTracks.length === 0 ? (
              <div className="text-center py-16 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl space-y-2">
                <Sparkles className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
                <p className="text-sm font-medium text-white">All caught up!</p>
                <p className="text-xs text-zinc-500">No pending submissions awaiting review right now.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingTracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    {/* Left: Play button + Info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <button
                        onClick={() => togglePreview(track.id, track.audio_url)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                          playingId === track.id
                            ? 'bg-emerald-400 text-black'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {playingId === track.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 translate-x-0.5" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                        <p className="text-xs text-zinc-400 truncate">
                          {track.artist_name} • <span className="text-emerald-400">{track.tool_used}</span>
                        </p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleModerate(track.id, 'approved')}
                        disabled={actionLoadingId === track.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-black text-xs font-semibold transition-all disabled:opacity-40"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                      </button>

                      <button
                        onClick={() => handleModerate(track.id, 'rejected')}
                        disabled={actionLoadingId === track.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-400 hover:bg-red-600 hover:text-white text-xs font-semibold transition-all disabled:opacity-40"
                      >
                        <X className="w-3.5 h-3.5" />
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: LIVE UP NEXT QUEUE ───────────────────────────────────── */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-200">Active Airplay Queue</h2>
                <p className="text-xs text-zinc-400">Tracks queued by listener prompts and station automations.</p>
              </div>
              <button
                onClick={refreshData}
                className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : queueItems.length === 0 ? (
              <div className="text-center py-16 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl space-y-2">
                <ListMusic className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-sm font-medium text-white">Queue is empty</p>
                <p className="text-xs text-zinc-500">The station is currently looping community top chart tracks.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {queueItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-xs font-bold text-zinc-500 tabular-nums">#{index + 1}</span>

                      <button
                        onClick={() => togglePreview(item.track.id, item.track.audio_url)}
                        className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 text-zinc-300"
                      >
                        {playingId === item.track.id ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 translate-x-0.5" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.track.title}</p>
                        <p className="text-xs text-zinc-400 truncate">
                          {item.track.artist_name} • Requested by{' '}
                          <span className="text-emerald-400">{item.requested_by}</span>
                          {item.prompt_used ? ` ("${item.prompt_used}")` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveFromQueue(item.id)}
                      disabled={actionLoadingId === item.id}
                      title="Remove from queue"
                      className="text-zinc-500 hover:text-red-400 p-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: DIRECT LOCAL MP3 UPLOAD ──────────────────────────────── */}
        {activeTab === 'upload' && (
          <div className="max-w-xl mx-auto space-y-6 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
            <div>
              <h2 className="text-base font-semibold text-white">Upload MP3 Directly to Radio Rotation</h2>
              <p className="text-xs text-zinc-400">
                Uploaded tracks bypass moderation and are immediately approved for community charts & airplay.
              </p>
            </div>

            {uploadSuccess && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                Track uploaded, approved, and added to the station playlist!
              </div>
            )}

            <form onSubmit={handleDirectUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Track Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Neon Skylines"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Artist Handle</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. prompt_producer"
                  value={uploadForm.artist_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, artist_name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">AI Tool</label>
                <select
                  value={uploadForm.tool_used}
                  onChange={(e) => setUploadForm({ ...uploadForm, tool_used: e.target.value as AITool })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Suno">Suno</option>
                  <option value="Udio">Udio</option>
                  <option value="Stable Audio">Stable Audio</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Local MP3 File</label>
                <input
                  type="file"
                  required
                  accept="audio/mpeg,audio/mp3,.mp3"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-emerald-400 hover:file:bg-zinc-700 cursor-pointer"
                />
              </div>

              {uploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Uploading directly to R2...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5">
                    <div
                      className="bg-emerald-400 h-1.5 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Add Track to Station
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

