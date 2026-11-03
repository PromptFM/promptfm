'use client';

// src/components/AdSenseDisplayUnit.tsx
// Responsive, dark-themed Google AdSense ad unit with CLS protection.

import React, { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT_ID } from '@/lib/ads/adsense';

interface AdSenseDisplayUnitProps {
  slotId?: string;
  format?: 'auto' | 'horizontal' | 'rectangle';
  className?: string;
  label?: string;
}

export default function AdSenseDisplayUnit({
  slotId = 'default-slot',
  format = 'auto',
  className = '',
  label = 'Advertisement',
}: AdSenseDisplayUnitProps) {
  const adPushedRef = useRef(false);

  useEffect(() => {
    if (adPushedRef.current) return;
    try {
      if (typeof window !== 'undefined') {
        const adsWindow = window as unknown as { adsbygoogle?: Array<Record<string, unknown>> };
        adsWindow.adsbygoogle = adsWindow.adsbygoogle || [];
        adsWindow.adsbygoogle.push({});
        adPushedRef.current = true;
      }
    } catch {
      // Ignore adblocker or script load exceptions
    }
  }, []);

  return (
    <div
      className={`relative my-6 mx-auto w-full max-w-4xl rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-3 sm:p-4 transition-all shadow-sm overflow-hidden ${className}`}
      role="region"
      aria-label="Sponsored advertisement"
    >
      {/* Top Ad Label */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/50 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold select-none">
        <span>{label}</span>
        <span className="text-[9px] text-zinc-600 font-mono">PromptFM Sponsor</span>
      </div>

      {/* AdSense ins tag */}
      <div className="min-h-[100px] sm:min-h-[120px] flex items-center justify-center text-center overflow-hidden">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}

