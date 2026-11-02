// src/app/admin/layout.tsx
// Strict no-index layout for the internal PromptFM Studio and Admin Dashboard.

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Station Studio & Admin Control',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
