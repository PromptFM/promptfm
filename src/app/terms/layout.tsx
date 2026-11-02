// src/app/terms/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service & Broadcast Agreement — PromptFM',
  description:
    'PromptFM comprehensive terms of service, commercial AI broadcasting license grants, user warranties, binding indemnification, and limitation of liability.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service & Broadcast Agreement — PromptFM',
    description:
      'Official terms of service, uploader indemnification, broadcast licenses, and platform rules for PromptFM.',
    url: '/terms',
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
