'use client';

// src/components/SponsorBanner.tsx
// Responsive dismissible sponsor ribbon component for website header or footer.
// Logs anonymous impressions and clicks; adheres to privacy-safe standards.

import React, { useEffect, useState } from 'react';
import { Sparkles, ExternalLink, X } from 'lucide-react';
import { DEFAULT_SPONSOR_CAMPAIGNS } from '@/lib/ads/banner-service';

interface SponsorBannerProps {
  placement?: 'header_ribbon' | 'in_feed';
  className?: string;
}

export default function SponsorBanner({
  placement = 'header_ribbon',
  className = '',
}: SponsorBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  const eligibleBanners = DEFAULT_SPONSOR_CAMPAIGNS.filter(
    (b) => b.active && b.placements.includes(placement)
  );

  const banner = eligibleBanners[currentAdIndex] || eligibleBanners[0];

  useEffect(() => {
    if (!banner || dismissed) return;

    // Log impression anonymously
    try {
      fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: banner.id, event: 'impression' }),
      }).catch(() => {});
    } catch {
      // Ignore network failures
    }
  }, [banner, dismissed]);

  if (!banner || dismissed) return null;

  const handleCtaClick = () => {
    try {
      fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: banner.id, event: 'click' }),
      }).catch(() => {});
    } catch {
      // Ignore network failures
    }
  };

  return (
    <div
      className={`w-full bg-gradient-to-r from-emerald-950/60 via-zinc-900 to-zinc-950 border-y border-emerald-500/20 px-3 py-2 sm:px-6 sm:py-2.5 text-xs text-zinc-300 relative ${className}`}
      role="complementary"
      aria-label="Sponsor Announcement"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center sm:items-start justify-between gap-2.5 sm:gap-4">
        {/* Left: Badge & Description */}
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2.5 text-center sm:flex-1 sm:flex-nowrap sm:justify-start sm:text-left">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
              {banner.badge || 'Sponsored'}
            </span>
            <span className="font-bold text-white text-xs">{`${banner.sponsor}:`}</span>
          </div>
          <p className="basis-full min-w-0 text-xs leading-relaxed text-zinc-300 whitespace-normal break-words sm:basis-auto sm:flex-1">
            {banner.title} &mdash; <span className="text-zinc-400">{banner.description}</span>
          </p>
        </div>

        {/* Right: CTA Button & Dismiss */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={banner.targetUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={handleCtaClick}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-sm shadow-emerald-500/20"
          >
            <span>{banner.ctaText}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss sponsor message"
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
