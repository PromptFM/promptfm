// src/lib/audio/stream-config.ts
// Shared stream URL resolution for local dev and hosted fallback playback.

export const DEFAULT_STREAM_URL = 'https://stream.promptfm.live/stream.mp3';

export function getConfiguredStreamUrl(): string {
  return process.env.NEXT_PUBLIC_STREAM_URL?.trim() || DEFAULT_STREAM_URL;
}

export function buildStreamUrlForChannel(slug?: string | null): string {
  const clean = slug?.trim().toLowerCase();
  const baseUrl = getConfiguredStreamUrl();

  if (!clean || clean === 'main') {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl);
    url.searchParams.set('channel', clean);
    return url.toString();
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}channel=${encodeURIComponent(clean)}`;
  }
}
