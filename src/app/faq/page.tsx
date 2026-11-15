// src/app/faq/page.tsx
// Comprehensive PromptFM Knowledge Base & FAQ.
// Complies with Google AdSense Publisher Quality & Unique Value Standards.

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpCircle, ArrowLeft, Sparkles, Radio, Music2, ShieldCheck, Mail } from 'lucide-react';
import { FAQ_CATEGORIES, getFaqItemsByCategory } from '@/lib/faq/faq-data';
import { generateFaqJsonLd } from '@/lib/seo/structured-data';

export const metadata: Metadata = {
  title: 'PromptFM FAQ & Knowledge Base | Autonomous AI Radio Architecture',
  description:
    'Comprehensive guide and answers regarding PromptFM: 24/7 autonomous AI DJ broadcasting, Suno and Udio music generation, community voting, copyright licensing, and DMCA safe harbor.',
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: 'PromptFM FAQ & Knowledge Base — Autonomous AI Radio',
    description:
      'Everything you need to know about PromptFM: autonomous AI DJs, Suno/Udio generation, community voting, copyright licensing, and broadcast quality.',
    url: 'https://promptfm.live/faq',
  },
};

export default function FaqPage() {
  const jsonLd = generateFaqJsonLd();

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-10 pb-36">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="max-w-4xl mx-auto space-y-10 text-left">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>

        {/* Editorial Header */}
        <header className="space-y-4 border-b border-zinc-800 pb-8">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            Station Knowledge Base & FAQ
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Welcome to the PromptFM knowledge base. Here you will find detailed explanations of our autonomous broadcast
            clock-wheel engine, generative neural audio synthesis models, community governance rules, and ethical copyright safeguards.
          </p>
        </header>

        {/* Categories and Questions */}
        <div className="space-y-12">
          {FAQ_CATEGORIES.map((category) => {
            const items = getFaqItemsByCategory(category.slug);

            return (
              <section key={category.slug} className="space-y-6">
                <div className="border-b border-zinc-800/80 pb-3">
                  <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    {category.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                    {category.description}
                  </p>
                </div>

                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 space-y-2.5 hover:border-zinc-700 transition-colors"
                    >
                      <h3 className="text-base sm:text-lg font-bold text-zinc-100 flex items-start gap-2">
                        <span className="text-emerald-400 select-none">Q:</span>
                        <span>{item.question}</span>
                      </h3>
                      <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed pl-6 space-y-2">
                        <p>{item.answer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Contact CTA */}
        <footer className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-base font-bold text-white flex items-center justify-center sm:justify-start gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              Have a Question Not Answered Here?
            </h3>
            <p className="text-xs text-zinc-400 max-w-xl">
              Our listener relations and technical support teams are ready to help. Reach out through our dedicated contact hub.
            </p>
          </div>
          <Link
            href="/contact"
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20 whitespace-nowrap"
          >
            Contact Station Support
          </Link>
        </footer>
      </article>
    </main>
  );
}
