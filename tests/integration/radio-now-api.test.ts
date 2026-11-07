// tests/integration/radio-now-api.test.ts
// Integration test for GET /api/radio/now endpoint

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as rotation from '@/lib/dj/rotation';
import { GET } from '@/app/api/radio/now/route';

describe('GET /api/radio/now API Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(rotation, 'getUpNext').mockResolvedValue([]);
  });

  it('returns currently playing track with real upvotes count and active DJ', async () => {
    vi.spyOn(rotation, 'getNowPlaying').mockResolvedValue({
      item: {
        id: '7dd1c716-733c-4ea7-8e82-dda10684d4e6',
        type: 'music',
        title: 'Forged in Pain',
        artist: 'PromptFM Resident',
        audio_url: 'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/forged_in_pain.mp4',
        tool_used: 'Suno',
        upvotes_count: 31,
      },
      startedAt: new Date().toISOString(),
      elapsedSeconds: 15,
      activeDJ: {
        id: 'dj_neon',
        name: 'DJ Neon',
        title: 'The Electric Morning Host & Synth Enthusiast',
        bio: 'Synth enthusiast',
        stylePrompt: 'High energy',
        voice: { name: 'en-US-Journey-F', languageCode: 'en-US', ssmlGender: 'FEMALE' },
        shifts: ['06:00 - 10:00'],
        defaultChannels: ['main'],
      },
      rank: 1,
      totalApprovedTracks: 3,
    });

    vi.spyOn(rotation, 'getUpNext').mockResolvedValue([
      {
        id: 'next-1',
        type: 'music',
        title: 'Neon Skyline',
        artist: 'Suno Beats',
        audio_url: 'https://example.com/neon.mp3',
        upvotes_count: 14,
      },
    ]);

    const req = new NextRequest('http://localhost:3000/api/radio/now');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=5');
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.now_playing.id).toBe('7dd1c716-733c-4ea7-8e82-dda10684d4e6');
    expect(json.now_playing.title).toBe('Forged in Pain');
    expect(json.now_playing.rank).toBe(1);
    expect(json.now_playing.total_approved_tracks).toBe(3);
    expect(json.now_playing.upvotes_count).toBe(31);
    expect(json.now_playing.audio_url).toContain('forged_in_pain.mp4');

    // Up Next verification
    expect(Array.isArray(json.up_next)).toBe(true);
    expect(json.up_next[0].title).toBe('Neon Skyline');

    // Live Listeners telemetry verification
    expect(typeof json.listeners_count).toBe('number');
    expect(json.listeners_count).toBeGreaterThanOrEqual(1);
    expect(json.listeners).toBeDefined();
    expect(json.listeners.channel).toBeGreaterThanOrEqual(1);
    expect(json.listeners.network_total).toBeGreaterThanOrEqual(json.listeners.channel);
  });

  it('returns cover_art_url from track or falls back to /logo-mark.png', async () => {
    vi.spyOn(rotation, 'getNowPlaying').mockResolvedValue({
      item: {
        id: 'track-with-cover',
        type: 'music',
        title: 'Cyber Anthem',
        artist: 'PromptFM',
        audio_url: 'https://example.com/audio.mp3',
        cover_art_url: 'https://example.com/cover.jpg',
        upvotes_count: 10,
      },
      startedAt: new Date().toISOString(),
      elapsedSeconds: 0,
      activeDJ: {
        id: 'dj_neon',
        name: 'DJ Neon',
        title: 'Morning Host',
        bio: '',
        stylePrompt: '',
        voice: { name: 'en-US-Journey-F', languageCode: 'en-US', ssmlGender: 'FEMALE' },
        shifts: [],
        defaultChannels: [],
      },
    });

    const req = new NextRequest('http://localhost:3000/api/radio/now');
    const res = await GET(req);
    const json = await res.json();
    expect(json.now_playing.cover_art_url).toBe('https://example.com/cover.jpg');
  });

  it('registers listener session from query param or header and returns live listeners', async () => {
    vi.spyOn(rotation, 'getNowPlaying').mockResolvedValue({
      item: {
        id: 'track-1',
        type: 'music',
        title: 'Cyber Anthem',
        artist: 'PromptFM',
        audio_url: 'https://example.com/audio.mp3',
        upvotes_count: 5,
      },
      startedAt: new Date().toISOString(),
      elapsedSeconds: 0,
      activeDJ: {
        id: 'dj_neon',
        name: 'DJ Neon',
        title: 'Morning Host',
        bio: '',
        stylePrompt: '',
        voice: { name: 'en-US-Journey-F', languageCode: 'en-US', ssmlGender: 'FEMALE' },
        shifts: [],
        defaultChannels: [],
      },
    });

    const req = new NextRequest('http://localhost:3000/api/radio/now?channel=cyberpunk&session=client-session-999');
    const res = await GET(req);
    const json = await res.json();

    expect(json.channel).toBe('cyberpunk');
    expect(json.listeners_count).toBeGreaterThanOrEqual(1);
  });
});

