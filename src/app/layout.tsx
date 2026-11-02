import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AudioPlayer from '@/components/AudioPlayer';

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
              className="font-bold text-lg tracking-tight text-white hover:text-emerald-400 transition-colors"
            >
              Prompt<span className="text-emerald-400">FM</span>
            </a>

            <div className="flex items-center gap-6 text-sm font-medium">
              <a
                href="/top"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                Charts
              </a>
              <a
                href="/submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg transition-colors"
              >
                Submit Track
              </a>
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
