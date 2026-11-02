// src/app/copyright/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Commercial AI Rights & Voice Clone Rules — PromptFM',
  description:
    'Commercial generative music licensing terms for Suno, Udio, Stable Audio, deepfake vocalist prohibitions, and right-of-publicity protections on PromptFM.',
  alternates: {
    canonical: '/copyright',
  },
  openGraph: {
    title: 'Commercial AI Rights & Anti-Cloning Rules — PromptFM',
    description:
      'PromptFM guidelines for commercial generative audio subscriptions, original prompt certifications, and deepfake artist clone prohibitions.',
    url: '/copyright',
  },
};

export default function CopyrightLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

