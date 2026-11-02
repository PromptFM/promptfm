import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Image from 'next/image';
import './globals.css';
import AudioPlayer from '@/components/AudioPlayer';
import AuthButton from '@/components/AuthButton';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'PromptFM — 24/7 AI Music Radio',
    template: '%s | PromptFM',
  },
  description:
    'PromptFM is a 24/7 live radio station and community chart for AI-generated music. Discover, vote, and submit tracks made with Suno, Udio, Stable Audio, and more.',
  keywords: ['AI music', 'Suno', 'Udio', 'Stable Audio', 'radio', 'community chart'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'PromptFM',
  },
  // Next.js App Router picks up src/app/icon.png automatically as the favicon.
  // The explicit entries below add extra sizes for PWA / Apple touch icon.
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
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
        {/* Navigation */}
        <nav className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <a
              href="/"
              className="flex items-center gap-2 group"
              aria-label="PromptFM home"
            >
              <Image
                src="/logo-mark.png"
                alt="PromptFM logo mark"
                width={30}
                height={30}
                className="rounded-md transition-opacity group-hover:opacity-80"
                priority
              />
              <span className="font-bold text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                Prompt<span className="text-emerald-400">FM</span>
              </span>
            </a>

            <div className="flex items-center gap-6 text-sm font-medium">
              <a
                href="/top"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                Charts
              </a>
              <a
                href="/admin"
                className="text-zinc-400 hover:text-emerald-400 transition-colors text-xs font-semibold px-2.5 py-1 rounded-md border border-zinc-800 hover:border-zinc-700 bg-zinc-900/50"
              >
                Studio
              </a>
              <a
                href="/submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg transition-colors"
              >
                Submit Track
              </a>
              <AuthButton />
            </div>
          </div>
        </nav>

        {/* Page content */}
        {children}

        {/* Sticky live stream player */}
        <AudioPlayer />
      </body>
    </html>
  );
}

