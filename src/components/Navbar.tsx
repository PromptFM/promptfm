'use client';

// src/components/Navbar.tsx
// Responsive top navigation with desktop bar and mobile slide-out drawer (hamburger menu)

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, Radio, Music2, Shield, Upload, MessageSquare, Send, Sparkles, Calendar } from 'lucide-react';
import AuthButton from '@/components/AuthButton';
import { getCommunityLinks } from '@/lib/community/links';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const links = getCommunityLinks();

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          href="/"
          onClick={closeMenu}
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
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-4 lg:gap-6 text-xs sm:text-sm font-medium">
          <Link
            href="/#channels"
            className="text-zinc-400 hover:text-white transition-colors py-1 flex items-center gap-1"
          >
            Channels
          </Link>
          <Link
            href="/schedule"
            className="text-zinc-400 hover:text-white transition-colors py-1 flex items-center gap-1"
          >
            Schedule
          </Link>
          <Link
            href="/about"
            className="text-zinc-400 hover:text-white transition-colors py-1"
          >
            About
          </Link>
          <Link
            href="/top"
            className="text-zinc-400 hover:text-white transition-colors py-1"
          >
            Charts
          </Link>
          <Link
            href="/admin"
            className="text-zinc-400 hover:text-emerald-400 transition-colors text-xs font-semibold px-2.5 py-1 rounded-md border border-zinc-800 hover:border-zinc-700 bg-zinc-900/50"
          >
            Studio
          </Link>
          <Link
            href="/submit"
            className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap"
          >
            Submit Track
          </Link>
          <AuthButton />
          <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
            <a
              href={links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-indigo-400 p-1 transition-colors"
              title="PromptFM Discord"
              aria-label="PromptFM Discord"
            >
              <MessageSquare className="w-4 h-4" />
            </a>
            <a
              href={links.telegramChannel}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-sky-400 p-1 transition-colors"
              title="PromptFM Telegram Channel"
              aria-label="PromptFM Telegram Channel"
            >
              <Send className="w-4 h-4" />
            </a>
            <a
              href={links.xTwitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white p-1 transition-colors"
              title="PromptFM on X"
              aria-label="PromptFM on X"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href={links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white p-1 transition-colors"
              title="PromptFM on GitHub"
              aria-label="PromptFM on GitHub"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Mobile Action Buttons (< 768px) */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            href="/submit"
            onClick={closeMenu}
            className="bg-emerald-500 hover:bg-emerald-400 text-black px-2.5 py-1 rounded-lg font-bold text-xs transition-colors flex items-center gap-1"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Submit</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="p-1.5 rounded-lg border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-emerald-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-zinc-950/98 backdrop-blur-xl px-4 py-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-1 text-sm font-medium">
            <Link
              href="/#channels"
              onClick={closeMenu}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Broadcast Channels</span>
            </Link>
            <Link
              href="/schedule"
              onClick={closeMenu}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>24/7 Broadcast Schedule</span>
            </Link>
            <Link
              href="/about"
              onClick={closeMenu}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>About PromptFM</span>
            </Link>
            <Link
              href="/top"
              onClick={closeMenu}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <Music2 className="w-4 h-4 text-emerald-400" />
              <span>Weekly Top 40 Charts</span>
            </Link>
            <Link
              href="/admin"
              onClick={closeMenu}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Station Studio & Moderation</span>
            </Link>
          </div>

          {/* User Sign In / Profile in Mobile Drawer */}
          <div className="pt-3 border-t border-zinc-900 flex items-center justify-between px-2">
            <span className="text-xs text-zinc-400 font-medium">Account</span>
            <AuthButton />
          </div>

          {/* Community Links in Mobile Drawer */}
          <div className="pt-3 border-t border-zinc-900 grid grid-cols-2 gap-2 text-xs font-semibold">
            <a
              href={links.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Discord</span>
            </a>
            <a
              href={links.telegramChannel}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram</span>
            </a>
            <a
              href={links.xTwitter}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 transition-colors"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>X (Twitter)</span>
            </a>
            <a
              href={links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 transition-colors"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

