// src/app/privacy/page.tsx
// Comprehensive Privacy Policy, GDPR & CCPA Disclosures

import React from 'react';
import Link from 'next/link';
import { Lock, ShieldCheck, Eye, Database, Globe2 } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-zinc-800 pb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Lock className="w-3.5 h-3.5" />
            Data Protection & Privacy
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Effective Date: November 2, 2026 • Last Updated: November 3, 2026
          </p>
        </div>

        {/* Core Sections */}
        <div className="space-y-8 text-xs sm:text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <Eye className="w-5 h-5 text-emerald-400" />
              1. Information We Collect
            </h2>
            <p>PromptFM collects minimal personal information necessary to deliver our broadcast service:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Uploader Submissions:</strong> Track titles, artist pseudonyms, generation
                tool metadata, lyrics, and audio files uploaded to our cloud storage.
              </li>
              <li>
                <strong className="text-white">Legal & DMCA Reports:</strong> Contact email addresses, claimant legal names,
                and evidence submitted through our DMCA or content moderation forms.
              </li>
              <li>
                <strong className="text-white">Listener Telemetry & Voting:</strong> Aggregated track upvote counters,
                radio channel preference tokens stored locally in your browser (`localStorage`), and transient stream
                connection logs.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <Database className="w-5 h-5 text-emerald-400" />
              2. How We Use Information
            </h2>
            <p>
              Collected data is used solely to maintain live broadcast rotation, power weekly community charts, prevent
              spam and vote flooding, process copyright/DMCA takedowns, and dispatch broadcast announcements to Discord
              and Telegram bridges. We do not sell or monetize personal listener data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <Globe2 className="w-5 h-5 text-emerald-400" />
              3. International Rights (GDPR & CCPA/CPRA)
            </h2>
            <p>
              Under the European General Data Protection Regulation (GDPR) and California Consumer Privacy Act (CCPA), you
              have the right to access, correct, export, or delete any personal information associated with your
              submissions or contact inquiries. To exercise these rights, email{' '}
              <a href="mailto:privacy@promptfm.live" className="text-emerald-400 underline">
                privacy@promptfm.live
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              4. Cookies & Local Browser Storage
            </h2>
            <p>
              PromptFM does not use third-party tracking or advertising cookies. We utilize standard browser{' '}
              <code className="text-emerald-400 font-mono">localStorage</code> solely to remember your chosen station channel
              and track voting state between sessions.
            </p>
          </section>
        </div>

        {/* Footer links */}
        <div className="border-t border-zinc-800 pt-6 text-center text-xs text-zinc-500">
          Related legal resources:{' '}
          <Link href="/terms" className="text-emerald-400 hover:underline">
            Terms of Service
          </Link>{' '}
          •{' '}
          <Link href="/dmca" className="text-emerald-400 hover:underline">
            DMCA Policy & Designated Agent
          </Link>{' '}
          •{' '}
          <Link href="/copyright" className="text-emerald-400 hover:underline">
            Commercial AI Licensing & Anti-Cloning Rules
          </Link>
        </div>
      </div>
    </div>
  );
}

