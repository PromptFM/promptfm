// src/app/terms/page.tsx
// Comprehensive PromptFM Terms of Service, User Warranties & Binding Indemnification Agreement

import React from 'react';
import Link from 'next/link';
import { FileText, Shield, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  INDEMNIFICATION_TERMS,
  AI_MUSIC_DISCLAIMER,
  COMMERCIAL_AI_LICENSE_WARRANTY,
} from '@/lib/legal/policies';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-zinc-800 pb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileText className="w-3.5 h-3.5" />
            Legal Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Terms of Service & Broadcast Agreement
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Effective Date: November 2, 2026 • Last Updated: November 3, 2026
          </p>
        </div>

        {/* Public Disclaimer Banner */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-xs text-zinc-300 leading-relaxed space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-400">
            <Shield className="w-4 h-4" />
            AI Autonomous Broadcast Disclaimer
          </div>
          <p>{AI_MUSIC_DISCLAIMER}</p>
        </div>

        {/* Core Articles */}
        <div className="space-y-8 text-xs sm:text-sm text-zinc-300 leading-relaxed">
          {/* Article 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing, browsing, listening to, voting on, or submitting audio to PromptFM (the &ldquo;Service&rdquo;
              or &ldquo;Platform&rdquo;), or interacting with our automated radio bots on Discord, Telegram, or Model
              Context Protocol (MCP) clients, you acknowledge that you have read, understood, and agree to be bound by
              these Terms of Service, our{' '}
              <Link href="/dmca" className="text-emerald-400 underline">
                DMCA Copyright Policy
              </Link>
              , and our{' '}
              <Link href="/privacy" className="text-emerald-400 underline">
                Privacy Policy
              </Link>
              . If you do not agree to all terms, do not use the Platform.
            </p>
          </section>

          {/* Article 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              2. Broadcast License Grant from Submitters
            </h2>
            <p>
              When you submit, upload, or request airplay for an audio track, title, prompt, description, or artwork:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Worldwide Broadcast License:</strong> You grant PromptFM and its operators
                a non-exclusive, irrevocable, royalty-free, worldwide, transferable license (with right to sub-license)
                to stream, rebroadcast, synchronize with automated AI DJ commentary, transcode, display in leaderboard
                charts, and distribute via our Icecast stream servers and community broadcast bridges.
              </li>
              <li>
                <strong className="text-white">Ownership Retention:</strong> You retain whatever copyright, ownership, or
                creatorship rights you hold under the applicable terms of your AI generation tool (e.g. Suno, Udio,
                Stable Audio). PromptFM does not claim copyright ownership of your prompt creations.
              </li>
            </ul>
          </section>

          {/* Article 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              3. Uploader Representations & Warranties (Anti-Infringement Shield)
            </h2>
            <p>Every uploader explicitly represents and warrants under penalty of law that:</p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Authorized Commercial Tier:</strong> All audio was generated under an active, paid commercial
                  subscription that grants full commercial exploitation rights (e.g., Suno Pro/Premier, Udio
                  Standard/Pro, Stable Audio Commercial, or an open-weight model with commercial license).
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>No Protected Master Stems:</strong> The audio does not contain unauthorized samples, ripped
                  vocal tracks, copyrighted stems, or direct recordings of third-party copyrighted works.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>No Unauthorized Voice Clones / Deepfakes:</strong> The track does not intentionally clone or
                  impersonate the vocal likeness, identifiable style, or persona of any living recording artist without
                  express written consent, complying with applicable rights of publicity laws (including the Tennessee
                  ELVIS Act).
                </span>
              </div>
            </div>
          </section>

          {/* Article 4 - BINDING INDEMNIFICATION */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              4. Binding Indemnification & Hold Harmless Agreement
            </h2>
            <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4 space-y-2 text-red-200 text-xs sm:text-sm">
              <p className="font-semibold text-red-300">
                CRITICAL LEGAL PROTECTION CLAUSE — READ CAREFULLY:
              </p>
              <p className="leading-relaxed">{INDEMNIFICATION_TERMS}</p>
              <p className="text-xs text-red-300/80">
                This obligation survives any termination or expiration of these Terms or your cessation of use of the
                Service.
              </p>
            </div>
          </section>

          {/* Article 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              5. Disclaimer of Warranties (&ldquo;AS-IS&rdquo;)
            </h2>
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
              WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR
              A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. PROMPTFM DOES NOT WARRANT THAT BROADCAST STREAMS WILL BE
              UNINTERRUPTED, ERROR-FREE, OR VIRUS-FREE.
            </p>
          </section>

          {/* Article 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              6. Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL PROMPTFM, ITS OPERATORS, FOUNDATION
              PROVIDERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE
              LOSSES, ARISING OUT OF OR RELATING TO THE USE OF, OR INABILITY TO USE, THIS SERVICE. IN NO EVENT SHALL
              PROMPTFM&rsquo;S AGGREGATE LIABILITY EXCEED ONE HUNDRED US DOLLARS ($100.00).
            </p>
          </section>

          {/* Article 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              7. Dispute Resolution, Binding Arbitration & Class Action Waiver
            </h2>
            <p>
              Any dispute, claim, or controversy arising out of or relating to these Terms or the breach, termination,
              enforcement, interpretation, or validity thereof shall be settled by binding individual arbitration rather
              than in court. YOU AND PROMPTFM AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS
              INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE
              PROCEEDING.
            </p>
          </section>

          {/* Article 8 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              8. Contact & Notice
            </h2>
            <p>
              For formal legal notices or questions regarding these Terms, contact our legal desk at:{' '}
              <a href="mailto:dmca@promptfm.live" className="text-emerald-400 font-mono underline">
                dmca@promptfm.live
              </a>
            </p>
          </section>
        </div>

        {/* Footer links */}
        <div className="border-t border-zinc-800 pt-6 text-center text-xs text-zinc-500">
          Related legal resources:{' '}
          <Link href="/dmca" className="text-emerald-400 hover:underline">
            DMCA Policy & Designated Agent
          </Link>{' '}
          •{' '}
          <Link href="/copyright" className="text-emerald-400 hover:underline">
            Commercial AI Licensing & Voice Clone Rules
          </Link>{' '}
          •{' '}
          <Link href="/privacy" className="text-emerald-400 hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}

