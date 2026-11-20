// src/app/channels/page.tsx
// Comprehensive PromptFM Theme Radio Channels Directory, Stream Guide & DJ Roster.
// Complies with Google AdSense Publisher Content & Unique Value Policies.

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Radio, Disc, Sparkles, Cpu, Clock, ShieldCheck, HeartHandshake } from 'lucide-react';
import ChannelsGrid from '@/components/ChannelsGrid';
import UpNextSection from '@/components/UpNextSection';
import { OFFICIAL_CHANNELS } from '@/lib/radio/channels';

export const metadata: Metadata = {
  title: 'PromptFM Main Stage Radio Channels & Broadcast Directory',
  description:
    'Tune into PromptFM Main Stage live radio: continuous 24/7 AI-generated music, community top-voted hits, weekly charts, and autonomous AI radio DJs.',
  alternates: {
    canonical: '/channels',
  },
  openGraph: {
    title: 'PromptFM Main Stage Radio Channels & Broadcast Directory',
    description:
      'Tune into PromptFM Main Stage featuring continuous AI-generated music and autonomous AI radio DJs.',
    url: 'https://promptfm.live/channels',
  },
};

export default function ChannelsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-8 pb-36">
      <div className="max-w-6xl mx-auto space-y-12">
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
        <header className="space-y-4 border-b border-zinc-800 pb-8 text-left">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5" />
            Station Directory & Channel Guide
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            PromptFM Broadcast Channels
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-3xl">
            PromptFM broadcasts specialized streams curated for different moods, aesthetics, and times of day.
            Each channel features an autonomous clock wheel rotation engine and a resident AI DJ persona
            generating live spoken transitions, artist context, and listener dedication readouts.
          </p>
        </header>

        {/* Live Stations Grid */}
        <section className="space-y-4">
          <ChannelsGrid />
        </section>

        {/* Up Next on Air Section */}
        <section className="space-y-4">
          <UpNextSection />
        </section>

        {/* In-depth Channel Directory Guide */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 space-y-8 text-left">
          <div className="border-b border-zinc-800 pb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Disc className="w-5 h-5 text-emerald-400" />
              Detailed Channel Profiles & Clock-Wheel Cadences
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Every channel follows a strict radio wheel balancing top-voted community tracks, new discoveries, and DJ station IDs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {OFFICIAL_CHANNELS.map((channel) => (
              <div
                key={channel.slug}
                className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    {channel.badge}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                    Host: {channel.djName}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white">{channel.name}</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">{channel.description}</p>

                <div className="space-y-1.5 pt-2 border-t border-zinc-900 text-[11px] text-zinc-400">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Musical Aesthetic:</span>
                    <span className="text-zinc-300 font-medium">{channel.vibe}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Parental Rating:</span>
                    <span className={channel.isFamilySafe ? 'text-emerald-400' : 'text-amber-400'}>
                      {channel.isFamilySafe ? 'Family-Safe (All Ages)' : 'Late-Night Watershed / 18+'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Audio Stream:</span>
                    <span className="text-zinc-300 font-mono">192 kbps Stereo AAC/MP3</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Technical Specifications */}
          <div className="pt-6 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-zinc-400">
            <div className="space-y-1.5">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-400" />
                Audio Synthesis Stack
              </h4>
              <p>
                Powered by Suno v3.5, Udio v1.5, and Stable Audio 2.0 with PostgreSQL pgvector semantic indexing.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                Clock-Wheel Cadence
              </h4>
              <p>
                Rotations alternate: Hit Track &rarr; Spoken DJ Drop &rarr; Request &rarr; Station ID &rarr; Discovery Track.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Broadcast Governance
              </h4>
              <p>
                All tracks require commercial AI generation grants in compliance with 17 U.S.C. § 512 and DMCA safe harbor.
              </p>
            </div>
          </div>
        </section>

        {/* Footer Navigation Shortcuts */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-zinc-800 text-xs text-zinc-400">
          <Link href="/schedule" className="hover:text-emerald-400 transition-colors">
            &larr; View 24-Hour Broadcast Schedule
          </Link>
          <div className="flex gap-4">
            <Link href="/library" className="hover:text-emerald-400 transition-colors">
              Browse Public Library
            </Link>
            <Link href="/faq" className="hover:text-emerald-400 transition-colors">
              Read Station FAQ
            </Link>
            <Link href="/contact" className="hover:text-emerald-400 transition-colors">
              Contact Operations
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
