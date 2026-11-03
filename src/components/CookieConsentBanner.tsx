'use client';

// src/components/CookieConsentBanner.tsx
// Interactive, Google AdSense & GDPR/CCPA compliant Cookie Consent Banner.
// Allows users to accept all cookies or restrict to strictly essential cookies.

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, ShieldCheck, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import {
  COOKIE_CONSENT_POLICY,
  resolveCookieConsent,
  type CookieConsentChoice,
} from '@/lib/legal/policies';

export default function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [currentChoice, setCurrentChoice] = useState<CookieConsentChoice>('unset');

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(COOKIE_CONSENT_POLICY.storageKey);
      const resolved = resolveCookieConsent(raw);
      setCurrentChoice(resolved);
      if (resolved === 'unset') {
        setIsOpen(true);
      }
    } catch {
      // Storage access may fail in private browsing; fail silently
    }

    const handleOpen = () => {
      setIsOpen(true);
      setShowDetails(true);
    };

    window.addEventListener('promptfm-open-cookie-preferences', handleOpen);
    return () => {
      window.removeEventListener('promptfm-open-cookie-preferences', handleOpen);
    };
  }, []);

  const saveConsent = (choice: 'accepted' | 'essential_only') => {
    try {
      localStorage.setItem(COOKIE_CONSENT_POLICY.storageKey, choice);
    } catch {
      // ignore
    }
    setCurrentChoice(choice);
    setIsOpen(false);
    setShowDetails(false);
  };

  if (!mounted || !isOpen) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent banner"
      className="fixed bottom-20 sm:bottom-20 left-2 right-2 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-zinc-900/98 backdrop-blur-xl border border-zinc-700/80 rounded-2xl p-3.5 sm:p-5 shadow-2xl text-zinc-200 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300 max-h-[85vh] overflow-y-auto"
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0 mt-0.5">
          <Cookie className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
              <span>Cookie & Ad Preferences</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                AdSense & GDPR
              </span>
            </h3>
            <button
              type="button"
              onClick={() => {
                if (currentChoice === 'unset') {
                  saveConsent('essential_only');
                } else {
                  setIsOpen(false);
                }
              }}
              className="text-zinc-500 hover:text-zinc-300 p-1 -mr-1"
              aria-label="Dismiss cookie settings"
              title="Close and remember essential cookies"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] sm:text-xs text-zinc-300 leading-relaxed">
            PromptFM uses essential storage to keep live radio playing and remember volume/channels.
            Ad partners (Google AdSense) use cookies to support free 24/7 broadcasting.
          </p>
        </div>
      </div>

      {/* Expandable Details Drawer */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-3 text-xs">
          {/* Essential Category */}
          <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {COOKIE_CONSENT_POLICY.categories.essential.name}
              </span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Always Active
              </span>
            </div>
            <p className="text-zinc-400 text-[11px]">
              {COOKIE_CONSENT_POLICY.categories.essential.description}
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {COOKIE_CONSENT_POLICY.categories.essential.examples.map((item) => (
                <span
                  key={item}
                  className="font-mono text-[10px] px-1.5 py-0.5 bg-zinc-900 text-zinc-300 rounded border border-zinc-800"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Advertising Category */}
          <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">
                {COOKIE_CONSENT_POLICY.categories.advertising.name}
              </span>
              <span className="text-[10px] text-zinc-400">
                Google AdSense & Partners
              </span>
            </div>
            <p className="text-zinc-400 text-[11px]">
              {COOKIE_CONSENT_POLICY.categories.advertising.description}
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {COOKIE_CONSENT_POLICY.categories.advertising.examples.map((item) => (
                <span
                  key={item}
                  className="font-mono text-[10px] px-1.5 py-0.5 bg-zinc-900 text-zinc-300 rounded border border-zinc-800"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors underline decoration-dotted underline-offset-4"
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Hide Details</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Customize & Details</span>
              </>
            )}
          </button>
          <Link
            href="/privacy#advertising"
            className="text-emerald-400 hover:underline text-[11px]"
          >
            Privacy & Ad Disclosures
          </Link>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => saveConsent('essential_only')}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700/80 whitespace-nowrap"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => saveConsent('accepted')}
            className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Accept All</span>
          </button>
        </div>
      </div>
    </div>
  );
}
