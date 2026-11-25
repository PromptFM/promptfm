// src/app/guides/radio-architecture/page.tsx
// Comprehensive Radio Architecture & Clock-Wheel Engineering Guide.
// Complies with Google AdSense Publisher Content & Quality Guidelines.

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Radio, Cpu, Sparkles, Clock, Database, CheckCircle2 } from 'lucide-react';
import AdSenseDisplayUnit from '@/components/AdSenseDisplayUnit';
import { getGuideBySlug } from '@/lib/guides/guides-data';
import { generateArticleJsonLd } from '@/lib/seo/structured-data';

const guide = getGuideBySlug('radio-architecture')!;

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

export default function RadioArchitectureGuidePage() {
  const jsonLd = generateArticleJsonLd({
    title: guide.title,
    description: guide.description,
    url: `https://promptfm.live${guide.canonicalPath}`,
    datePublished: '2026-11-01T00:00:00Z',
    dateModified: `${guide.lastUpdated}T00:00:00Z`,
    keywords: guide.keywords,
    isTechnical: true,
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
          <span className="text-zinc-300">Guides</span>
          <span>/</span>
          <span className="text-emerald-400 font-medium">Radio Architecture</span>
        </div>

        {/* Editorial Header */}
        <header className="space-y-4 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5" />
              Systems Engineering Whitepaper
            </span>
            <span className="text-xs text-zinc-400">
              {guide.readingTimeMinutes} min read · Updated {guide.lastUpdated}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            {guide.title}
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            {guide.description}
          </p>
        </header>

        {/* Guide Content Sections */}
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
                  <AdSenseDisplayUnit slotId="guide_arch_middle" className="max-w-full" />
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Radio Clock Wheel Diagram Summary */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            PromptFM Hourly Clock-Wheel Cadence
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-zinc-300">
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
              <span className="font-mono text-emerald-400 font-bold">T+00 to T+15</span>
              <h3 className="font-bold text-white">Opening Segment</h3>
              <p className="text-zinc-400 text-[11px]">
                Top-of-hour station ID, resident AI DJ broadcast welcome, and top community chart hit.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
              <span className="font-mono text-emerald-400 font-bold">T+15 to T+30</span>
              <h3 className="font-bold text-white">Listener Requests</h3>
              <p className="text-zinc-400 text-[11px]">
                Queued songs via Discord slash /song and Telegram /s, accompanied by personalized dedication readouts.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
              <span className="font-mono text-emerald-400 font-bold">T+30 to T+45</span>
              <h3 className="font-bold text-white">Discovery Showcase</h3>
              <p className="text-zinc-400 text-[11px]">
                Fresh catalog additions and prompt experiments from Suno, Udio, and Stable Audio creators.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
              <span className="font-mono text-emerald-400 font-bold">T+45 to T+60</span>
              <h3 className="font-bold text-white">The Countdown Drop</h3>
              <p className="text-zinc-400 text-[11px]">
                Hourly peak-energy block featuring the top 3 weekly upvoted tracks and upcoming shift preview.
              </p>
            </div>
          </div>
        </section>

        {/* Footer Navigation */}
        <footer className="pt-8 border-t border-zinc-800 flex flex-wrap gap-4 items-center justify-between text-xs text-zinc-400">
          <span>&copy; {new Date().getFullYear()} PromptFM. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/guides/prompt-engineering" className="hover:text-emerald-400 transition-colors">
              &larr; Prompt Engineering Guide
            </Link>
            <Link href="/editorial-standards" className="hover:text-emerald-400 transition-colors">
              Editorial Standards
            </Link>
            <Link href="/channels" className="hover:text-emerald-400 transition-colors">
              Radio Channels
            </Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
