import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Image from 'next/image';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import AudioPlayer from '@/components/AudioPlayer';
import CookieConsentBanner from '@/components/CookieConsentBanner';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import Navbar from '@/components/Navbar';
import SponsorBanner from '@/components/SponsorBanner';
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/seo/structured-data';
import { siteMetadata } from '@/lib/seo/site-metadata';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = siteMetadata;

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

        {/* Vercel 0-Cost Real-Time Web Analytics & Speed Insights */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

