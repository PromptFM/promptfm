// src/app/dmca/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DMCA Copyright Policy & Designated Agent — PromptFM',
  description:
    'PromptFM statutory DMCA copyright policy, designated agent contact details, 6-point takedown notice form, counter-notification procedure, and repeat infringer policy pursuant to 17 U.S.C. § 512.',
  alternates: {
    canonical: '/dmca',
  },
  openGraph: {
    title: 'DMCA Copyright Compliance & Safe Harbor — PromptFM',
    description:
      'Official DMCA Designated Agent disclosures, takedown request intake, and copyright policies for PromptFM 24/7 AI Radio.',
    url: '/dmca',
  },
};

export default function DmcaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
