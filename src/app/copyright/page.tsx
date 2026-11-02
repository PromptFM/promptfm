// src/app/copyright/page.tsx
// Commercial AI Rights & Living Artist Likeness Protection Policy

import React from 'react';
import Link from 'next/link';
import { Scale, CheckCircle2, XCircle, ShieldCheck, UserX, AlertTriangle } from 'lucide-react';
import { COMMERCIAL_AI_LICENSE_WARRANTY } from '@/lib/legal/policies';

export default function CopyrightPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-zinc-800 pb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Scale className="w-3.5 h-3.5" />
            Intellectual Property & Rights Compliance
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Commercial AI Licensing & Voice Clone Rules
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-3xl">
            PromptFM is built exclusively for original generative music creators. To ensure complete legal
            safety across our global broadcast network, we require all submitters to hold verifiable commercial
            broadcast rights and prohibit deceptive vocal likeness cloning.
          </p>
        </div>

        {/* Generative Tool Guidelines */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Approved Generative Audio Toolchains
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2">
              <h3 className="font-bold text-white text-base">Suno</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Pro / Premier Required
              </span>
              <p className="text-xs text-zinc-400 leading-relaxed pt-1">
                Under Suno Terms of Service, only tracks generated during an active Pro or Premier paid subscription
                convey commercial ownership and broadcasting rights. Free tier generations are strictly personal and
                cannot be submitted for airplay.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2">
              <h3 className="font-bold text-white text-base">Udio</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Standard / Pro Required
              </span>
              <p className="text-xs text-zinc-400 leading-relaxed pt-1">
                Audio creations must originate from an active Standard or Pro subscription. Submitters warrant that
                prompt styles and vocal seeds comply with Udio&rsquo;s commercial terms and do not rip protected
                master stems.
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2">
              <h3 className="font-bold text-white text-base">Stable Audio & Open Weights</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Commercial License Required
              </span>
              <p className="text-xs text-zinc-400 leading-relaxed pt-1">
                Stable Audio tracks must be created with a Commercial subscription tier. Open-weight models (MusicGen,
                AudioCraft, Stable Audio Open) must carry permissive commercial use licenses (e.g. MIT, Apache 2.0).
              </p>
            </div>
          </div>
        </div>

        {/* Living Artist Likeness & Voice Clone Prohibition */}
        <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2.5 text-red-400 font-bold text-lg">
            <UserX className="w-6 h-6 flex-shrink-0" />
            Strict Ban on Unauthorized Living Artist Clones & Deepfakes
          </div>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            In accordance with rights of publicity laws (including the Tennessee Ensuring Likeness Voice and Image
            Security &ldquo;ELVIS&rdquo; Act of 2024 and California Civil Code § 3344), PromptFM strictly forbids:
          </p>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2.5 text-zinc-300">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Deceptive Vocal Clones:</strong> Audio engineered to deceive listeners into believing that a
                specific living recording celebrity (e.g. Taylor Swift, Drake, Billie Eilish, The Weeknd) recorded or
                authorized the performance.
              </span>
            </li>
            <li className="flex items-start gap-2.5 text-zinc-300">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Ripped Master Stems:</strong> Audio tracks containing ripped vocal isolation stems, unauthorized
                samples, or copyrighted melody hooks from commercially released masters.
              </span>
            </li>
            <li className="flex items-start gap-2.5 text-zinc-300">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Trademark Deception:</strong> Using living artist names or registered record label marks in track
                titles or metadata to misrepresent official affiliation.
              </span>
            </li>
          </ul>
        </div>

        {/* Permitted Submissions */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            What is Permitted & Celebrated on PromptFM
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-zinc-300">
            <div className="space-y-1">
              <span className="font-semibold text-emerald-400 block">✓ Original Prompts & Genre Hybrids</span>
              <p className="text-zinc-400">
                Unique prompt engineering combining obscure genres, fictional lore, and custom lyrical storytelling.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-emerald-400 block">✓ Fictional Virtual Personas</span>
              <p className="text-zinc-400">
                Original virtual artists, anime vocalists, synthetic cyberpunk bands, and community AI avatars.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-emerald-400 block">✓ Algorithmic Instrumentals</span>
              <p className="text-zinc-400">
                100% instrumental synthwave, ambient soundscapes, lo-fi beats, chiptunes, and orchestral scores.
              </p>
            </div>
            <div className="space-y-1">
              <span className="font-semibold text-emerald-400 block">✓ Parody & Non-Deceptive Homage</span>
              <p className="text-zinc-400">
                Humorous, clearly labeled transformative genre parody that does not confuse or impersonate individuals.
              </p>
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="border-t border-zinc-800 pt-6 text-center text-xs text-zinc-500">
          Related legal documentation:{' '}
          <Link href="/dmca" className="text-emerald-400 hover:underline">
            DMCA Safe Harbor & Takedown Form
          </Link>{' '}
          •{' '}
          <Link href="/terms" className="text-emerald-400 hover:underline">
            Terms of Service & Indemnification
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
