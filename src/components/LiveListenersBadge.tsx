'use client';

// src/components/LiveListenersBadge.tsx
// Real-time listener telemetry badge for the hero section

import React, { useEffect, useState } from 'react';
import { getPublicChannels } from '@/lib/radio/channels';
import {
  fetchRadioTelemetry,
  subscribeRadioTelemetry,
  getLatestRadioTelemetry,
} from '@/lib/radio/telemetry-client';

export interface LiveListenersBadgeProps {
  initialCount?: number | null;
}

export default function LiveListenersBadge({ initialCount = null }: LiveListenersBadgeProps = {}) {
  const [listenerCount, setListenerCount] = useState<number | null>(initialCount);
  const publicChannels = getPublicChannels();
  const isSingleStation = publicChannels.length <= 1;

  useEffect(() => {
    let mounted = true;

    const applyStats = (data: { listeners?: { network_total?: number }; listeners_count?: number }) => {
      if (!mounted) return;
      if (data.listeners?.network_total) {
        setListenerCount(data.listeners.network_total);
      } else if (data.listeners_count) {
        setListenerCount(data.listeners_count);
      }
    };

    // 1. Instantly use telemetry if already available in client cache
    const latest = getLatestRadioTelemetry('main');
    if (latest) {
      applyStats(latest);
    }

    // 2. Subscribe to shared radio telemetry broadcasts (from AudioPlayer)
    // Eliminates redundant background polling from LiveListenersBadge (Issue #123)
    const unsubscribe = subscribeRadioTelemetry((data) => {
      applyStats(data);
    });

    async function fetchStats() {
      try {
        const data = await fetchRadioTelemetry('main');
        applyStats(data);
      } catch {
        // Silently preserve previous value
      }
    }

    // If cache was empty, perform initial fetch
    if (!latest) {
      fetchStats();
    }

    // Fallback polling (relaxed from 15s to 30s) in case AudioPlayer is unmounted
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchStats();
    }, 30000);

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
      unsubscribe();
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  return (
    <div
      role="status"
      aria-label="Station live status and listener count"
      className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span>{isSingleStation ? 'MAIN STAGE LIVE' : `${publicChannels.length} LIVE CHANNELS`}</span>
      <span className="text-emerald-500/40">·</span>
      <span>24/7 BROADCAST</span>
      {listenerCount !== null && (
        <>
          <span className="text-emerald-500/40">·</span>
          <span
            className="text-white font-bold"
            title={
              isSingleStation
                ? `${listenerCount} live listeners on PromptFM Main Stage`
                : `${listenerCount} total live listeners across all PromptFM channels`
            }
          >
            {`${listenerCount} ${isSingleStation ? 'LIVE LISTENERS' : 'NETWORK LISTENERS'}`}
          </span>
        </>
      )}
    </div>
  );
}

