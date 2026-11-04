// src/app/about/page.tsx
// Comprehensive editorial publication and documentation about PromptFM.
// Complies strictly with Google AdSense Publisher Content & Quality Guidelines.

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Radio, Music2, Cpu, ShieldCheck, HeartHandshake, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About PromptFM — The Autonomous AI Radio Network',
  description:
    'Learn about PromptFM: our autonomous AI DJ broadcast architecture, neural music generation models (Suno, Udio, Stable Audio), community governance, and copyright transparency.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About PromptFM | The Future of Autonomous AI Radio',
    description:
      'Continuous 24/7 AI-generated music, autonomous AI radio DJs, and community-driven charts.',
    url: '/about',
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-12 pb-36">
      <article className="max-w-4xl mx-auto space-y-10">
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
            <Radio className="w-3.5 h-3.5" />
            Station Whitepaper & Editorial Guide
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Inside PromptFM: The Architecture of Autonomous AI Radio
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed">
            PromptFM is a 24/7 autonomous broadcast network dedicated to exploring the intersection of generative AI,
            community curation, and traditional radio clock-wheel programming.
          </p>
        </header>

        {/* Content Section 1: The Mission */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            1. Our Mission: Democratic Discovery for AI Creators
          </h2>
          <div className="prose prose-invert max-w-none text-zinc-300 text-sm sm:text-base leading-relaxed space-y-3">
            <p>
              Generative artificial intelligence has democratized music creation. Everyday songwriters, producers, and prompt engineers
              can synthesize studio-quality compositions across any genre—from dark synthwave and industrial metal to lo-fi chillout and
              orchestral ambient. However, distribution remains fragmented across disparate Discord channels and social feeds.
            </p>
            <p>
              PromptFM solves this discovery challenge by providing a unified, community-curated radio station that streams 24 hours a day,
              365 days a year. Every listener has equal power: tracks are submitted directly by the community, upvoted in real time, and
              scheduled according to algorithmic fairness and listener demand.
            </p>
          </div>
        </section>

        {/* Content Section 2: Autonomous AI DJs */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            2. The Autonomous AI DJ Engine
          </h2>
          <div className="prose prose-invert max-w-none text-zinc-300 text-sm sm:text-base leading-relaxed space-y-3">
            <p>
              At the heart of PromptFM are autonomous radio DJ personas powered by Google Gemini and advanced neural text-to-speech models.
              Each DJ possesses distinct musical preferences, historical knowledge, and vocal tone:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>
                <strong className="text-emerald-400">DJ Neon (Main Stage):</strong> High-energy, witty, and passionate about synthwave,
                synth-pop, and chart-topping community hits.
              </li>
              <li>
                <strong className="text-purple-400">DJ Cipher (Cyberpunk & 18+ After Dark):</strong> Edgy, technical, and analytical, specializing
                in industrial basslines, dark electronic textures, and late-night underground audio.
              </li>
              <li>
                <strong className="text-teal-400">DJ Luna (Chillout & Ambient):</strong> Meditative and calming, curating soothing lo-fi study beats,
                drone soundscapes, and restful night music.
              </li>
              <li>
                <strong className="text-amber-400">DJ Pixel (Kids & Family):</strong> Cheerful, playful, and educational, hosting wholesome 8-bit
                chiptunes, family-safe nursery singalongs, and gaming melodies.
              </li>
            </ul>
          </div>
        </section>

        {/* Content Section 3: Semantic Discovery with pgvector */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Music2 className="w-5 h-5 text-emerald-400" />
            3. Semantic Audio Retrieval & Prompt Engineering
          </h2>
          <div className="prose prose-invert max-w-none text-zinc-300 text-sm sm:text-base leading-relaxed space-y-3">
            <p>
              Unlike traditional radio stations that tag tracks strictly by broad genre metadata, PromptFM indexes full textual prompts,
              musical instruments, lyrical themes, and emotional vibes using high-dimensional vector embeddings stored in PostgreSQL via pgvector.
            </p>
            <p>
              When a listener on Discord or Telegram types <code className="bg-zinc-800 text-emerald-300 px-1.5 py-0.5 rounded text-xs">/song rainy midnight drive in tokyo</code>,
              the PromptFM RAG (Retrieval-Augmented Generation) pipeline calculates cosine distance against the station library, finding tracks
              that match the precise mood and aesthetic within milliseconds.
            </p>
          </div>
        </section>

        {/* Content Section 4: Ethical Governance & Copyright */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            4. Ethical Standards, Parental Controls & Statutory Copyright Protection
          </h2>
          <div className="prose prose-invert max-w-none text-zinc-300 text-sm sm:text-base leading-relaxed space-y-3">
            <p>
              PromptFM adheres strictly to international broadcasting standards and intellectual property regulations:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-300">
              <li>
                <strong>COPPA & Family Isolation:</strong> Educational nursery rhymes and children&apos;s tracks (such as the Alphabet Song) are
                strictly isolated to Channel 4 (Kids & Family) and barred from airing on adult channels.
              </li>
              <li>
                <strong>Watershed Parental Controls:</strong> Uncensored or explicit lyrics are blocked on all family channels 24/7 and only
                permitted during late-night watershed hours or on designated 18+ channels.
              </li>
              <li>
                <strong>DMCA Compliance (17 U.S.C. § 512):</strong> We maintain an automated DMCA takedown intake system and registered copyright
                agent to address any copyright ownership questions promptly.
              </li>
            </ul>
          </div>
        </section>

        {/* Footer Navigation */}
        <footer className="pt-8 border-t border-zinc-800 flex flex-wrap gap-4 items-center justify-between text-xs text-zinc-400">
          <span>&copy; {new Date().getFullYear()} PromptFM. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/schedule" className="hover:text-emerald-400 transition-colors">Broadcast Schedule</Link>
            <Link href="/channels" className="hover:text-emerald-400 transition-colors">Radio Channels</Link>
            <Link href="/privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-emerald-400 transition-colors">Terms of Service</Link>
          </div>
        </footer>
      </article>
    </main>
  );
}
