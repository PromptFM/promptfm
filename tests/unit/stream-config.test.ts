import { describe, expect, it, vi, afterEach } from 'vitest';

describe('stream-config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses hosted stream by default when no env override exists', async () => {
    const { DEFAULT_STREAM_URL, getConfiguredStreamUrl, buildStreamUrlForChannel } = await import(
      '@/lib/audio/stream-config'
    );

    expect(getConfiguredStreamUrl()).toBe(DEFAULT_STREAM_URL);
    expect(buildStreamUrlForChannel('main')).toBe(DEFAULT_STREAM_URL);
    expect(buildStreamUrlForChannel('kids')).toBe(`${DEFAULT_STREAM_URL}?channel=kids`);
  });

  it('builds per-channel URLs from NEXT_PUBLIC_STREAM_URL when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_STREAM_URL', 'http://localhost:8000/stream.mp3');

    const { buildStreamUrlForChannel, getConfiguredStreamUrl } = await import('@/lib/audio/stream-config');

    expect(getConfiguredStreamUrl()).toBe('http://localhost:8000/stream.mp3');
    expect(buildStreamUrlForChannel('main')).toBe('http://localhost:8000/stream.mp3');
    expect(buildStreamUrlForChannel('cyberpunk')).toBe('http://localhost:8000/stream.mp3?channel=cyberpunk');
  });

  it('preserves existing query strings when adding a channel', async () => {
    vi.stubEnv('NEXT_PUBLIC_STREAM_URL', 'https://cdn.example.com/live.mp3?token=abc');

    const { buildStreamUrlForChannel } = await import('@/lib/audio/stream-config');

    expect(buildStreamUrlForChannel('afterdark')).toBe(
      'https://cdn.example.com/live.mp3?token=abc&channel=afterdark'
    );
  });
});
