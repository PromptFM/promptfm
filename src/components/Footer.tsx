'use client';

// src/components/Footer.tsx
// Site-wide responsive footer with agreements, DMCA policy, reporting link, and community links.

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Shield, Flag, Scale, Radio, MessageSquare, Terminal, Cookie, Send, Heart } from 'lucide-react';
import AgreementsModal from '@/components/AgreementsModal';
import ReportModal from '@/components/ReportModal';
import { getCommunityLinks } from '@/lib/community/links';

export default function Footer() {
  const [agreementsOpen, setAgreementsOpen] = useState(false);
  const [agreementsTab, setAgreementsTab] = useState<'terms' | 'copyright' | 'ethics' | 'watershed' | 'dmca'>('terms');
  const [reportOpen, setReportOpen] = useState(false);
  const links = getCommunityLinks();

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
              href="/about"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <span>About PromptFM</span>
            </Link>
            <Link
              href="/#funding"
              className="hover:text-emerald-400 transition-colors flex items-center gap-1 font-semibold text-emerald-400/90"
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Support Station</span>
            </Link>
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
              href={links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3 text-indigo-400" />
              <span>Discord</span>
            </a>
            <a
              href={links.telegramChannel}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-400 transition-colors flex items-center gap-1"
            >
              <Send className="w-3 h-3 text-sky-400" />
              <span>Telegram Channel</span>
            </a>
            <a
              href={links.telegramBot}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-400 transition-colors flex items-center gap-1"
            >
              <Send className="w-3 h-3 text-sky-400" />
              <span>Telegram Bot</span>
            </a>
            <a
              href={links.xTwitter}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>X</span>
            </a>
            <a
              href={links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
            <a
              href={links.mcpProtocol}
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

