// src/app/privacy/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — PromptFM',
  description:
    'PromptFM privacy disclosures, data processing practices, cookies, voting telemetry, and GDPR / CCPA user rights.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy — PromptFM',
    description: 'Information collection, listener telemetry, and privacy disclosures for PromptFM 24/7 AI Radio.',
    url: '/privacy',
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
