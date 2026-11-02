'use client';

// src/app/submit/page.tsx
// Community track submission form.
// Flow:
//   1. User fills in metadata fields.
//   2. Selects an .mp3 file (≤ 12 MB, validated client-side).
//   3. Ticks a legal certification checkbox.
//   4. On submit:
//      a. Requests a presigned PUT URL from /api/upload-url.
//      b. Uploads the file directly to R2 with a progress bar.
//      c. Inserts a track record into Supabase.

import React, { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, CheckCircle2, AlertCircle, FileAudio, X, ShieldAlert, Shield, Scale, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { evaluateHeuristicGuardrails } from '@/lib/safety/guardrails';
import AgreementsModal from '@/components/AgreementsModal';
import type { AITool, UploadUrlRequest, UploadUrlResponse } from '@/types/database';

export const dynamic = 'force-dynamic';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 12;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const AI_TOOLS: AITool[] = ['Suno', 'Udio', 'Stable Audio', 'Other'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  artistName: string;
  toolUsed: AITool;
  legalConfirmed: boolean;
  termsConfirmed: boolean;
  isExplicit: boolean;
}

type SubmitStatus = 'idle' | 'uploading' | 'inserting' | 'success' | 'error';

// ─── Component ───────────────────────────────────────────────────────────────

export default function SubmitPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    title: '',
    artistName: '',
    toolUsed: 'Suno',
    legalConfirmed: false,
    termsConfirmed: false,
    isExplicit: false,
  });

  const [agreementsOpen, setAgreementsOpen] = useState(false);
  const [agreementsTab, setAgreementsTab] = useState<'terms' | 'copyright' | 'ethics' | 'watershed' | 'dmca'>('terms');

  const openAgreements = (tab: 'terms' | 'copyright' | 'ethics' | 'watershed' | 'dmca') => {
    setAgreementsTab(tab);
    setAgreementsOpen(true);
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Field handlers ────────────────────────────────────────────────────────

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFileError(null);
    setSelectedFile(null);

    if (!file) return;

    const isAcceptedMedia = file.type.includes('audio') || 
                            file.type.includes('video/mp4') || 
                            /\.(mp3|mp4|m4a|wav|ogg|flac|aac)$/i.test(file.name);
    if (!isAcceptedMedia) {
      setFileError('Only audio and media files (.mp3, .mp4, .m4a, .wav) are accepted.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`File is too large (${formatBytes(file.size)}). Maximum is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setSelectedFile(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFileError(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Upload with XHR (for progress tracking) ───────────────────────────────

  const uploadFileToR2 = useCallback(
    (presignedUrl: string, file: File): Promise<void> =>
      new Promise((resolve, reject) => {
        const effectiveContentType = file.type || (file.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg');
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', effectiveContentType);

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error(`R2 upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () =>
          reject(new Error('Network error during upload.')),
        );

        xhr.send(file);
      }),
    [],
  );

  // ── Form submission ───────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    // Guard: file selected
    if (!selectedFile) {
      setFileError('Please select an audio file.');
      return;
    }

    // Guard: legal & broadcast agreements
    if (!form.legalConfirmed || !form.termsConfirmed) {
      setErrorMessage(
        'You must confirm both the commercial copyright certification and the PromptFM broadcast agreements before submitting.'
      );
      return;
    }

    // Guard: broadcast safety & ethics guardrails check
    const safety = evaluateHeuristicGuardrails(`${form.title} ${form.artistName}`);
    if (!safety.safe) {
      setErrorMessage(
        safety.refusalMessage ||
          'Submission declined: Track metadata violates PromptFM broadcast standards.'
      );
      return;
    }

    try {
      // ── Step 1: Get presigned URL ────────────────────────────────────────
      setSubmitStatus('uploading');
      setUploadProgress(0);

      const effectiveContentType = selectedFile.type || (selectedFile.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg');
      const uploadPayload: UploadUrlRequest = {
        filename: selectedFile.name,
        contentType: effectiveContentType,
      };

      const urlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadPayload),
      });

      if (!urlRes.ok) {
        const data = (await urlRes.json()) as { error?: string };
        throw new Error(data.error ?? 'Failed to get upload URL.');
      }

      const { presignedUrl, publicUrl } = (await urlRes.json()) as UploadUrlResponse;

      // ── Step 2: Upload to R2 ─────────────────────────────────────────────
      await uploadFileToR2(presignedUrl, selectedFile);

      // ── Step 3: Insert track into Supabase ───────────────────────────────
      setSubmitStatus('inserting');

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const isExplicitFinal = form.isExplicit || safety.is18Plus;

      const { error: insertError } = await supabase.from('tracks').insert({
        title: form.title.trim(),
        artist_name: form.artistName.trim(),
        tool_used: form.toolUsed,
        audio_url: publicUrl,
        user_id: user?.id ?? null,
        status: 'pending',
        is_explicit: isExplicitFinal,
      });

      if (insertError) throw new Error(insertError.message);

      // ── Step 4: Done! ────────────────────────────────────────────────────
      setSubmitStatus('success');

      // Redirect to the chart after a brief celebration moment
      setTimeout(() => router.push('/top'), 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(message);
      setSubmitStatus('error');
    }
  };

  const isSubmitting = submitStatus === 'uploading' || submitStatus === 'inserting';

  // ─── Success screen ──────────────────────────────────────────────────────
  if (submitStatus === 'success') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
          <h1 className="text-2xl font-bold text-white">Track Submitted!</h1>
          <p className="text-zinc-400">
            Your track is pending review. You'll see it on the chart once approved.
            Redirecting to the leaderboard…
          </p>
        </div>
      </main>
    );
  }

  // ─── Main form ───────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-28">
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-8 sm:py-12 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Submit a Track</h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Share your AI-generated music with the PromptFM community.
          </p>
        </div>

        {/* Creator Notice & Broadcast Agreement Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Creator Notice & Airplay Agreement
              </h2>
            </div>
            <button
              type="button"
              onClick={() => openAgreements('terms')}
              className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
            >
              Read Full Rules →
            </button>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            PromptFM broadcasts community music globally across the live stream, leaderboard,
            Discord, and Telegram. All submissions are governed by commercial licensing and broadcast
            ethics guardrails.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
            <button
              type="button"
              onClick={() => openAgreements('copyright')}
              className="flex items-start gap-2 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-left hover:border-zinc-700 transition-colors"
            >
              <Scale className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-200 block text-[11px]">Commercial AI License</span>
                <span className="text-[10px] text-zinc-500">Valid Suno, Udio, or Stable Audio subscription rights.</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openAgreements('ethics')}
              className="flex items-start gap-2 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-left hover:border-zinc-700 transition-colors"
            >
              <ShieldAlert className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-200 block text-[11px]">Broadcast Ethics</span>
                <span className="text-[10px] text-zinc-500">Zero tolerance for hate speech or religious mockery.</span>
              </div>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-5 sm:space-y-6">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="title" className="block text-sm font-medium text-zinc-300">
              Track Title <span className="text-red-400">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={120}
              value={form.title}
              onChange={handleFieldChange}
              placeholder="e.g. Neon Horizon"
              className={inputCls}
            />
          </div>

          {/* Artist */}
          <div className="space-y-1.5">
            <label htmlFor="artistName" className="block text-sm font-medium text-zinc-300">
              Artist Handle <span className="text-red-400">*</span>
            </label>
            <input
              id="artistName"
              name="artistName"
              type="text"
              required
              maxLength={80}
              value={form.artistName}
              onChange={handleFieldChange}
              placeholder="e.g. synthwave_wizard"
              className={inputCls}
            />
          </div>

          {/* AI Tool */}
          <div className="space-y-1.5">
            <label htmlFor="toolUsed" className="block text-sm font-medium text-zinc-300">
              AI Tool Used <span className="text-red-400">*</span>
            </label>
            <select
              id="toolUsed"
              name="toolUsed"
              value={form.toolUsed}
              onChange={handleFieldChange}
              className={selectCls}
            >
              {AI_TOOLS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-zinc-300">
              Audio File (.mp3 or .mp4, max {MAX_FILE_SIZE_MB} MB) <span className="text-red-400">*</span>
            </span>

            {!selectedFile ? (
              <label
                htmlFor="audioFile"
                className={[
                  'flex flex-col items-center justify-center gap-3 border-2 border-dashed',
                  'border-zinc-700 rounded-xl p-8 cursor-pointer',
                  'hover:border-emerald-500 hover:bg-zinc-900 transition-colors',
                  fileError ? 'border-red-500' : '',
                ].join(' ')}
              >
                <FileAudio className="w-8 h-8 text-zinc-500" />
                <span className="text-sm text-zinc-400 text-center">
                  Click to browse or drag & drop your .mp3 or .mp4 file here
                </span>
                <input
                  id="audioFile"
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3,.mp3,video/mp4,audio/mp4,.mp4,audio/x-m4a,audio/m4a,.m4a,audio/wav,.wav"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-4">
                <FileAudio className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
                  <p className="text-xs text-zinc-400">{formatBytes(selectedFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  aria-label="Remove file"
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {fileError && (
              <p className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5" /> {fileError}
              </p>
            )}
          </div>

          {/* Upload progress */}
          {isSubmitting && submitStatus === 'uploading' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Uploading to storage…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {submitStatus === 'inserting' && (
            <p className="text-sm text-zinc-400 animate-pulse">Saving your track record…</p>
          )}

          {/* Parental Control / Explicit Checkbox */}
          <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 sm:p-4">
            <input
              id="isExplicit"
              name="isExplicit"
              type="checkbox"
              checked={form.isExplicit}
              onChange={handleFieldChange}
              className="mt-0.5 w-4 h-4 accent-amber-400 cursor-pointer flex-shrink-0"
            />
            <label htmlFor="isExplicit" className="text-xs text-zinc-300 leading-relaxed cursor-pointer">
              <span className="font-semibold text-amber-400">Parental Advisory (18+):</span> Check this box if your song contains explicit lyrics, profanity, or adult themes. Explicit tracks air exclusively during the late-night watershed (22:00–06:00 UTC) and are excluded from family-safe channels.
            </label>
          </div>

          {/* Legal Certification Checkbox */}
          <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-700/80 rounded-xl p-3.5 sm:p-4">
            <input
              id="legalConfirmed"
              name="legalConfirmed"
              type="checkbox"
              checked={form.legalConfirmed}
              onChange={handleFieldChange}
              className="mt-0.5 w-4 h-4 accent-emerald-400 cursor-pointer flex-shrink-0"
            />
            <label htmlFor="legalConfirmed" className="text-xs text-zinc-300 leading-relaxed cursor-pointer">
              <span className="font-semibold text-white">Commercial AI Rights Certification:</span> I certify that this audio was generated with valid commercial rights (e.g. active Suno/Udio/Stable Audio subscription or open model), does not infringe on third-party copyrights, and does not clone living artists' likenesses without permission.{' '}
              <button
                type="button"
                onClick={() => openAgreements('copyright')}
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                Learn more
              </button>
            </label>
          </div>

          {/* Broadcast Terms & Ethics Checkbox */}
          <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-700/80 rounded-xl p-3.5 sm:p-4">
            <input
              id="termsConfirmed"
              name="termsConfirmed"
              type="checkbox"
              checked={form.termsConfirmed}
              onChange={handleFieldChange}
              className="mt-0.5 w-4 h-4 accent-emerald-400 cursor-pointer flex-shrink-0"
            />
            <label htmlFor="termsConfirmed" className="text-xs text-zinc-300 leading-relaxed cursor-pointer">
              <span className="font-semibold text-white">Broadcast Terms & Ethics Agreement:</span> I agree to the PromptFM{' '}
              <button
                type="button"
                onClick={() => openAgreements('ethics')}
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                Broadcast Ethics
              </button>
              , zero tolerance for hate speech or religious mockery, and{' '}
              <button
                type="button"
                onClick={() => openAgreements('dmca')}
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                DMCA takedown rules
              </button>
              . I grant PromptFM a non-exclusive license to stream and feature this track.
            </label>
          </div>

          {/* Global error */}
          {errorMessage && submitStatus === 'error' && (
            <div className="flex items-start gap-2 bg-red-950 border border-red-800 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-300">{errorMessage}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !form.title ||
              !form.artistName ||
              !selectedFile ||
              !form.legalConfirmed ||
              !form.termsConfirmed
            }
            className={[
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm',
              'bg-emerald-500 hover:bg-emerald-400 text-black transition-all duration-200',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            <Upload className="w-4 h-4" />
            {isSubmitting ? 'Submitting…' : 'Submit Track'}
          </button>
        </form>
      </div>

      {/* Station Agreements Modal */}
      <AgreementsModal
        isOpen={agreementsOpen}
        onClose={() => setAgreementsOpen(false)}
        defaultTab={agreementsTab}
      />
    </main>
  );
}

// ─── Shared Tailwind classes ──────────────────────────────────────────────────

const inputCls = [
  'w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white',
  'placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500',
  'focus:border-transparent transition-all',
].join(' ');

const selectCls = [
  'w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white',
  'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
  'transition-all appearance-none cursor-pointer',
].join(' ');

