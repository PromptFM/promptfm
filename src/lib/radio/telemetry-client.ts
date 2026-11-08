// src/lib/radio/telemetry-client.ts
// Shared Client-Side Radio Telemetry Multiplexer & Request Deduplicator (Issue #123)
// Eliminates duplicate polling from stacked components (AudioPlayer, UpNextSection, LiveListenersBadge)

export interface RadioTelemetryPayload {
  success?: boolean;
  channel?: string;
  now_playing?: {
    id?: string;
    type?: string;
    title?: string;
    artist?: string;
    cover_art_url?: string;
    category?: string;
    tool_used?: string;
    upvotes_count?: number;
    transcript?: string;
    duration_hint_seconds?: number;
    [key: string]: any;
  } | null;
  up_next?: Array<{
    id: string;
    type?: string;
    title: string;
    artist: string;
    cover_art_url?: string;
    category?: string;
    upvotes_count?: number;
    queue_position?: number;
    estimated_air_time?: string;
    is_provisional?: boolean;
    requested_by?: string;
    duration_hint_seconds?: number;
    [key: string]: any;
  }>;
  scheduled_requests?: any[];
  listeners_count?: number;
  listeners?: {
    channel: number;
    network_total: number;
    active_channels_count: number;
  };
  active_dj?: any;
  elapsed_seconds?: number;
  duration_seconds?: number;
  started_at?: string;
  [key: string]: any;
}

export const RADIO_TELEMETRY_EVENT = 'promptfm:radio-telemetry';
const DEFAULT_TTL_MS = 8000;

interface CacheEntry {
  data: RadioTelemetryPayload;
  timestamp: number;
}

const telemetryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<RadioTelemetryPayload>>();
type TelemetryListener = (data: RadioTelemetryPayload) => void;
const internalListeners = new Set<TelemetryListener>();

/**
 * Returns latest cached telemetry data for a channel without fetching.
 */
export function getLatestRadioTelemetry(channelSlug = 'main'): RadioTelemetryPayload | undefined {
  const cached = telemetryCache.get(channelSlug);
  return cached?.data;
}

/**
 * Clears the telemetry cache and active in-flight promises.
 */
export function clearRadioTelemetryCache(): void {
  telemetryCache.clear();
  inFlightRequests.clear();
  internalListeners.clear();
}

/**
 * Broadcasts radio telemetry data across client components via window custom event.
 */
export function broadcastRadioTelemetry(data: RadioTelemetryPayload): void {
  const channel = data.channel || 'main';
  telemetryCache.set(channel, {
    data,
    timestamp: Date.now(),
  });

  if (typeof window !== 'undefined') {
    const event = new CustomEvent<RadioTelemetryPayload>(RADIO_TELEMETRY_EVENT, {
      detail: data,
    });
    window.dispatchEvent(event);
    return;
  }

  for (const listener of internalListeners) {
    try {
      listener(data);
    } catch {
      // Ignore subscriber errors
    }
  }
}

/**
 * Subscribes to radio telemetry broadcasts from other components.
 * Returns an unsubscribe callback.
 */
export function subscribeRadioTelemetry(
  callback: (data: RadioTelemetryPayload) => void
): () => void {
  if (typeof window !== 'undefined') {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<RadioTelemetryPayload>;
      if (custom.detail) {
        callback(custom.detail);
      }
    };
    window.addEventListener(RADIO_TELEMETRY_EVENT, handler);
    return () => {
      window.removeEventListener(RADIO_TELEMETRY_EVENT, handler);
    };
  }

  internalListeners.add(callback);
  return () => {
    internalListeners.delete(callback);
  };
}

/**
 * Fetches radio telemetry for a channel from /api/radio/now with in-flight deduplication and TTL caching.
 */
export async function fetchRadioTelemetry(
  channelSlug = 'main',
  options?: { forceRefresh?: boolean; ttlMs?: number }
): Promise<RadioTelemetryPayload> {
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  // 1. Check valid cache unless forced
  if (!options?.forceRefresh) {
    const cached = telemetryCache.get(channelSlug);
    if (cached && now - cached.timestamp < ttl) {
      return cached.data;
    }
  }

  // 2. Coalesce duplicate in-flight requests for the same channel
  const existingInFlight = inFlightRequests.get(channelSlug);
  if (existingInFlight) {
    return existingInFlight;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(`/api/radio/now?channel=${encodeURIComponent(channelSlug)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch radio telemetry: HTTP ${res.status}`);
      }
      const data: RadioTelemetryPayload = await res.json();
      broadcastRadioTelemetry(data);
      return data;
    } finally {
      inFlightRequests.delete(channelSlug);
    }
  })();

  inFlightRequests.set(channelSlug, fetchPromise);
  return fetchPromise;
}
