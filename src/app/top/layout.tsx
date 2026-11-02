// src/app/top/layout.tsx
// Metadata layout for the weekly AI music charts page.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Weekly AI Music Charts & Top Community Tracks',
  description:
    'Discover the top community-voted AI music tracks on PromptFM. Listen to full preview samples, explore generator tools (Suno, Udio, Stable Audio), and vote for your favorites.',
  alternates: {
    canonical: '/top',
  },
  openGraph: {
    title: 'Weekly AI Music Charts | PromptFM',
    description:
      'Community-ranked top 20 AI music chart. Listen, discover generation models, and cast your votes live.',
    url: '/top',
  },
};

export default function TopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
