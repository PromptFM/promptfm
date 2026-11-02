// src/app/page.tsx — Landing / Home page

import Link from 'next/link';
import Image from 'next/image';
import { Radio, Music2, Upload } from 'lucide-react';
import LogoMark from '@/components/LogoMark';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center text-center px-4 pb-28 gap-8">
      {/* Hero */}
      <div className="space-y-4 max-w-2xl">
        {/* Logo mark — AI-generated icon with neon glow */}
        <div className="flex justify-center mb-2">
          <Image
            src="/logo-mark.png"
            alt="PromptFM icon"
            width={120}
            height={120}
            className="rounded-2xl drop-shadow-[0_0_32px_rgba(52,211,153,0.45)]"
            priority
          />
        </div>

        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE 24/7
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          The AI Music Radio <br />
          <span className="text-emerald-400">Community</span>
        </h1>

        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          Discover, vote on, and submit AI-generated music. Tune into our live stream
          24/7 while the community decides what's hot this week.
        </p>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/top"
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          <Music2 className="w-4 h-4" />
          View Weekly Charts
        </Link>
        <Link
          href="/submit"
          className="flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          <Upload className="w-4 h-4" />
          Submit a Track
        </Link>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-3 text-sm text-zinc-400 mt-4">
        {[
          { icon: <Radio className="w-3.5 h-3.5" />, label: 'Live Icecast Stream' },
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
    </main>
  );
}

