// src/app/editorial-standards/page.tsx
// Comprehensive Editorial Standards, Curation Charter & Content Integrity Policy.
// Complies with Google AdSense Publisher Content & Unique Value Policies.

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Scale, Sparkles, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import AdSenseDisplayUnit from '@/components/AdSenseDisplayUnit';
import { getGuideBySlug } from '@/lib/guides/guides-data';
import { generateArticleJsonLd } from '@/lib/seo/structured-data';

const guide = getGuideBySlug('editorial-standards')!;

export const metadata: Metadata = {
  title: guide.metaTitle,
  description: guide.description,
  alternates: {
    canonical: guide.canonicalPath,
  },
  openGraph: {
    title: guide.metaTitle,
    description: guide.description,
    url: `https://promptfm.live${guide.canonicalPath}`,
    type: 'article',
  },
};

export default function EditorialStandardsPage() {
  const jsonLd = generateArticleJsonLd({
    title: guide.title,
    description: guide.description,
    url: `https://promptfm.live${guide.canonicalPath}`,
    datePublished: '2026-11-01T00:00:00Z',
    dateModified: `${guide.lastUpdated}T00:00:00Z`,
    keywords: guide.keywords,
    isTechnical: false,
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-10 pb-36">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="max-w-4xl mx-auto space-y-10 text-left">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 hover:text-white transition-colors py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
          <span>/</span>
          <span className="text-zinc-300">Policy</span>
          <span>/</span>
          <span className="text-emerald-400 font-medium">Editorial Standards</span>
        </div>

        {/* Editorial Header */}
        <header className="space-y-4 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Station Governance & Curation Charter
            </span>
            <span className="text-xs text-zinc-400">
              Updated {guide.lastUpdated} · Official Policy
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            {guide.title}
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            {guide.description}
          </p>
        </header>

        {/* Policy Sections */}
        <div className="space-y-12">
          {guide.sections.map((section, idx) => (
            <section key={section.heading} className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>{section.heading}</span>
              </h2>

              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
                {section.body}
              </p>

              {section.subsections && section.subsections.length > 0 && (
                <div className="grid grid-cols-1 gap-4 pt-2">
                  {section.subsections.map((sub) => (
                    <div
                      key={sub.title}
                      className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5 space-y-2"
                    >
                      <h3 className="text-sm sm:text-base font-semibold text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{sub.title}</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-300 whitespace-pre-line leading-relaxed">
                        {sub.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Nested AdSense banner after section 2 */}
              {idx === 1 && (
                <div className="my-8">
                  <AdSenseDisplayUnit slotId="standards_middle" className="max-w-full" />
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Content Integrity & Prohibited Materials Matrix */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Content Classification & Broadcaster Boundaries
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-zinc-300">
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-emerald-500/30 space-y-1.5">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Permitted Everywhere
              </span>
              <h3 className="font-bold text-white">Family Safe & General Airplay</h3>
              <p className="text-zinc-400 text-[11px]">
                Original compositions, uplifting lyrical themes, instrumental electronic, synthwave, lo-fi beats, and educational children&apos;s audio.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-amber-500/30 space-y-1.5">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                Restricted Hours
              </span>
              <h3 className="font-bold text-white">Watershed & 18+ Channels</h3>
              <p className="text-zinc-400 text-[11px]">
                Dark themes, angst-driven metal/industrial, or mature lyrics aired only between 22:00 and 06:00 UTC or on Channel 5 (After Dark).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-rose-500/30 space-y-1.5">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                Strictly Prohibited
              </span>
              <h3 className="font-bold text-white">Instant Ban & Takedown</h3>
              <p className="text-zinc-400 text-[11px]">
                Hate speech, harassment, impersonation of living individuals, copyright infringement, or tracks lacking commercial generation rights.
              </p>
            </div>
          </div>
        </section>

        {/* Footer Navigation */}
        <footer className="pt-8 border-t border-zinc-800 flex flex-wrap gap-4 items-center justify-between text-xs text-zinc-400">
          <span>&copy; {new Date().getFullYear()} PromptFM. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-emerald-400 transition-colors">
              About PromptFM
            </Link>
            <Link href="/dmca" className="hover:text-emerald-400 transition-colors">
              DMCA Notice
            </Link>
            <Link href="/contact" className="hover:text-emerald-400 transition-colors">
              Contact Station
            </Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
