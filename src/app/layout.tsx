import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Image from 'next/image';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import AudioPlayer from '@/components/AudioPlayer';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import Navbar from '@/components/Navbar';
import SponsorBanner from '@/components/SponsorBanner';
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/seo/structured-data';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'AI music',
    'AI radio',
    'Suno',
    'Udio',
    'Stable Audio',
    'radio live stream',
    'community music chart',
    'generative audio',
    'AI DJ',
    'cyberpunk synthwave',
    'ambient chillout',
  ],
  authors: [{ name: 'PromptFM Team', url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'music',
  classification: 'Music, Radio, Artificial Intelligence',
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    site: '@promptfm_live',
    creator: '@promptfm_live',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-precomposed.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || 'google-site-verification-token',
    other: {
      'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || '',
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PromptFM',
  },
  other: {
    'google-adsense-account': 'ca-pub-7299057534028491',
    'apple-mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-zinc-950 font-sans antialiased">
        {/* Google AdSense Universal Tag */}
        <Script
          id="google-adsense"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7299057534028491"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />

        {/* Schema.org Search Engine Structured Data */}
        <JsonLd />

        {/* Navigation Bar (Desktop + Mobile Hamburger Drawer) */}
        <Navbar />

        {/* Top Sponsor Ribbon */}
        <SponsorBanner />

        {/* Page content */}
        <div className="min-h-[calc(100vh-3.5rem)] flex flex-col justify-between">
          <div className="flex-1">{children}</div>
          <Footer />
        </div>

        {/* Sticky live stream player */}
        <AudioPlayer />

        {/* AdSense & GDPR / CCPA Cookie Consent Manager */}
        <CookieConsentBanner />

        {/* Vercel 0-Cost Real-Time Web Analytics */}
        <Analytics />
      </body>
    </html>
  );
}

