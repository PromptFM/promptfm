// src/app/schedule/page.tsx
// 24/7 Radio Broadcast Schedule & Programming Guide Page

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, Radio, Sparkles, Upload } from 'lucide-react';
import ScheduleView from '@/components/ScheduleView';

export const metadata: Metadata = {
  title: '24/7 Broadcast Schedule & AI DJ Guide | PromptFM',
  description:
    'Explore the full 24-hour daily programming schedule across all PromptFM channels. Discover AI DJ shifts, generative synth themes, morning briefings, and hourly chart drops.',
  openGraph: {
    title: '24/7 Broadcast Schedule — PromptFM AI Radio',
    description:
      'Continuous AI DJ shifts, generative themes, news flashes, and community countdowns on PromptFM.',
    url: 'https://promptfm.live/schedule',
    siteName: 'PromptFM',
    images: [
      {
        url: 'https://promptfm.live/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromptFM 24/7 Broadcast Schedule',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '24/7 Broadcast Schedule — PromptFM',
    description: 'Full day AI DJ shifts, synthwave themes, and community airplay schedule.',
    site: '@promptfm_live',
    creator: '@promptfm_live',
    images: ['https://promptfm.live/og-image.png'],
  },
};

interface SchedulePageProps {
  searchParams?: {
    channel?: string;
  };
}

export default function SchedulePage({ searchParams }: SchedulePageProps) {
  const initialChannel = searchParams?.channel || 'main';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-8 px-3 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-zinc-400 hover:text-emerald-400 font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Live Radio</span>
          </Link>

          <Link
            href="/submit"
            className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md shadow-emerald-500/20"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Get Your Track on Air</span>
          </Link>
        </div>

        {/* Schedule Component */}
        <ScheduleView initialChannelSlug={initialChannel} />

        {/* Community Submission & DJ Shifting Note */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Want Your AI Music Featured in Today&apos;s Broadcast?
            </h3>
            <p className="text-xs text-zinc-400 max-w-xl">
              PromptFM is 100% community-curated. Upvoted tracks air during prime-time DJ shifts. Submit your Suno, Udio, or Stable Audio song in seconds.
            </p>
          </div>

          <Link
            href="/submit"
            className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Submit for Airplay
          </Link>
        </div>
      </div>
    </div>
  );
}

