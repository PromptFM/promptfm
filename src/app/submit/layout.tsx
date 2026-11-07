// src/app/submit/layout.tsx
// Metadata layout for the track submission page.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Submit Your AI-Generated Track for 24/7 Airplay',
  description:
    'Submit your Suno, Udio, or Stable Audio generated track to PromptFM. Automatic ID3 metadata and album art extraction, broadcast safety evaluation, and community chart voting.',
  alternates: {
    canonical: '/submit',
  },
  openGraph: {
    title: 'Submit AI Music to PromptFM Radio',
    description:
      'Submit your original AI tracks for airplay on the PromptFM Main Stage and the weekly community chart.',
    url: '/submit',
  },
};

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
