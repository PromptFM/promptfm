// src/app/channels/page.tsx
// Dedicated PromptFM Theme Radio Channels and Station Directory

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Radio } from 'lucide-react';
import ChannelsGrid from '@/components/ChannelsGrid';

export const metadata: Metadata = {
  title: 'Radio Channels & Stations',
  description:
    'Explore PromptFM live radio stations: Main Stage, Cyberpunk & Synth, Chillout & Ambient, and Kids & Family. Curated 24/7 by AI DJs.',
  alternates: {
    canonical: '/channels',
  },
  openGraph: {
    title: 'Live AI Radio Channels & Theme Stations | PromptFM',
    description:
      'Tune into 4 distinct live streaming channels featuring continuous AI-generated music and autonomous AI radio DJs.',
    url: '/channels',
  },
};

export default function ChannelsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-8 pb-36">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Back Link */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>

        {/* Stations Directory */}
        <ChannelsGrid />
      </div>
    </main>
  );
}
