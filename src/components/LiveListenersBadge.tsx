'use client';

// src/components/LiveListenersBadge.tsx
// Real-time listener telemetry badge for the hero section

import React, { useEffect, useState } from 'react';

export default function LiveListenersBadge() {
  const [listenerCount, setListenerCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      try {
        const res = await fetch('/api/radio/now?channel=main');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.listeners?.network_total) {
            setListenerCount(data.listeners.network_total);
          } else if (mounted && data.listeners_count) {
            setListenerCount(data.listeners_count);
          }
        }
      } catch {
        // Silently preserve previous value
      }
    }

    fetchStats();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchStats();
    }, 15000);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchStats();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  return (
    <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span>4 LIVE CHANNELS</span>
      <span className="text-emerald-500/40">·</span>
      <span>24/7 BROADCAST</span>
      {listenerCount !== null && (
        <>
          <span className="text-emerald-500/40">·</span>
          <span
            className="text-white font-bold"
            title={`${listenerCount} total live listeners across all PromptFM channels`}
          >
            {listenerCount} NETWORK LISTENERS
          </span>
        </>
      )}
    </div>
  );
}

