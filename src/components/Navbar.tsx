'use client';

// src/components/Navbar.tsx
// Streamlined, mobile-first responsive top navigation with clean visual hierarchy,
// desktop community popover, and thumb-friendly mobile drawer.

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Menu,
  X,
  Radio,
  Music2,
  Shield,
  Upload,
  MessageSquare,
  Send,
  Sparkles,
  Calendar,
  Code2,
  Heart,
  ChevronDown,
} from 'lucide-react';
import AuthButton from '@/components/AuthButton';
import { getCommunityLinks } from '@/lib/community/links';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const links = getCommunityLinks();

  const closeMenu = () => {
    setMobileMenuOpen(false);
    setCommunityOpen(false);
  };

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCommunityOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCommunityOpen(false);
        setMobileMenuOpen(false);
      }
    };

    if (communityOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [communityOpen]);

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          href="/"
          onClick={closeMenu}
          className="flex items-center gap-2.5 group flex-shrink-0"
        >
          <div className="relative">
            <Image
              src="/logo-mark.png"
              alt="PromptFM logo mark"
              width={30}
              height={30}
              className="rounded-lg transition-transform duration-200 group-hover:scale-105"
              priority
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-950" />
          </div>

          <div className="flex items-center">
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white group-hover:text-emerald-400 transition-colors">
              Prompt<span className="text-emerald-400">FM</span>
            </span>
            <span className="hidden xl:inline-flex items-center gap-1.5 ml-2.5 px-2 py-0.5 text-[10px] uppercase font-mono font-bold tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              24/7 AI Radio
            </span>
          </div>
        </Link>

        {/* Desktop Primary Navigation Links (Center-Left) */}
        <div className="hidden md:flex items-center gap-1 lg:gap-2 text-xs lg:text-sm font-medium">
          <Link
            href="/#channels"
            className="text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-900/60 transition-colors"
          >
            Channels
          </Link>

          <Link
            href="/schedule"
            className="text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-900/60 transition-colors"
          >
            Schedule
          </Link>

          <Link
            href="/top"
            className="text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-900/60 transition-colors"
          >
            Charts
          </Link>

          <Link
            href="/#funding"
            className="text-zinc-300 hover:text-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-950/30 transition-colors flex items-center gap-1.5"
          >
            <Heart className="w-3.5 h-3.5 text-emerald-400" />
            <span>Support</span>
          </Link>

          {/* Community & More Popover Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setCommunityOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={communityOpen}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                communityOpen
                  ? 'text-white bg-zinc-900'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
              }`}
            >
              <span>Community</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  communityOpen ? 'rotate-180 text-emerald-400' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {communityOpen && (
              <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl bg-zinc-950/98 border border-zinc-800 shadow-2xl backdrop-blur-xl p-2.5 space-y-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Station & Platform
                </div>

                <Link
                  href="/about"
                  onClick={closeMenu}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors text-xs"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-semibold block">About PromptFM</span>
                    <span className="text-[11px] text-zinc-500">AI DJs & Station Architecture</span>
                  </div>
                </Link>

                <Link
                  href="/#contribute"
                  onClick={closeMenu}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors text-xs"
                >
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-semibold block">Contribute & Code</span>
                    <span className="text-[11px] text-zinc-500">Open-Source $0 Cloud Stack</span>
                  </div>
                </Link>

                <Link
                  href="/admin"
                  onClick={closeMenu}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors text-xs"
                >
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-semibold block">Station Studio</span>
                    <span className="text-[11px] text-zinc-500">DJ Curation & Moderation</span>
                  </div>
                </Link>

                {/* Sub-section: Chat & Socials */}
                <div className="pt-2 mt-1 border-t border-zinc-900">
                  <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Community Bridges
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <a
                      href={links.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/60 hover:bg-indigo-950/40 text-zinc-300 hover:text-indigo-300 border border-zinc-800/80 transition-colors text-xs font-medium"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Discord</span>
                    </a>

                    <a
                      href={links.telegramChannel}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/60 hover:bg-sky-950/40 text-zinc-300 hover:text-sky-300 border border-zinc-800/80 transition-colors text-xs font-medium"
                    >
                      <Send className="w-3.5 h-3.5 text-sky-400" />
                      <span>Telegram</span>
                    </a>

                    <a
                      href={links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800/80 transition-colors text-xs font-medium"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                      <span>GitHub</span>
                    </a>

                    <a
                      href={links.xTwitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800/80 transition-colors text-xs font-medium"
                    >
                      <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span>X</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Action Area (Right) */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/submit"
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-500/15 whitespace-nowrap active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Submit Track</span>
          </Link>

          <AuthButton />
        </div>

        {/* Mobile Header Controls (< 768px) */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            href="/submit"
            onClick={closeMenu}
            className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Submit</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="p-2 rounded-xl border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-emerald-400" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile-First Drawer (< 768px) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-zinc-950/98 backdrop-blur-2xl px-4 py-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-4rem)] overflow-y-auto">
          {/* Section 1: Radio & Programming */}
          <div className="space-y-1.5">
            <div className="px-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              On Air & Music
            </div>
            <div className="bg-zinc-900/60 rounded-2xl p-1.5 border border-zinc-800/80 space-y-0.5">
              <Link
                href="/#channels"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-200 hover:text-emerald-400 hover:bg-zinc-800/60 transition-colors text-sm font-medium"
              >
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Broadcast Channels</span>
              </Link>
              <Link
                href="/schedule"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-200 hover:text-emerald-400 hover:bg-zinc-800/60 transition-colors text-sm font-medium"
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Broadcast Schedule</span>
              </Link>
              <Link
                href="/top"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-200 hover:text-emerald-400 hover:bg-zinc-800/60 transition-colors text-sm font-medium"
              >
                <Music2 className="w-4 h-4 text-emerald-400" />
                <span>Weekly Top 40 Charts</span>
              </Link>
            </div>
          </div>

          {/* Section 2: Participate & Station Info */}
          <div className="space-y-1.5">
            <div className="px-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Community & Station
            </div>
            <div className="bg-zinc-900/60 rounded-2xl p-1.5 border border-zinc-800/80 space-y-0.5">
              <Link
                href="/#funding"
                onClick={closeMenu}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl text-zinc-200 hover:text-emerald-400 hover:bg-zinc-800/60 transition-colors text-sm font-medium"
              >
                <div className="flex items-center gap-3">
                  <Heart className="w-4 h-4 text-emerald-400" />
                  <span>Support & Funding</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  Transparent
                </span>
              </Link>

              <Link
                href="/#contribute"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-200 hover:text-emerald-400 hover:bg-zinc-800/60 transition-colors text-sm font-medium"
              >
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span>Contribute & Open Source</span>
              </Link>

              <Link
                href="/about"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-200 hover:text-emerald-400 hover:bg-zinc-800/60 transition-colors text-sm font-medium"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>About PromptFM</span>
              </Link>

              <Link
                href="/admin"
                onClick={closeMenu}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-200 hover:text-emerald-400 hover:bg-zinc-800/60 transition-colors text-sm font-medium"
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Station Studio & Moderation</span>
              </Link>
            </div>
          </div>

          {/* Section 3: User Account & Sign-in */}
          <div className="pt-2 border-t border-zinc-900">
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/40 rounded-xl border border-zinc-800/80">
              <span className="text-xs text-zinc-400 font-medium">Account Access</span>
              <AuthButton />
            </div>
          </div>

          {/* Section 4: Community Chat Channels */}
          <div className="pt-2 border-t border-zinc-900 space-y-2">
            <div className="px-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              Official Community Channels
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <a
                href={links.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/25 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Discord</span>
              </a>
              <a
                href={links.telegramChannel}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/25 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </a>
              <a
                href={links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>GitHub</span>
              </a>
              <a
                href={links.xTwitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span>X (Twitter)</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
