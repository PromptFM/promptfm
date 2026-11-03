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
  MessageSquare,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Flag,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { type Track, type AITool, type ContentReport, REASON_LABELS } from '@/types/database';
import type { User } from '@supabase/supabase-js';
import AuthButton from '@/components/AuthButton';

export const dynamic = 'force-dynamic';

interface QueuedItem {
  id: string;
  track_id: string;
  prompt_used: string | null;
  requested_by: string;
  created_at: string;
  track: Track;
}

interface CommunityRequestRow {
  id: string;
  platform: 'discord' | 'telegram' | 'web';
  platform_user_id: string;
  platform_user_name: string;
  type: string;
  content: string;
  target: string | null;
  batch_id: string | null;
  status: string;
  created_at: string;
  estimated_air_time: string | null;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [activeTab, setActiveTab] = useState<'submissions' | 'queue' | 'batches' | 'reports' | 'upload'>('submissions');
  const [pendingTracks, setPendingTracks] = useState<Track[]>([]);
  const [queueItems, setQueueItems] = useState<QueuedItem[]>([]);
  const [communityRequests, setCommunityRequests] = useState<CommunityRequestRow[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [customRejectReason, setCustomRejectReason] = useState<string>('Religious hostility violates broadcast standards');
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

    // Fetch scheduled community requests (Discord/Telegram)
    const { data: reqs } = await supabase
      .from('community_requests')
      .select('*')
      .in('status', ['pending', 'scheduled'])
      .order('created_at', { ascending: true })
      .limit(30);

    if (reqs) {
      setCommunityRequests(reqs as unknown as CommunityRequestRow[]);
    }

    // Fetch content moderation reports
    try {
      const repRes = await fetch('/api/admin/reports');
      if (repRes.ok) {
        const repData = await repRes.json();
        if (repData.reports) setReports(repData.reports);
      }
    } catch (e) {
      console.warn('Could not load reports:', e);
    }

    setLoading(false);
  };

  useEffect(() => {
    async function checkAdmin() {
      setAuthChecking(true);
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);

      if (!currentUser) {
        setIsAdmin(false);
        setAuthChecking(false);
        setLoading(false);
        return;
      }

      // Read admin allowlist from env
      const adminEmailsEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
      const allowedEmails = adminEmailsEnv
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      // If configured, verify user email is in the allowlist; otherwise allow in dev
      const authorized =
        allowedEmails.length === 0 || allowedEmails.includes((currentUser.email || '').toLowerCase());

      setIsAdmin(authorized);
      setAuthChecking(false);

      if (authorized) {
        refreshData();
      } else {
        setLoading(false);
      }
    }

    checkAdmin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      subscription.unsubscribe();
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

  // ── 5. Reject / Remove Request from Batch with Reason ──────────────────────

  const handleRejectBatchRequest = async (requestId: string, reason: string) => {
    setActionLoadingId(requestId);
    try {
      const res = await fetch('/api/admin/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          requestId,
          reason,
          moderator: user?.email || 'Station Director',
        }),
      });

      if (res.ok) {
        setCommunityRequests((prev) => prev.filter((r) => r.id !== requestId));
        setRejectingRequestId(null);
      } else {
        const data = await res.json();
        alert(`Failed to remove request: ${data.error || 'Server error'}`);
      }
    } catch (e) {
      console.error('Failed to reject request:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── 6. Action Content Report ───────────────────────────────────────────────

  const handleActionReport = async (reportId: string, action: 'actioned' | 'dismissed') => {
    setActionLoadingId(reportId);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, action }),
      });
      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: action } : r))
        );
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── 7. Direct MP3 Upload to Station (Pre-Approved) ─────────────────────────

  const handleDirectUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadForm.title || !uploadForm.artist_name) return;

    setUploading(true);
    setUploadProgress(10);
    setUploadSuccess(false);

    try {
      const effectiveContentType = uploadFile.type || (uploadFile.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg');

      // Get presigned URL
      const urlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadFile.name,
          contentType: effectiveContentType,
        }),
      });

      if (!urlRes.ok) throw new Error('Failed to get presigned upload URL.');
      const { presignedUrl, publicUrl } = await urlRes.json();
      setUploadProgress(40);

      // Upload raw file to R2
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', effectiveContentType);
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

  if (authChecking) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-5">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight">Admin Station Access Required</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {!user
                ? 'Please sign in with an authorized station admin account to access the DJ and program console.'
                : `Signed in as ${user.email}. This account is not listed in NEXT_PUBLIC_ADMIN_EMAILS.`}
            </p>
          </div>
          <div className="flex justify-center pt-2">
            <AuthButton />
          </div>
        </div>
      </main>
    );
  }

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
          <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none gap-1">
            <button
              onClick={() => setActiveTab('submissions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'queue'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              Queue ({queueItems.length})
            </button>
            <button
              onClick={() => setActiveTab('batches')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'batches'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Batches ({communityRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'reports'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Flag className="w-3.5 h-3.5 text-amber-400" />
              Reports ({reports.filter((r) => r.status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === 'upload'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload MP3
            </button>
          </div>
        </div>

        {/* Zero-Cost Telemetry & Monitoring Quick Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-xs">
          <div className="flex items-center justify-between p-2.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
            <span className="text-zinc-400">Station Telemetry</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              4 Live Channels Active
            </span>
          </div>
          <a
            href="https://vercel.com/alex-trifans-projects/promptfm/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2.5 bg-zinc-950/60 hover:bg-zinc-850/80 border border-zinc-800/80 rounded-xl transition-colors group"
          >
            <span className="text-zinc-300">Vercel Web Analytics</span>
            <span className="text-zinc-400 group-hover:text-emerald-400 text-[11px] font-semibold">
              $0 Real-time ↗
            </span>
          </a>
          <a
            href="https://console.cloud.google.com/monitoring/dashboards/builder/ce33f584-e48f-407a-b2e7-1d1fa9e990ff?project=promptfm-radio-1793623670"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2.5 bg-zinc-950/60 hover:bg-zinc-850/80 border border-zinc-800/80 rounded-xl transition-colors group"
          >
            <span className="text-zinc-300">Google Cloud Monitoring</span>
            <span className="text-zinc-400 group-hover:text-emerald-400 text-[11px] font-semibold">
              $0 Quota & Latency ↗
            </span>
          </a>
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

        {/* ── TAB 3: SCHEDULED BATCHES & LISTENER REQUESTS ──────────────── */}
        {activeTab === 'batches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-200">Scheduled Broadcast Batches</h2>
                <p className="text-xs text-zinc-400">
                  Manage incoming Discord and Telegram requests (dedications, songs, weather, zodiac).
                </p>
              </div>
              <button
                onClick={refreshData}
                className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                Refresh
              </button>
            </div>

            {communityRequests.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto opacity-60" />
                <p className="text-sm font-medium text-zinc-300">No Pending Batch Requests</p>
                <p className="text-xs text-zinc-500">
                  Listener requests from Discord and Telegram will appear here grouped by 15-minute batches.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {communityRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {req.batch_id || 'PENDING'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 capitalize">
                            {req.platform}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                            {req.type}
                          </span>
                          <span className="text-xs text-zinc-400">
                            by <span className="text-white font-medium">@{req.platform_user_name}</span>
                          </span>
                        </div>
                        <p className="text-sm text-zinc-200 font-medium">
                          &ldquo;{req.content}&rdquo;
                          {req.target ? (
                            <span className="text-emerald-400 ml-1.5 font-normal">
                              (Target: {req.target})
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Estimated Air: {req.estimated_air_time ? new Date(req.estimated_air_time).toUTCString() : 'Next Batch'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {rejectingRequestId === req.id ? (
                          <button
                            onClick={() => setRejectingRequestId(null)}
                            className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setRejectingRequestId(req.id);
                              setCustomRejectReason('Religious hostility / mockery violates broadcast ethics');
                            }}
                            disabled={actionLoadingId === req.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors flex items-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            Decline & Notify
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Rejection Reason Panel */}
                    {rejectingRequestId === req.id && (
                      <div className="mt-2 p-3 bg-zinc-950 border border-red-500/30 rounded-lg space-y-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                          <AlertCircle className="w-4 h-4" />
                          <span>Select reason to send to @{req.platform_user_name} on {req.platform}:</span>
                        </div>

                        {/* Preset quick buttons */}
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            'Religious hostility or mockery violates station standards',
                            'Explicit 18+ adult content is not permitted',
                            'Hate speech, slurs, or harassment violate guidelines',
                            'Request is off-topic or inappropriate for broadcast',
                          ].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setCustomRejectReason(preset)}
                              className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                                customRejectReason === preset
                                  ? 'bg-red-500/20 border-red-500/40 text-red-200'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customRejectReason}
                            onChange={(e) => setCustomRejectReason(e.target.value)}
                            placeholder="Or enter custom reason to message listener..."
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                          />
                          <button
                            onClick={() => handleRejectBatchRequest(req.id, customRejectReason)}
                            disabled={actionLoadingId === req.id || !customRejectReason.trim()}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {actionLoadingId === req.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              'Confirm Removal'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: CONTENT MODERATION REPORTS ─────────────────────────── */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-200">
                  Community Safety & Copyright Reports
                </h2>
                <p className="text-xs text-zinc-400">
                  Reports submitted via Web UI, Discord, Telegram, and MCP.
                </p>
              </div>
              <button
                onClick={refreshData}
                className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
              >
                Refresh
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 border border-zinc-800/80 rounded-2xl bg-zinc-900/40">
                <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400/60 mb-2" />
                <p className="text-sm font-medium text-zinc-300">All clear!</p>
                <p className="text-xs text-zinc-500">No active content reports filed.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          {report.target_type}
                        </span>
                        <span className="text-xs font-bold text-white truncate max-w-xs">
                          {report.target_id}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            report.status === 'pending'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {report.status.toUpperCase()}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300">
                        <strong className="text-zinc-200">Reason:</strong>{' '}
                        {REASON_LABELS[report.reason] || report.reason}
                      </p>

                      {report.details && (
                        <p className="text-xs text-zinc-400 italic">
                          &ldquo;{report.details}&rdquo;
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-zinc-500 pt-1">
                        <span>Platform: <strong className="text-zinc-400">{report.reporter_platform}</strong></span>
                        {report.reporter_id && <span>By: {report.reporter_id}</span>}
                        <span>{new Date(report.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {report.status === 'pending' && (
                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                        <button
                          onClick={() => handleActionReport(report.id, 'dismissed')}
                          disabled={actionLoadingId === report.id}
                          className="px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white text-xs font-semibold hover:border-zinc-500 transition-colors"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleActionReport(report.id, 'actioned')}
                          disabled={actionLoadingId === report.id}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                          {actionLoadingId === report.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5" />
                          )}
                          Take Action
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: DIRECT LOCAL MP3 UPLOAD ──────────────────────────────── */}
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
                <label className="block text-xs font-medium text-zinc-300 mb-1">Local Audio File (.mp3 or .mp4)</label>
                <input
                  type="file"
                  required
                  accept="audio/mpeg,audio/mp3,.mp3,video/mp4,audio/mp4,.mp4,audio/x-m4a,audio/m4a,.m4a,audio/wav,.wav"
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

