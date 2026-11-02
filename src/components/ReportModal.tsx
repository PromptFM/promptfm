'use client';

// src/components/ReportModal.tsx
// Universal content reporting dialog for tracks, live stream broadcasts, and community requests.
// Submits to POST /api/report and notifies the station moderation desk.

import React, { useState } from 'react';
import { Flag, AlertCircle, CheckCircle2, Loader2, X, ShieldAlert } from 'lucide-react';
import { type ReportReason, type ReportTargetType, REASON_LABELS } from '@/types/database';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle?: string;
}

export default function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
}: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>('copyright_dmca');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
          details,
          reporter_platform: 'web',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit report.');
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setDetails('');
        onClose();
      }, 2200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while submitting.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-amber-400" />
            <h2 id="report-modal-title" className="text-base font-bold text-white">
              Report Content
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h3 className="text-lg font-bold text-white">Report Submitted</h3>
            <p className="text-xs text-zinc-300">
              Thank you for keeping PromptFM safe. Our moderation desk has been alerted and will
              review this entry promptly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Target info */}
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 text-xs">
              <span className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px] block">
                Reporting {targetType}
              </span>
              <p className="font-semibold text-white truncate mt-0.5">
                {targetTitle ? targetTitle : targetId}
              </p>
            </div>

            {/* Reason selector */}
            <div className="space-y-1.5">
              <label htmlFor="reportReason" className="block text-xs font-semibold text-zinc-300">
                Reason for report <span className="text-red-400">*</span>
              </label>
              <select
                id="reportReason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {(Object.keys(REASON_LABELS) as ReportReason[]).map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            {/* Additional details */}
            <div className="space-y-1.5">
              <label htmlFor="reportDetails" className="block text-xs font-semibold text-zinc-300">
                Details or evidence (optional)
              </label>
              <textarea
                id="reportDetails"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe why this violates broadcast ethics, copyright, or community rules…"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {errorMessage && (
              <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800/60">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting…</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>File Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
