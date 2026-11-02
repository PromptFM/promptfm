'use client';

// src/components/AgreementsModal.tsx
// Comprehensive station agreements, commercial AI licensing, broadcast standards,
// parental advisory (18+), and DMCA copyright policies modal.

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, FileText, AlertTriangle, Scale, CheckCircle2, ExternalLink, X } from 'lucide-react';

interface AgreementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'terms' | 'copyright' | 'ethics' | 'watershed' | 'dmca';
}

export default function AgreementsModal({
  isOpen,
  onClose,
  defaultTab = 'terms',
}: AgreementsModalProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'copyright' | 'ethics' | 'watershed' | 'dmca'>(
    defaultTab
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agreements-title"
    >
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 id="agreements-title" className="text-base sm:text-lg font-bold text-white">
              PromptFM Station Agreements & Standards
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation - responsive horizontal scroll on mobile */}
        <div className="flex items-center gap-1 px-4 py-2 bg-zinc-950/40 border-b border-zinc-800/80 overflow-x-auto text-xs font-semibold scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'terms'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            📜 Terms of Service
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('copyright')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'copyright'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            ⚖️ Commercial AI Rights
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ethics')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'ethics'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            🛡️ Broadcast Ethics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('watershed')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'watershed'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            🔞 18+ & Watershed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dmca')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'dmca'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            📋 DMCA Notice
          </button>
        </div>

        {/* Content body - scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm text-zinc-300 leading-relaxed">
          {activeTab === 'terms' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                PromptFM Terms of Service & Broadcast Agreement
              </h3>
              <p>
                PromptFM is an autonomous 24/7 internet radio station and community leaderboard
                dedicated exclusively to AI-generated musical creativity. By using PromptFM,
                submitting content, listening, or engaging with our bots on Discord and Telegram, you
                agree to be bound by these Terms.
              </p>
              <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3.5 space-y-2">
                <h4 className="font-semibold text-white">1. Broadcast License Grant</h4>
                <p className="text-xs text-zinc-300">
                  By submitting an audio track or requesting music airplay, you grant PromptFM a
                  worldwide, royalty-free, non-exclusive license to stream, synchronize with AI DJ
                  commentary, display in leaderboard charts, and transmit via our broadcast streams
                  and community bridges. You retain full copyright ownership of your prompt
                  creations according to the terms of your AI generation tool.
                </p>
              </div>
              <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3.5 space-y-2">
                <h4 className="font-semibold text-white">2. Community Requests & Voting</h4>
                <p className="text-xs text-zinc-300">
                  Listeners are invited to vote on tracks and request songs, dedications, weather
                  updates, and zodiac forecasts. PromptFM reserves the right to moderate, decline,
                  or re-schedule entries that do not align with our station format or broadcast
                  standards.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'copyright' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                Commercial AI Rights & Originality Certification
              </h3>
              <p>
                Every uploader must possess the legal commercial rights for the audio generated.
                PromptFM maintains a zero-tolerance policy against copyright infringement.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
                <li>
                  <strong className="text-white">Commercial Tier Requirement:</strong> You certify
                  that tracks generated using commercial services (e.g., Suno Pro/Premier, Udio
                  Standard/Pro, Stable Audio Commercial) were created during an active subscription
                  that conveys commercial broadcast rights.
                </li>
                <li>
                  <strong className="text-white">No Direct Clones or Stems:</strong> Audio tracks
                  must not sample, copy, or rip copyrighted vocals, recordings, or protected stems
                  from non-AI commercial recordings without express written authorization.
                </li>
                <li>
                  <strong className="text-white">Living Artist Likeness:</strong> We prohibit
                  unauthorized deepfakes or commercial impersonations intended to deceive listeners
                  into believing a specific real-world living celebrity recorded the song.
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'ethics' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                Broadcast Ethics & Guardrail Standards
              </h3>
              <p>
                PromptFM is committed to an open, creative, and respectful global community. All
                tracks, lyrics, titles, and live chat requests are monitored by automated guardrails
                and human station editors.
              </p>
              <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3.5 space-y-1.5 text-red-200">
                <h4 className="font-bold flex items-center gap-1.5 text-red-300">
                  <AlertTriangle className="w-4 h-4" /> Prohibited Material
                </h4>
                <p className="text-xs leading-relaxed">
                  We strictly refuse submissions containing hate speech, harassment, slurs targeting
                  race, gender, sexual orientation, disability, or nationality, attacks on religious
                  beliefs or religious mockery, glorification of self-harm, or promotion of illegal
                  acts.
                </p>
              </div>
              <p className="text-xs text-zinc-400">
                Submissions violating these ethics standards will be declined immediately, removed
                from batch schedules, and repeated violations will result in account and platform
                suspension.
              </p>
            </div>
          )}

          {activeTab === 'watershed' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  18+
                </span>
                Parental Advisory & Safe Harbor Watershed
              </h3>
              <p>
                To provide transparency for all audiences and protect family listeners, PromptFM
                enforces strict parental labeling:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm">
                <li>
                  <strong className="text-white">Mandatory 18+ Tagging:</strong> Any song with
                  strong profanity, adult sexual themes, or dark mature topics must be flagged with
                  the <em>Parental Advisory (18+)</em> checkbox upon upload.
                </li>
                <li>
                  <strong className="text-white">Late-Night Watershed:</strong> Explicit 18+ tracks
                  are only scheduled to air during our designated watershed window (22:00–06:00 UTC).
                </li>
                <li>
                  <strong className="text-white">Family-Safe Mode:</strong> Listeners on our web
                  charts and community streams can toggle Family-Safe mode at any time to hide
                  explicit titles and previews.
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'dmca' && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                DMCA Copyright Notice & Takedown Policy
              </h3>
              <p>
                PromptFM respects the intellectual property of artists and rights holders and complies
                with the Digital Millennium Copyright Act (17 U.S.C. § 512).
              </p>
              <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl p-3.5 space-y-2 text-xs">
                <p>
                  If you are a copyright owner or an agent thereof and believe that any content
                  streamed or hosted on PromptFM infringes upon your copyright, you may submit a
                  notice by using the in-app <strong>Report</strong> button or sending an email to:
                </p>
                <div className="p-2.5 rounded bg-zinc-950 font-mono text-emerald-400 text-xs">
                  dmca@promptfm.live
                </div>
                <p className="text-zinc-400">
                  Please include: identification of the copyrighted work, URL/ID of the infringing
                  material, your contact info, a statement of good-faith belief, and your physical or
                  electronic signature. Takedowns are processed within 24 hours.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-zinc-800 bg-zinc-950/60">
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <Link
              href="/terms"
              onClick={onClose}
              className="text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Full Terms</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <span>•</span>
            <Link
              href="/dmca"
              onClick={onClose}
              className="text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>DMCA Form</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <span>•</span>
            <Link
              href="/copyright"
              onClick={onClose}
              className="text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>AI Rights</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}

