// src/app/guides/prompt-engineering/page.tsx
// Comprehensive Prompt Engineering Guide for AI Music Synthesis.
// Complies with Google AdSense Publisher Content & Quality Guidelines.

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Sparkles, Cpu, Sliders, Music2, CheckCircle2 } from 'lucide-react';
import AdSenseDisplayUnit from '@/components/AdSenseDisplayUnit';
import { getGuideBySlug } from '@/lib/guides/guides-data';
import { generateArticleJsonLd } from '@/lib/seo/structured-data';

const guide = getGuideBySlug('prompt-engineering')!;

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

export default function PromptEngineeringGuidePage() {
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
          <span className="text-emerald-400 font-medium">Prompt Engineering</span>
        </div>

        {/* Editorial Header */}
        <header className="space-y-4 border-b border-zinc-800 pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              Comprehensive Technical Guide
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
                  <AdSenseDisplayUnit slotId="guide_prompt_middle" className="max-w-full" />
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Practical Cheatsheet Table */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            Prompt Token Quick Reference Matrix
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-zinc-300">
              <thead className="border-b border-zinc-800 text-zinc-400 uppercase text-[11px]">
                <tr>
                  <th className="py-2 pr-4 font-bold">Category</th>
                  <th className="py-2 pr-4 font-bold">Recommended Syntax</th>
                  <th className="py-2 font-bold">Acoustic Effect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                <tr>
                  <td className="py-2.5 pr-4 font-semibold text-emerald-400">Tempo & Beat</td>
                  <td className="py-2.5 pr-4 font-mono text-zinc-200">124 BPM, 4/4 time, four-on-the-floor</td>
                  <td className="py-2.5">Locks transient kick cadence and drum quantization</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-semibold text-emerald-400">Arrangement</td>
                  <td className="py-2.5 pr-4 font-mono text-zinc-200">[Intro] [Verse] [Pre-Chorus] [Chorus] [Drop]</td>
                  <td className="py-2.5">Enforces energetic transitions and prevents sonic monotony</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-semibold text-emerald-400">Timbre & Space</td>
                  <td className="py-2.5 pr-4 font-mono text-zinc-200">analog synth saturation, wide stereo field, dry close vocal</td>
                  <td className="py-2.5">Improves vocal clarity and stereo dimension</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-semibold text-emerald-400">Mastering</td>
                  <td className="py-2.5 pr-4 font-mono text-zinc-200">-14 LUFS, high dynamic headroom, warm low end</td>
                  <td className="py-2.5">Complies with EBU R128 radio airplay standards</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer Navigation */}
        <footer className="pt-8 border-t border-zinc-800 flex flex-wrap gap-4 items-center justify-between text-xs text-zinc-400">
          <span>&copy; {new Date().getFullYear()} PromptFM. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/guides/radio-architecture" className="hover:text-emerald-400 transition-colors">
              Radio Architecture Guide &rarr;
            </Link>
            <Link href="/editorial-standards" className="hover:text-emerald-400 transition-colors">
              Editorial Standards
            </Link>
            <Link href="/submit" className="hover:text-emerald-400 transition-colors">
              Submit Music
            </Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
