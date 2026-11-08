// src/app/page.tsx — Landing / Home page

import Link from 'next/link';
import Image from 'next/image';
import { Radio, Music2, Upload, Code2, Heart } from 'lucide-react';
import ChannelsGrid from '@/components/ChannelsGrid';
import AdSenseDisplayUnit from '@/components/AdSenseDisplayUnit';
import LiveListenersBadge from '@/components/LiveListenersBadge';
import UpNextSection from '@/components/UpNextSection';
import FundingSection from '@/components/FundingSection';
import ContributeSection from '@/components/ContributeSection';
import CommunitySection from '@/components/CommunitySection';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-start text-center px-4 py-8 sm:py-12 pb-36 gap-8 sm:gap-12">
      {/* Hero */}
      <div className="space-y-3.5 max-w-2xl pt-2 sm:pt-4">
        {/* Main Stage Station Icon Treatment — Branded emblem with live pulse indicator */}
        <div className="flex justify-center mb-2">
          <div className="relative inline-flex flex-col items-center">
            <div className="relative">
              <Image
                src="/logo-mark.png"
                alt="PromptFM Main Stage 24/7 AI Radio"
                width={100}
                height={100}
                className="w-[90px] h-[90px] sm:w-[115px] sm:h-[115px] rounded-2xl drop-shadow-[0_0_36px_rgba(52,211,153,0.5)] border border-emerald-500/30 ring-2 ring-emerald-500/20"
                priority
              />
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-950/95 border border-emerald-500/40 text-[10px] font-bold text-emerald-400 shadow-lg tracking-wider uppercase whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Main Stage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time live listeners telemetry badge */}
        <LiveListenersBadge />

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
          Community-Driven <br />
          <span className="text-emerald-400">AI Radio</span>
        </h1>

        <p className="text-zinc-400 text-xs sm:text-base max-w-xl mx-auto px-2">
          Discover, vote on, and submit AI-generated music. Tune into PromptFM Main Stage
          live around the clock while the community and open-source developers drive the radio forward.
        </p>

        {/* CTAs */}
        <div
          id="hero-ctas"
          className="flex flex-col items-center justify-center gap-3 w-full pt-1 sm:pt-2"
        >
          {/* Primary Main Stage Hero Action */}
          <div data-testid="hero-primary-cta" className="w-full sm:w-auto flex justify-center">
            <a
              href="#channels"
              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-7 py-3 rounded-xl transition-colors text-sm sm:text-base shadow-lg shadow-emerald-500/20 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <Radio className="w-4 h-4" />
              Tune In Main Stage
            </a>
          </div>

          {/* Secondary Station Actions Cluster */}
          <div
            data-testid="hero-secondary-cta-group"
            aria-label="Secondary station actions"
            className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2.5 sm:gap-3 w-full max-w-md sm:max-w-none"
          >
            <Link
              href="/top"
              className="flex items-center justify-center gap-1.5 sm:gap-2 border border-zinc-700 hover:border-zinc-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-xs sm:text-sm whitespace-nowrap bg-zinc-900/60 hover:bg-zinc-800/80 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <Music2 className="w-4 h-4" />
              Weekly Charts
            </Link>
            <a
              href="#funding"
              className="flex items-center justify-center gap-1.5 sm:gap-2 border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 hover:text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-xs sm:text-sm bg-emerald-950/30 hover:bg-emerald-900/40 shadow-sm shadow-emerald-500/10 whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <Heart className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
              Support Station
            </a>
            <a
              href="#contribute"
              className="flex items-center justify-center gap-1.5 sm:gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-xs sm:text-sm bg-zinc-900/60 hover:bg-zinc-800/80 whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <Code2 className="w-4 h-4 text-emerald-400" />
              Contribute
            </a>
            <Link
              href="/submit"
              className="flex items-center justify-center gap-1.5 sm:gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-xs sm:text-sm bg-zinc-900/60 hover:bg-zinc-800/80 whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <Upload className="w-4 h-4" />
              Submit
            </Link>
          </div>
        </div>

        {/* Feature pills */}
        <div
          data-testid="hero-feature-pills"
          className="flex flex-wrap justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-400 pt-3"
        >
          {[
            { icon: <Radio className="w-3.5 h-3.5 text-emerald-400" />, label: 'Main Stage · 24/7 AI Radio' },
            { icon: <Code2 className="w-3.5 h-3.5 text-emerald-400" />, label: 'Open Community Development' },
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

      {/* Live Radio Stations Section */}
      <ChannelsGrid />

      {/* Up Next on Air Section */}
      <UpNextSection />

      {/* Editorial Publisher Section: Inside PromptFM & AI Music Architecture */}
      <section className="w-full max-w-4xl mx-auto px-4 mt-6 text-left space-y-6 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-xl">
        <div className="border-b border-zinc-800 pb-4">
          <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase">
            PromptFM Editorial & Station Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            The Autonomous AI Radio Revolution
          </h2>
          <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">
            PromptFM is the world&apos;s first autonomous, community-curated 24/7 AI radio network. 
            Blending frontier neural audio generation with traditional radio clock-wheel programming, 
            the station delivers continuous music curated in real-time by resident AI DJ personas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-zinc-300 leading-relaxed">
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-emerald-400" />
              Clock-Wheel Automation & AI Personalities
            </h3>
            <p>
              Traditional commercial radio relies on precise hourly clock wheels—cadences that balance 
              upbeat hits, listener requests, station identifiers, and community announcements. PromptFM 
              modernizes this format using Google Gemini 2.5 and 3.5 architectures. Four autonomous 
              AI DJ personas—DJ Neon, DJ Cipher, DJ Luna, and DJ Pixel—program their shifts around the 
              clock, adapting style, vocal cadence, and music selection dynamically according to UTC time slots.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <Music2 className="w-4 h-4 text-emerald-400" />
              Frontier Neural Audio Synthesis
            </h3>
            <p>
              Every track broadcast on PromptFM represents original creative prompt engineering executed 
              through state-of-the-art foundation models including Suno v3.5, Udio v1.5, and Stable Audio. 
              Creators input natural language prompts, harmonic chord progressions, and lyric poetry, 
              which generative diffusion networks transform into studio-grade master audio. PromptFM 
              indexes each track&apos;s sonic embeddings via pgvector for semantic search and automated thematic matching.
            </p>
          </div>
        </div>

        {/* Google AdSense Display Banner (Nested within rich editorial publisher content) */}
        <AdSenseDisplayUnit slotId="home_middle_banner" className="my-6 max-w-full" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm text-zinc-300 leading-relaxed pt-2 border-t border-zinc-800">
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-emerald-400" />
              Democratic Listener Governance
            </h3>
            <p>
              Airplay on PromptFM is governed 100% democratically by the community. Listeners upvote 
              tracks in real time through the web player or directly via Discord and Telegram bot 
              integrations. Higher-voted tracks receive elevated rotational weight during prime-time 
              countdown shows, while community requests queued in Telegram and Discord are automatically 
              slotted into upcoming broadcast milestones.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-emerald-400" />
              Statutory Copyright & Safety Guardrails
            </h3>
            <p>
              To protect artists and rightsholders, PromptFM implements automated safety guardrails, 
              including family-safe filtering on the main stage broadcast, late-night watershed parental controls, 
              and a direct DMCA statutory notice agent registered under 17 U.S.C. § 512(c).
            </p>
          </div>
        </div>
      </section>

      {/* Community Funding & Transparency Section */}
      <FundingSection />

      {/* Community Development & Open Source Contributor Portal */}
      <ContributeSection />

      {/* Discord & Telegram Community Section */}
      <CommunitySection />
    </main>
  );
}
