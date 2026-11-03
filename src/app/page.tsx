// src/app/page.tsx — Landing / Home page

import Link from 'next/link';
import Image from 'next/image';
import { Radio, Music2, Upload } from 'lucide-react';
import ChannelsGrid from '@/components/ChannelsGrid';
import AdSenseDisplayUnit from '@/components/AdSenseDisplayUnit';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-start text-center px-4 py-12 pb-36 gap-10 sm:gap-14">
      {/* Hero */}
      <div className="space-y-4 max-w-2xl pt-4">
        {/* Logo mark — AI-generated icon with neon glow */}
        <div className="flex justify-center mb-2">
          <Image
            src="/logo-mark.png"
            alt="PromptFM icon"
            width={100}
            height={100}
            className="sm:w-[120px] sm:h-[120px] rounded-2xl drop-shadow-[0_0_32px_rgba(52,211,153,0.45)]"
            priority
          />
        </div>

        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          4 LIVE CHANNELS · 24/7 BROADCAST
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
          The AI Music Radio <br />
          <span className="text-emerald-400">Community</span>
        </h1>

        <p className="text-zinc-400 text-sm sm:text-base md:text-lg max-w-xl mx-auto px-2">
          Discover, vote on, and submit AI-generated music. Tune into 4 curated theme stations
          live around the clock while the community decides what's hot.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto max-w-xs sm:max-w-none justify-center pt-2">
          <a
            href="#channels"
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-xl transition-colors text-sm sm:text-base shadow-lg shadow-emerald-500/20"
          >
            <Radio className="w-4 h-4" />
            Explore Live Channels
          </a>
          <Link
            href="/top"
            className="flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm sm:text-base"
          >
            <Music2 className="w-4 h-4" />
            Weekly Charts
          </Link>
          <Link
            href="/submit"
            className="flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm sm:text-base"
          >
            <Upload className="w-4 h-4" />
            Submit
          </Link>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-400 pt-3">
          {[
            { icon: <Radio className="w-3.5 h-3.5" />, label: '4 Icecast Stations' },
            { icon: <Music2 className="w-3.5 h-3.5" />, label: 'Suno · Udio · Stable Audio' },
            { icon: <Upload className="w-3.5 h-3.5" />, label: 'Direct R2 Upload' },
          ].map(({ icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full"
            >
              {icon} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Google AdSense Display Banner */}
      <AdSenseDisplayUnit slotId="home_middle_banner" className="my-2 max-w-3xl" />

      {/* Live Radio Stations Section */}
      <ChannelsGrid />
    </main>
  );
}
