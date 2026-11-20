// src/app/library/layout.tsx
// Metadata layout for the public song library and catalog browser.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Public AI Music Library & Catalog | PromptFM',
  description:
    'Browse the full PromptFM approved AI music library. Search tracks by title, artist, or foundation model (Suno, Udio, Stable Audio), listen to audio previews, upvote favorites, and add songs to the live broadcast queue.',
  alternates: {
    canonical: '/library',
  },
  openGraph: {
    title: 'Public AI Music Library & Song Catalog | PromptFM',
    description:
      'Search and preview approved AI music tracks, vote for rotational airplay, and queue songs live on air.',
    url: 'https://promptfm.live/library',
  },
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
