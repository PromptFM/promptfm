'use client';

// src/components/AgeGateModal.tsx
// Statutory 18+ Age Verification & Legal Disclaimer Modal

import React, { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, Check, ArrowLeft, Lock } from 'lucide-react';
import { DEFAULT_18_PLUS_LEGAL_DISCLAIMER } from '@/lib/safety/channel-guardrails';

export interface AgeGateModalProps {
  isOpen: boolean;
  channelName: string;
  disclaimer?: string;
  minAge?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AgeGateModal({
  isOpen,
  channelName,
  disclaimer = DEFAULT_18_PLUS_LEGAL_DISCLAIMER,
  minAge = 18,
  onConfirm,
  onCancel,
}: AgeGateModalProps) {
  const [mounted, setMounted] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleProceed = () => {
    try {
      localStorage.setItem('promptfm_age_verified_18', 'true');
      localStorage.setItem(`promptfm_age_verified_channel_${channelName}`, 'true');
    } catch {
      // Ignore storage errors in private browsing
    }
    onConfirm();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-rose-500/30 p-6 sm:p-7 shadow-2xl shadow-rose-950/40 space-y-5 text-white">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold tracking-wide uppercase">
                {minAge}+ Restricted
              </span>
              <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                <Lock className="w-3 h-3" /> Broadcast Guardrail
              </span>
            </div>
            <h2 id="age-gate-title" className="text-xl font-bold tracking-tight text-white">
              Age Verification Required
            </h2>
            <p className="text-xs text-zinc-400">
              You are entering <span className="font-semibold text-rose-300">{channelName}</span>.
            </p>
          </div>
        </div>

        {/* Legal Disclaimer Box */}
        <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-300 leading-relaxed font-sans space-y-2">
          <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Statutory Broadcast Affirmation</span>
          </div>
          <p className="text-[11px] text-zinc-300">{disclaimer}</p>
        </div>

        {/* Checkbox Acknowledgment */}
        <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition-colors">
          <input
            type="checkbox"
            checked={hasAcknowledged}
            onChange={(e) => setHasAcknowledged(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-rose-500 rounded cursor-pointer"
          />
          <span className="text-xs text-zinc-300 select-none leading-tight">
            I certify under penalty of law that I am at least {minAge} years of age and affirmatively agree to stream explicit adult broadcast audio.
          </span>
        </label>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Family Safe Radio
          </button>

          <button
            type="button"
            disabled={!hasAcknowledged}
            onClick={handleProceed}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg shadow-rose-950/30"
          >
            <Check className="w-4 h-4" />
            I am {minAge}+ / Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

