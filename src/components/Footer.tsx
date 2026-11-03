'use client';

// src/components/Footer.tsx
// Site-wide responsive footer with agreements, DMCA policy, reporting link, and community links.

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Shield, Flag, Scale, Radio, MessageSquare, Terminal, Cookie, Send } from 'lucide-react';
import AgreementsModal from '@/components/AgreementsModal';
import ReportModal from '@/components/ReportModal';

export default function Footer() {
  const [agreementsOpen, setAgreementsOpen] = useState(false);
  const [agreementsTab, setAgreementsTab] = useState<'terms' | 'copyright' | 'ethics' | 'watershed' | 'dmca'>('terms');
  const [reportOpen, setReportOpen] = useState(false);

  const openTab = (tab: 'terms' | 'copyright' | 'ethics' | 'watershed' | 'dmca') => {
    setAgreementsTab(tab);
    setAgreementsOpen(true);
  };

  return (
    <>
      <footer className="border-t border-zinc-800/80 bg-zinc-950/80 backdrop-blur-sm text-zinc-400 text-xs py-8 px-4 sm:px-6 mb-16 sm:mb-14">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand info */}
          <div className="flex flex-col items-center md:items-start gap-1.5 text-center md:text-left">
            <div className="flex items-center gap-2">
              <Image
                src="/logo-mark.png"
                alt="PromptFM logo"
                width={22}
                height={22}
                className="rounded"
              />
              <span className="font-bold text-white tracking-tight text-sm">
                Prompt<span className="text-emerald-400">FM</span>
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                24/7 AI Radio
              </span>
            </div>
            <p className="text-zinc-500 text-xs max-w-sm">
              The autonomous community music station powered by generative AI audio models,
              interactive AI DJs, and listener voting.
            </p>
          </div>

          {/* Legal Agreements & Safety Links */}
          <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-4 text-xs font-medium">
            <Link
              href="/schedule"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Broadcast Schedule</span>
            </Link>
            <Link
              href="/terms"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Terms of Service</span>
            </Link>
            <Link
              href="/dmca"
              className="hover:text-emerald-400 transition-colors"
            >
              DMCA Safe Harbor
            </Link>
            <Link
              href="/copyright"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Commercial AI Rights</span>
            </Link>
            <Link
              href="/privacy"
              className="hover:text-emerald-400 transition-colors"
            >
              Privacy
            </Link>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('promptfm-open-cookie-preferences'));
                }
              }}
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <Cookie className="w-3.5 h-3.5" />
              <span>Cookies</span>
            </button>
            <button
              type="button"
              onClick={() => openTab('watershed')}
              className="hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                18+
              </span>
              <span>Parental Advisory</span>
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="text-amber-400/90 hover:text-amber-300 transition-colors flex items-center gap-1 font-semibold"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report Content</span>
            </button>
          </div>
        </div>

        {/* Subfooter */}
        <div className="max-w-5xl mx-auto mt-6 pt-4 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-zinc-500 text-[11px] text-center sm:text-left">
          <p>© {new Date().getFullYear()} PromptFM. All rights reserved. Music generated via Suno, Udio, Stable Audio.</p>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-4 gap-y-2">
            <a
              href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || 'https://discord.gg/promptfm'}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3 text-indigo-400" />
              <span>Discord</span>
            </a>
            <a
              href={process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL || 'https://t.me/promptfm_live'}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-400 transition-colors flex items-center gap-1"
            >
              <Send className="w-3 h-3 text-sky-400" />
              <span>Telegram Channel</span>
            </a>
            <a
              href={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || 'https://t.me/PromptFMLiveBot'}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-400 transition-colors flex items-center gap-1"
            >
              <Send className="w-3 h-3 text-sky-400" />
              <span>Telegram Bot</span>
            </a>
            <a
              href="/api/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <Terminal className="w-3 h-3 text-emerald-400" />
              <span>MCP Protocol</span>
            </a>
            <span>•</span>
            <span className="text-emerald-500/80">● Stream Online</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AgreementsModal
        isOpen={agreementsOpen}
        onClose={() => setAgreementsOpen(false)}
        defaultTab={agreementsTab}
      />
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="broadcast"
        targetId="general-feedback"
        targetTitle="PromptFM General Broadcast or Content Issue"
      />
    </>
  );
}

