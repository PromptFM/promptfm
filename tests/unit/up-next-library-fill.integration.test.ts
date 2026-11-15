// tests/unit/up-next-library-fill.integration.test.ts
// Issue #219 — getUpNext end-to-end library fill uses anti-repeat selection

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUpNext,
  clearRecentlyPlayed,
  recordRecentlyPlayedForPreview,
  resetChannelAirplayItems,
  type AirplayItem,
} from '@/lib/dj/rotation';

let mockFallbackTracks: any[] = [];
let mockStationState: Record<string, { channel_slug: string; airplay_item: AirplayItem; started_at: string; staged_item?: AirplayItem | null }> = {};

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'channels') {
        return {
          select: () => ({
            eq: (_c: string, val: string) => ({
              maybeSingle: async () => ({ data: { id: `channel-${val}` }, error: null }),
            }),
          }),
        };
      }
      if (table === 'station_state') {
        return {
          select: () => ({
            eq: (_c: string, val: string) => ({
              maybeSingle: async () => ({ data: mockStationState[val] ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === 'channel_queue') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'tracks') {
        return {
          select: () => ({
            eq: (_c: string, val: string) => {
              if (val === 'approved') {
                return {
                  order: () => ({
                    limit: (count: number) => ({
                      data: mockFallbackTracks.slice(0, count),
                      error: null,
                    }),
                  }),
                };
              }
              return { maybeSingle: async () => ({ data: null, error: null }) };
            },
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
  }),
}));

vi.mock('@/lib/dj/direct-track-queries', () => ({
  fetchApprovedTracksDirect: async () => null,
}));

describe('getUpNext library rotation (Issue #219)', () => {
  beforeEach(() => {
    mockQueueReset();
    mockFallbackTracks = [
      { id: 'rank-1', title: 'A', artist_name: 'A', audio_url: 'https://a/1.mp3', tool_used: 'Suno', upvotes_count: 50, family_friendly: true, is_explicit: false },
      { id: 'rank-2', title: 'B', artist_name: 'B', audio_url: 'https://a/2.mp3', tool_used: 'Suno', upvotes_count: 49, family_friendly: true, is_explicit: false },
      { id: 'rank-3', title: 'C', artist_name: 'C', audio_url: 'https://a/3.mp3', tool_used: 'Suno', upvotes_count: 48, family_friendly: true, is_explicit: false },
      { id: 'rank-4', title: 'D', artist_name: 'D', audio_url: 'https://a/4.mp3', tool_used: 'Suno', upvotes_count: 47, family_friendly: true, is_explicit: false },
      { id: 'rank-5', title: 'E', artist_name: 'E', audio_url: 'https://a/5.mp3', tool_used: 'Suno', upvotes_count: 46, family_friendly: true, is_explicit: false },
    ];
    mockStationState.main = {
      channel_slug: 'main',
      airplay_item: {
        id: 'on-air',
        title: 'Live',
        artist: 'DJ',
        audio_url: 'https://a/live.mp3',
        type: 'music',
      },
      started_at: new Date().toISOString(),
    };
    clearRecentlyPlayed('main');
    resetChannelAirplayItems('main');
    recordRecentlyPlayedForPreview('main', ['rank-1', 'rank-2']);
  });

  afterEach(() => {
    clearRecentlyPlayed();
    resetChannelAirplayItems();
  });

  it('does not invent library tracks as upcoming, including a sticky top-voted title', async () => {
    mockFallbackTracks[0] = {
      ...mockFallbackTracks[0],
      id: 'forged-in-pain',
      title: 'Forged in Pain',
    };

    const upNext = await getUpNext(
      'main',
      3,
      {
        item: mockStationState.main!.airplay_item,
        elapsedSeconds: 30,
      }
    );

    expect(upNext.map((t) => t.title)).not.toContain('Forged in Pain');
    expect(upNext).toEqual([]);
  });

  it('shows only the staged next item until listener requests exist', async () => {
    mockStationState.main = {
      ...mockStationState.main!,
      staged_item: {
        id: 'real-next',
        type: 'music',
        title: 'Actually Next',
        artist: 'Listener',
        audio_url: 'https://a/real.mp3',
      },
    };

    const upNext = await getUpNext(
      'main',
      3,
      {
        item: mockStationState.main!.airplay_item,
        elapsedSeconds: 30,
      }
    );

    expect(upNext.map((t) => t.id)).toEqual(['real-next']);
  });
});

function mockQueueReset() {
  mockStationState = {};
}