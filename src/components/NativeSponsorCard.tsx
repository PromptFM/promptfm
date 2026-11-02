'use client';

// src/components/NativeSponsorCard.tsx
// Seamless in-feed native sponsor card for weekly charts and feed lists.

import React, { useEffect } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import {
  DEFAULT_SPONSOR_CAMPAIGNS,
  SponsorBanner,
} from '@/lib/ads/banner-service';

interface NativeSponsorCardProps {
  campaignId?: string;
  className?: string;
}

export default function NativeSponsorCard({
  campaignId = 'suno_creator',
  className = '',
}: NativeSponsorCardProps) {
  const banner: SponsorBanner =
    DEFAULT_SPONSOR_CAMPAIGNS.find((c) => c.id === campaignId) ||
    DEFAULT_SPONSOR_CAMPAIGNS[0]!;

  useEffect(() => {
    try {
      fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: banner.id, event: 'impression' }),
      }).catch(() => {});
    } catch {
      // Ignore network failures
    }
  }, [banner.id]);

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
      className={`p-4 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500/50 transition-all shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}
      role="article"
      aria-label={`Sponsored by ${banner.sponsor}`}
    >
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 shadow-inner">
          <Sparkles className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
              {banner.badge || 'Sponsored'}
            </span>
            <span className="text-xs font-semibold text-zinc-400">{banner.sponsor}</span>
          </div>
          <h3 className="text-sm font-bold text-white truncate mt-0.5">{banner.title}</h3>
          <p className="text-xs text-zinc-300 leading-snug line-clamp-1 sm:line-clamp-2 mt-0.5">
            {banner.description}
          </p>
        </div>
      </div>

      <a
        href={banner.targetUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleCtaClick}
        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 flex-shrink-0"
      >
        <span>{banner.ctaText}</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}
