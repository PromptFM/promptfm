import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Image from 'next/image';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import AudioPlayer from '@/components/AudioPlayer';
import AuthButton from '@/components/AuthButton';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
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
    site: '@PromptFM',
    creator: '@PromptFM',
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

        {/* Navigation */}
        <nav className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
            <a
              href="/"
              className="flex items-center gap-2 group flex-shrink-0"
              aria-label="PromptFM home"
            >
              <Image
                src="/logo-mark.png"
                alt="PromptFM logo mark"
                width={28}
                height={28}
                className="rounded-md transition-opacity group-hover:opacity-80"
                priority
              />
              <span className="font-bold text-base sm:text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                Prompt<span className="text-emerald-400">FM</span>
              </span>
            </a>

            <div className="flex items-center gap-2 sm:gap-4 md:gap-6 text-xs sm:text-sm font-medium">
              <a
                href="/#channels"
                className="text-zinc-400 hover:text-white transition-colors py-1 px-1 flex items-center gap-1"
              >
                <span>Channels</span>
              </a>
              <a
                href="/top"
                className="text-zinc-400 hover:text-white transition-colors py-1 px-1"
              >
                Charts
              </a>
              <a
                href="/admin"
                className="text-zinc-400 hover:text-emerald-400 transition-colors text-[11px] sm:text-xs font-semibold px-2 py-1 sm:px-2.5 rounded-md border border-zinc-800 hover:border-zinc-700 bg-zinc-900/50"
              >
                Studio
              </a>
              <a
                href="/submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-black px-2.5 py-1.5 sm:px-3 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap"
              >
                Submit<span className="hidden sm:inline"> Track</span>
              </a>
              <AuthButton />
            </div>
          </div>
        </nav>

        {/* Top Sponsor Ribbon */}
        <SponsorBanner />

        {/* Page content */}
        <div className="min-h-[calc(100vh-3.5rem)] flex flex-col justify-between">
          <div className="flex-1">{children}</div>
          <Footer />
        </div>

        {/* Sticky live stream player */}
        <AudioPlayer />

        {/* Vercel 0-Cost Real-Time Web Analytics */}
        <Analytics />
      </body>
    </html>
  );
}

