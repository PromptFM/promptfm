// tests/unit/request-lifecycle.test.ts
// Unit tests for PromptFM Request Lifecycle Engine (Issue #98)
// Tests all request lifecycle transitions: accepted -> queued -> airing_soon -> playing -> played / rejected
// Tests status resolution, badge formatting, multi-interface formatters, and airplay synchronization.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock in-memory tables for Supabase
let mockCommunityRequests: any[] = [];
let mockChannelQueue: any[] = [];
let mockStationState: any = null;
let mockTracks: any[] = [];

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'community_requests') {
        return {
          select: (_fields?: string) => ({
            eq: (col: string, val: any) => ({
              maybeSingle: async () => {
                const found = mockCommunityRequests.find((r) => r[col] === val);
                return { data: found || null, error: null };
              },
              single: async () => {
                const found = mockCommunityRequests.find((r) => r[col] === val);
                return { data: found || null, error: found ? null : new Error('Not found') };
              },
              in: (col2: string, vals2: any[]) => ({
                order: (_orderCol: string, { ascending }: { ascending: boolean }) => ({
                  limit: async (lim: number) => {
                    let filtered = mockCommunityRequests.filter(
                      (r) => r[col] === val && vals2.includes(r[col2])
                    );
                    if (!ascending) filtered = [...filtered].reverse();
                    return { data: filtered.slice(0, lim), error: null };
                  },
                }),
              }),
              order: (_orderCol: string, { ascending }: { ascending: boolean }) => ({
                limit: async (lim: number) => {
                  let filtered = mockCommunityRequests.filter((r) => r[col] === val);
                  if (!ascending) filtered = [...filtered].reverse();
                  return { data: filtered.slice(0, lim), error: null };
                },
              }),
            }),
            ilike: (col: string, val: string) => ({
              in: (col2: string, vals2: any[]) => ({
                order: (_orderCol: string, { ascending }: { ascending: boolean }) => ({
                  limit: async (lim: number) => {
                    const clean = val.replace(/%/g, '').toLowerCase();
                    let filtered = mockCommunityRequests.filter(
                      (r) => (r[col] || '').toLowerCase().includes(clean) && vals2.includes(r[col2])
                    );
                    if (!ascending) filtered = [...filtered].reverse();
                    return { data: filtered.slice(0, lim), error: null };
                  },
                }),
              }),
              order: (_orderCol: string, { ascending }: { ascending: boolean }) => ({
                limit: async (lim: number) => {
                  const clean = val.replace(/%/g, '').toLowerCase();
                  let filtered = mockCommunityRequests.filter((r) =>
                    (r[col] || '').toLowerCase().includes(clean)
                  );
                  if (!ascending) filtered = [...filtered].reverse();
                  return { data: filtered.slice(0, lim), error: null };
                },
              }),
            }),
            in: (col: string, vals: any[]) => ({
              order: (_orderCol: string, { ascending }: { ascending: boolean }) => ({
                limit: async (lim: number) => {
                  let filtered = mockCommunityRequests.filter((r) => vals.includes(r[col]));
                  if (!ascending) filtered = [...filtered].reverse();
                  return { data: filtered.slice(0, lim), error: null };
                },
              }),
            }),
          }),
          update: (updates: any) => ({
            eq: (col: string, val: any) => {
              const updated: any[] = [];
              mockCommunityRequests.forEach((r) => {
                if (r[col] === val) {
                  Object.assign(r, updates);
                  updated.push(r);
                }
              });
              const res = { data: updated, error: null };
              return Object.assign(Promise.resolve(res), {
                eq: (col2: string, val2: any) => {
                  const subUpdated: any[] = [];
                  mockCommunityRequests.forEach((r) => {
                    if (r[col] === val && r[col2] === val2) {
                      Object.assign(r, updates);
                      subUpdated.push(r);
                    }
                  });
                  return Promise.resolve({ data: subUpdated, error: null });
                },
              });
            },
          }),
          insert: (data: any) => {
            const row = {
              id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              created_at: new Date().toISOString(),
              status: 'scheduled',
              ...data,
            };
            mockCommunityRequests.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          },
        };
      }

      if (table === 'channel_queue') {
        return {
          select: (_fields?: string) => ({
            eq: (col: string, val: any) => ({
              is: (nullCol: string, nullVal: any) => ({
                order: (_orderCol: string, { ascending }: { ascending: boolean }) => ({
                  limit: async (limitCount: number) => {
                    let filtered = mockChannelQueue
                      .filter((item) => item[col] === val && item[nullCol] === nullVal)
                      .map((item) => ({
                        ...item,
                        track: mockTracks.find((t) => t.id === item.track_id) || null,
                      }));
                    if (!ascending) filtered = [...filtered].reverse();
                    return { data: filtered.slice(0, limitCount), error: null };
                  },
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'channels') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'channel-main', slug: 'main' }, error: null }),
            }),
          }),
        };
      }

      if (table === 'station_state') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: mockStationState, error: null }),
            }),
          }),
        };
      }

      if (table === 'tracks') {
        return {
          select: () => ({
            eq: (col: string, val: any) => ({
              maybeSingle: async () => {
                const found = mockTracks.find((t) => t[col] === val);
                return { data: found || null, error: null };
              },
            }),
            ilike: (col: string, val: string) => ({
              limit: () => ({
                maybeSingle: async () => {
                  const clean = val.replace(/%/g, '').toLowerCase();
                  const found = mockTracks.find((t) => (t[col] || '').toLowerCase().includes(clean));
                  return { data: found || null, error: null };
                },
              }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    },
  }),
}));

import {
  resolveLifecycleStatus,
  getRequestLifecycleBadge,
  formatRequestLifecycleMessage,
  getRequestLifecycle,
  syncAirplayRequestTransition,
  type RequestLifecycleStatus,
  type RequestLifecycleInfo,
} from '@/lib/song/lifecycle';

describe('PromptFM Request Lifecycle Engine (Issue #98)', () => {
  beforeEach(() => {
    mockCommunityRequests = [];
    mockChannelQueue = [];
    mockStationState = null;
    mockTracks = [
      {
        id: 'track-1',
        title: 'Neon Horizon',
        artist_name: 'Synthetic Pulse',
        audio_url: 'https://example.com/audio1.mp3',
        tool_used: 'Suno',
        upvotes_count: 42,
        cover_art_url: '/cover1.png',
        category: 'Synthwave & Electro',
        duration_hint_seconds: 180,
      },
      {
        id: 'track-2',
        title: 'Cyber Rain',
        artist_name: 'LoFi Dreamer',
        audio_url: 'https://example.com/audio2.mp3',
        tool_used: 'Udio',
        upvotes_count: 15,
        cover_art_url: '/cover2.png',
        category: 'Ambient & Lo-Fi',
        duration_hint_seconds: 210,
      },
    ];
  });

  describe('resolveLifecycleStatus', () => {
    it('returns "rejected" when rejection reason is present', () => {
      const status = resolveLifecycleStatus({
        dbStatus: 'rejected',
        isLiveNow: false,
        rejectionReason: 'Violates content safety policy',
      });
      expect(status).toBe('rejected');
    });

    it('returns "rejected" when dbStatus is rejected even without explicit reason string', () => {
      const status = resolveLifecycleStatus({
        dbStatus: 'rejected',
        isLiveNow: false,
      });
      expect(status).toBe('rejected');
    });

    it('returns "playing" when track is currently live on air, regardless of previous dbStatus', () => {
      const status = resolveLifecycleStatus({
        dbStatus: 'scheduled',
        isLiveNow: true,
      });
      expect(status).toBe('playing');
    });

    it('returns "playing" when dbStatus is playing even if isLiveNow is false', () => {
      const status = resolveLifecycleStatus({
        dbStatus: 'playing',
        isLiveNow: false,
      });
      expect(status).toBe('playing');
    });

    it('returns "played" when playedAt timestamp is recorded', () => {
      const status = resolveLifecycleStatus({
        dbStatus: 'scheduled',
        isLiveNow: false,
        playedAt: '2026-11-07T12:00:00.000Z',
      });
      expect(status).toBe('played');
    });

    it('returns "played" when airedAt timestamp is recorded', () => {
      const status = resolveLifecycleStatus({
        dbStatus: 'scheduled',
        isLiveNow: false,
        airedAt: '2026-11-07T12:00:00.000Z',
      });
      expect(status).toBe('played');
    });

    it('returns "played" when dbStatus is "aired" or "played"', () => {
      expect(
        resolveLifecycleStatus({
          dbStatus: 'aired',
          isLiveNow: false,
        })
      ).toBe('played');

      expect(
        resolveLifecycleStatus({
          dbStatus: 'played',
          isLiveNow: false,
        })
      ).toBe('played');
    });

    it('returns "airing_soon" when queue position is 1 and track is not yet live', () => {
      const status = resolveLifecycleStatus({
        dbStatus: 'scheduled',
        isLiveNow: false,
        queuePosition: 1,
      });
      expect(status).toBe('airing_soon');
    });

    it('returns "queued" when queue position is greater than 1', () => {
      const status = resolveLifecycleStatus({
        dbStatus: 'scheduled',
        isLiveNow: false,
        queuePosition: 3,
      });
      expect(status).toBe('queued');
    });

    it('returns "accepted" when status is scheduled, accepted, or pending without an active queue position', () => {
      expect(
        resolveLifecycleStatus({
          dbStatus: 'accepted',
          isLiveNow: false,
        })
      ).toBe('accepted');

      expect(
        resolveLifecycleStatus({
          dbStatus: 'scheduled',
          isLiveNow: false,
        })
      ).toBe('accepted');

      expect(
        resolveLifecycleStatus({
          dbStatus: 'pending',
          isLiveNow: false,
        })
      ).toBe('accepted');
    });

    it('defaults to "queued" for unspecified edge cases', () => {
      expect(
        resolveLifecycleStatus({
          dbStatus: 'unknown',
          isLiveNow: false,
        })
      ).toBe('queued');
    });
  });

  describe('getRequestLifecycleBadge', () => {
    it('returns proper badge for accepted status', () => {
      const badge = getRequestLifecycleBadge('accepted');
      expect(badge.badgeLabel).toBe('ACCEPTED');
      expect(badge.displayStatus).toBe('Request Accepted');
      expect(badge.color).toBe('blue');
    });

    it('returns proper badge for queued status with position', () => {
      const badge = getRequestLifecycleBadge('queued', 2);
      expect(badge.badgeLabel).toBe('QUEUED #2');
      expect(badge.displayStatus).toBe('In Queue (#2)');
      expect(badge.color).toBe('amber');
    });

    it('returns proper badge for queued status without position', () => {
      const badge = getRequestLifecycleBadge('queued');
      expect(badge.badgeLabel).toBe('IN QUEUE');
      expect(badge.displayStatus).toBe('In Queue');
      expect(badge.color).toBe('amber');
    });

    it('returns proper badge for airing_soon status', () => {
      const badge = getRequestLifecycleBadge('airing_soon');
      expect(badge.badgeLabel).toBe('AIRING SOON');
      expect(badge.displayStatus).toBe('Airing Soon (Up Next)');
      expect(badge.color).toBe('purple');
    });

    it('returns proper badge for playing status', () => {
      const badge = getRequestLifecycleBadge('playing');
      expect(badge.badgeLabel).toBe('ON AIR');
      expect(badge.displayStatus).toBe('Now Playing Your Request');
      expect(badge.color).toBe('emerald');
    });

    it('returns proper badge for played status', () => {
      const badge = getRequestLifecycleBadge('played');
      expect(badge.badgeLabel).toBe('PLAYED');
      expect(badge.displayStatus).toBe('Played on Air');
      expect(badge.color).toBe('zinc');
    });

    it('returns proper badge for rejected status', () => {
      const badge = getRequestLifecycleBadge('rejected');
      expect(badge.badgeLabel).toBe('REJECTED');
      expect(badge.displayStatus).toBe('Declined');
      expect(badge.color).toBe('rose');
    });
  });

  describe('formatRequestLifecycleMessage', () => {
    const baseInfo: RequestLifecycleInfo = {
      requestId: 'req-1234-uuid',
      status: 'accepted',
      displayStatus: 'Request Accepted',
      badgeLabel: 'ACCEPTED',
      platform: 'discord',
      platformUserName: 'alex_listener',
      type: 'song',
      prompt: 'cyberpunk synthwave driving in rain',
      batchId: 'BATCH-14:30',
      createdAt: '2026-11-07T14:15:00.000Z',
      track: {
        id: 'track-cyber-1',
        title: 'Neon Horizon',
        artist: 'Synthetic Pulse',
        coverArtUrl: '/cover.png',
        category: 'Cyberpunk & Synth',
      },
      eta: {
        position: 2,
        itemsAhead: 1,
        waitSeconds: 360,
        waitMinutes: 6,
        displayTime: '14:30 UTC',
        batchId: 'BATCH-14:30',
        estimatedAirDate: new Date('2026-11-07T14:30:00.000Z'),
        formattedETA: '~6 mins (Queue #2 • ~14:30 UTC)',
        isProvisional: true,
      },
      position: 2,
      itemsAhead: 1,
    };

    it('formats accepted request for Discord', () => {
      const msg = formatRequestLifecycleMessage({ ...baseInfo, status: 'accepted' }, 'discord');
      expect(msg).toBe(
        '✅ **Request Accepted & Processing**\n🎵 **"Neon Horizon"** by **Synthetic Pulse**\n🎧 Requested by @alex_listener\n📦 Batch: **BATCH-14:30** • Scheduled for live queue. Track anytime with /request req-1234-uuid.'
      );
    });

    it('formats accepted request without batchId or artist for Discord', () => {
      const msg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'accepted', batchId: undefined, track: undefined },
        'discord'
      );
      expect(msg).toBe(
        '✅ **Request Accepted & Processing**\n🎵 **"cyberpunk synthwave driving in rain"**\n🎧 Requested by @alex_listener\n📦 Batch: **Upcoming Batch** • Scheduled for live queue. Track anytime with /request req-1234-uuid.'
      );
    });

    it('formats queued request with position and wait time for Discord', () => {
      const msg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'queued', position: 3, itemsAhead: 2 },
        'discord'
      );
      expect(msg).toBe(
        '📋 **In Broadcast Queue (ACCEPTED)**\n🎵 **"Neon Horizon"** by **Synthetic Pulse**\n🎧 Requested by @alex_listener\n⏱️ Position: #3 • 2 tracks ahead (~6 mins • ~14:30 UTC). Check /queue anytime.'
      );
    });

    it('formats queued request without position or eta for Discord', () => {
      const msg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'queued', position: undefined, itemsAhead: undefined, eta: undefined },
        'discord'
      );
      expect(msg).toBe(
        '📋 **In Broadcast Queue (ACCEPTED)**\n🎵 **"Neon Horizon"** by **Synthetic Pulse**\n🎧 Requested by @alex_listener\n⏱️ In Queue. Check /queue anytime.'
      );
    });

    it('formats airing_soon request for Discord', () => {
      const msg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'airing_soon', position: 1, itemsAhead: 0 },
        'discord'
      );
      expect(msg).toBe(
        '⏳ **Airing Soon (Up Next)!**\n🎵 **"Neon Horizon"** by **Synthetic Pulse**\n🎧 Requested by @alex_listener\n⏱️ Next track to play on air! Estimated:  (~14:30 UTC). Check /queue.'
      );
    });

    it('formats airing_soon request without eta for Discord', () => {
      const msg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'airing_soon', eta: undefined },
        'discord'
      );
      expect(msg).toBe(
        '⏳ **Airing Soon (Up Next)!**\n🎵 **"Neon Horizon"** by **Synthetic Pulse**\n🎧 Requested by @alex_listener\n⏱️ Next track to play on air! Estimated: in ~2-3 mins. Check /queue.'
      );
    });

    it('formats playing request (now playing your request) for Discord', () => {
      const msg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'playing', isNowPlaying: true },
        'discord'
      );
      expect(msg).toBe(
        '📻 **Now Playing Your Request!**\n🎵 **"Neon Horizon"** by **Synthetic Pulse**\n🎧 Requested by @alex_listener • Live on air right now!\nVote or tune in: https://promptfm.live'
      );
    });

    it('formats playing request without artist for Discord', () => {
      const msg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'playing', track: { id: 't1', title: 'Solo Jam', artist: '' } },
        'discord'
      );
      expect(msg).toBe(
        '📻 **Now Playing Your Request!**\n🎵 **"Solo Jam"**\n🎧 Requested by @alex_listener • Live on air right now!\nVote or tune in: https://promptfm.live'
      );
    });

    it('formats played request for Discord with and without airedAt', () => {
      const msgWithAired = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'played', airedAt: '2026-11-07T14:32:00.000Z' },
        'discord'
      );
      expect(msgWithAired).toBe(
        '✅ **Played on Air**\n🎵 **"Neon Horizon"** by **Synthetic Pulse**\n🎧 Requested by @alex_listener\n🎉 Broadcast finished at 14:32 UTC. Thank you for listening to PromptFM!'
      );

      const msgNoAired = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'played', airedAt: undefined },
        'discord'
      );
      expect(msgNoAired).toBe(
        '✅ **Played on Air**\n🎵 **"Neon Horizon"** by **Synthetic Pulse**\n🎧 Requested by @alex_listener\n🎉 Broadcast finished. Thank you for listening to PromptFM!'
      );
    });

    it('formats rejected request with refusal reason for Discord', () => {
      const msg = formatRequestLifecycleMessage(
        {
          ...baseInfo,
          status: 'rejected',
          rejectionReason: 'Content violates community broadcast ethics standards',
        },
        'discord'
      );
      expect(msg).toBe(
        '🚫 **Request Declined**\n"cyberpunk synthwave driving in rain"\n❌ Reason: Content violates community broadcast ethics standards'
      );
    });

    it('formats rejected request without refusal reason for Discord (falls back to default)', () => {
      const msg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'rejected', rejectionReason: undefined },
        'discord'
      );
      expect(msg).toBe(
        '🚫 **Request Declined**\n"cyberpunk synthwave driving in rain"\n❌ Reason: Violates broadcast ethics standards'
      );
    });

    it('formats all statuses for Telegram with markdown styling', () => {
      // 1. playing
      const playingMsg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'playing' },
        'telegram'
      );
      expect(playingMsg).toBe(
        '📻 *Now Playing Your Request!*\n🎵 *"Neon Horizon"* by *Synthetic Pulse*\n🎧 Requested by @alex_listener • Live on air right now!\nTune in: https://promptfm.live'
      );

      // 2. playing without artist
      const playingNoArtist = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'playing', track: { id: 't1', title: 'Solo', artist: '' } },
        'telegram'
      );
      expect(playingNoArtist).toBe(
        '📻 *Now Playing Your Request!*\n🎵 *"Solo"*\n🎧 Requested by @alex_listener • Live on air right now!\nTune in: https://promptfm.live'
      );

      // 3. airing_soon
      const soonMsg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'airing_soon' },
        'telegram'
      );
      expect(soonMsg).toBe(
        '⏳ *Airing Soon (Up Next)!*\n🎵 *"Neon Horizon"* by *Synthetic Pulse*\n🎧 Requested by @alex_listener\n⏱️ Next track to play on air!'
      );

      // 4. queued with position & waitMinutes
      const queuedMsg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'queued', position: 2 },
        'telegram'
      );
      expect(queuedMsg).toBe(
        '📋 *In Broadcast Queue (ACCEPTED)*\n🎵 *"Neon Horizon"* by *Synthetic Pulse*\n🎧 Requested by @alex_listener\n⏱️ Position #2 (~6 mins). Use /q to view queue.'
      );

      // 5. queued without position & waitMinutes
      const queuedNoPos = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'queued', position: undefined, eta: undefined },
        'telegram'
      );
      expect(queuedNoPos).toBe(
        '📋 *In Broadcast Queue (ACCEPTED)*\n🎵 *"Neon Horizon"* by *Synthetic Pulse*\n🎧 Requested by @alex_listener\n⏱️ In Queue. Use /q to view queue.'
      );

      // 6. accepted
      const acceptedMsg = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'accepted' },
        'telegram'
      );
      expect(acceptedMsg).toBe(
        '✅ *Request Accepted & Processing*\n🎵 *"Neon Horizon"* by *Synthetic Pulse*\n🎧 Requested by @alex_listener\n📦 Batch: *BATCH-14:30*'
      );

      // 7. played with and without airedAt
      const playedWithAired = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'played', airedAt: '2026-11-07T14:35:00.000Z' },
        'telegram'
      );
      expect(playedWithAired).toBe(
        '✅ *Played on Air*\n🎵 *"Neon Horizon"* by *Synthetic Pulse*\n🎧 Requested by @alex_listener\n🎉 Broadcast finished at 14:35 UTC.'
      );

      const playedNoAired = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'played', airedAt: undefined },
        'telegram'
      );
      expect(playedNoAired).toBe(
        '✅ *Played on Air*\n🎵 *"Neon Horizon"* by *Synthetic Pulse*\n🎧 Requested by @alex_listener\n🎉 Broadcast finished.'
      );

      // 8. rejected with and without reason
      const rejectedWithReason = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'rejected', rejectionReason: 'Explicit lyrics' },
        'telegram'
      );
      expect(rejectedWithReason).toBe(
        '🚫 *Request Declined*\n"cyberpunk synthwave driving in rain"\n❌ Reason: Explicit lyrics'
      );

      const rejectedNoReason = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'rejected', rejectionReason: undefined },
        'telegram'
      );
      expect(rejectedNoReason).toBe(
        '🚫 *Request Declined*\n"cyberpunk synthwave driving in rain"\n❌ Reason: Violates broadcast ethics standards'
      );
    });

    it('formats all statuses for CLI terminal display', () => {
      // 1. playing
      const playingCli = formatRequestLifecycleMessage({ ...baseInfo, status: 'playing' }, 'cli');
      expect(playingCli).toBe(
        '📻 NOW PLAYING YOUR REQUEST: "Neon Horizon" by Synthetic Pulse [Requested by alex_listener] • On air now!'
      );

      // 2. playing without artist
      const playingNoArtist = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'playing', track: { id: 't1', title: 'Solo Jam', artist: '' } },
        'cli'
      );
      expect(playingNoArtist).toBe(
        '📻 NOW PLAYING YOUR REQUEST: "Solo Jam" [Requested by alex_listener] • On air now!'
      );

      // 3. airing_soon
      const soonCli = formatRequestLifecycleMessage({ ...baseInfo, status: 'airing_soon' }, 'cli');
      expect(soonCli).toBe(
        '⏳ AIRING SOON (UP NEXT): "Neon Horizon" by Synthetic Pulse [Requested by alex_listener] • Next track to play!'
      );

      // 4. queued with and without position
      const queuedWithPos = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'queued', position: 4 },
        'cli'
      );
      expect(queuedWithPos).toBe(
        '📋 IN QUEUE (#4): "Neon Horizon" by Synthetic Pulse [Requested by alex_listener] • ~14:30 UTC'
      );

      const queuedNoPos = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'queued', position: undefined, eta: undefined },
        'cli'
      );
      expect(queuedNoPos).toBe(
        '📋 IN QUEUE (#?): "Neon Horizon" by Synthetic Pulse [Requested by alex_listener] • ~Soon'
      );

      // 5. accepted
      const acceptedCli = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'accepted' },
        'cli'
      );
      expect(acceptedCli).toBe(
        '✅ ACCEPTED: "Neon Horizon" [Requested by alex_listener] • Batch: BATCH-14:30'
      );

      // 6. played with and without airedAt
      const playedWithAired = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'played', airedAt: '2026-11-07T14:40:00.000Z' },
        'cli'
      );
      expect(playedWithAired).toBe(
        '✅ PLAYED: "Neon Horizon" [Requested by alex_listener] • Aired at 14:40 UTC'
      );

      const playedNoAired = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'played', airedAt: undefined },
        'cli'
      );
      expect(playedNoAired).toBe(
        '✅ PLAYED: "Neon Horizon" [Requested by alex_listener] • Aired at recently'
      );

      // 7. rejected with and without reason
      const rejectedWithReason = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'rejected', rejectionReason: 'Spam trigger' },
        'cli'
      );
      expect(rejectedWithReason).toBe(
        '🚫 DECLINED: "cyberpunk synthwave driving in rain" • Reason: Spam trigger'
      );

      const rejectedNoReason = formatRequestLifecycleMessage(
        { ...baseInfo, status: 'rejected', rejectionReason: undefined },
        'cli'
      );
      expect(rejectedNoReason).toBe(
        '🚫 DECLINED: "cyberpunk synthwave driving in rain" • Reason: Violates broadcast standards'
      );
    });
  });

  describe('getRequestLifecycle lookup', () => {
    it('returns null when request identifier is empty or whitespace', async () => {
      expect(await getRequestLifecycle('')).toBeNull();
      expect(await getRequestLifecycle('   ')).toBeNull();
    });

    it('returns null when request identifier cannot be found across all search steps', async () => {
      const res = await getRequestLifecycle('non-existent-id');
      expect(res).toBeNull();
    });

    it('finds request by UUID and correctly computes "airing_soon" when #1 in queue', async () => {
      mockCommunityRequests.push({
        id: 'req-alpha-123',
        platform: 'discord',
        platform_user_name: 'cyber_surfer',
        type: 'song',
        content: 'Neon Horizon',
        target: 'track-1',
        status: 'scheduled',
        batch_id: 'BATCH-15:00',
        created_at: new Date().toISOString(),
      });

      mockChannelQueue.push({
        id: 'q-item-1',
        channel_id: 'channel-main',
        track_id: 'track-1',
        prompt_used: 'Neon Horizon',
        requested_by: '@cyber_surfer (discord)',
        played_at: null,
        created_at: new Date().toISOString(),
      });

      const lifecycle = await getRequestLifecycle('req-alpha-123');
      expect(lifecycle).not.toBeNull();
      expect(lifecycle?.status).toBe('airing_soon');
      expect(lifecycle?.position).toBe(1);
      expect(lifecycle?.badgeLabel).toBe('AIRING SOON');
      expect(lifecycle?.track?.title).toBe('Neon Horizon');
      expect(lifecycle?.track?.artist).toBe('Synthetic Pulse');
      expect(lifecycle?.track?.category).toBe('Synthwave & Electro');
      expect(lifecycle?.track?.toolUsed).toBe('Suno');
    });

    it('matches queue item by prompt_used with case-insensitive search', async () => {
      mockCommunityRequests.push({
        id: 'req-case-test',
        platform: 'discord',
        platform_user_name: 'case_user',
        type: 'song',
        content: 'cyber rain',
        target: 'track-2',
        status: 'scheduled',
        created_at: new Date().toISOString(),
      });

      mockChannelQueue.push({
        id: 'q-item-case',
        channel_id: 'channel-main',
        track_id: 'track-2',
        prompt_used: 'CYBER RAIN VIBES',
        requested_by: '@other_user (discord)',
        played_at: null,
        created_at: new Date().toISOString(),
      });

      const lifecycle = await getRequestLifecycle('req-case-test');
      expect(lifecycle?.position).toBe(1);
      expect(lifecycle?.status).toBe('airing_soon');
    });

    it('matches queue item by requested_by when track_id and prompt_used do not match', async () => {
      mockCommunityRequests.push({
        id: 'req-user-queue-match',
        platform: 'discord',
        platform_user_name: 'special_requester',
        type: 'song',
        content: 'Unmatched Prompt',
        target: 'diff-track',
        status: 'scheduled',
        created_at: new Date().toISOString(),
      });

      mockChannelQueue.push({
        id: 'q-item-user-match',
        channel_id: 'channel-main',
        track_id: 'track-other',
        prompt_used: 'Something Else',
        requested_by: '@special_requester (discord)',
        played_at: null,
        created_at: new Date().toISOString(),
      });

      const lifecycle = await getRequestLifecycle('req-user-queue-match');
      expect(lifecycle?.position).toBe(1);
    });

    it('does not mark as live playing if station_state airplay_item does not match', async () => {
      mockCommunityRequests.push({
        id: 'req-not-live',
        platform: 'discord',
        platform_user_name: 'user_not_live',
        type: 'song',
        content: 'Neon Horizon',
        target: 'track-1',
        status: 'scheduled',
        created_at: new Date().toISOString(),
      });

      mockStationState = {
        channel_slug: 'main',
        airplay_item: {
          id: 'completely-different-track',
          title: 'Different Title',
          artist: 'Different Artist',
        },
        started_at: new Date(Date.now() - 10000).toISOString(),
      };

      const lifecycle = await getRequestLifecycle('req-not-live');
      expect(lifecycle?.isNowPlaying).toBe(false);
      expect(lifecycle?.status).toBe('accepted');
    });

    it('finds request by track title and correctly computes "queued" with position #2', async () => {
      mockCommunityRequests.push({
        id: 'req-beta-456',
        platform: 'telegram',
        platform_user_name: 'rain_lover',
        type: 'song',
        content: 'Cyber Rain',
        target: 'track-2',
        status: 'scheduled',
        batch_id: 'BATCH-15:15',
        created_at: new Date().toISOString(),
      });

      mockChannelQueue.push(
        {
          id: 'q-item-first',
          channel_id: 'channel-main',
          track_id: 'track-1',
          prompt_used: 'Neon Horizon',
          requested_by: '@first_user (discord)',
          played_at: null,
          created_at: new Date(Date.now() - 10000).toISOString(),
        },
        {
          id: 'q-item-second',
          channel_id: 'channel-main',
          track_id: 'track-2',
          prompt_used: 'Cyber Rain',
          requested_by: '@rain_lover (telegram)',
          played_at: null,
          created_at: new Date().toISOString(),
        }
      );

      const lifecycle = await getRequestLifecycle('Cyber Rain');
      expect(lifecycle).not.toBeNull();
      expect(lifecycle?.status).toBe('queued');
      expect(lifecycle?.position).toBe(2);
      expect(lifecycle?.itemsAhead).toBe(1);
      expect(lifecycle?.badgeLabel).toBe('QUEUED #2');
    });

    it('finds request by username stripping leading @', async () => {
      mockCommunityRequests.push({
        id: 'req-gamma-789',
        platform: 'discord',
        platform_user_name: 'matrix_fan',
        type: 'song',
        content: 'Neon Horizon',
        target: 'track-1',
        status: 'scheduled',
        batch_id: 'BATCH-15:30',
        created_at: new Date().toISOString(),
      });

      const lifecycle = await getRequestLifecycle('@matrix_fan');
      expect(lifecycle).not.toBeNull();
      expect(lifecycle?.requestId).toBe('req-gamma-789');
      expect(lifecycle?.platformUserName).toBe('matrix_fan');
    });

    it('finds request by target track ID when not matching by UUID or title substring', async () => {
      mockCommunityRequests.push({
        id: 'req-target-direct',
        platform: 'web',
        platform_user_name: 'web_fan',
        type: 'song',
        content: 'Custom Vibe Without Exact Title',
        target: 'track-2',
        status: 'scheduled',
        batch_id: 'BATCH-16:00',
        created_at: new Date().toISOString(),
      });

      const lifecycle = await getRequestLifecycle('track-2');
      expect(lifecycle).not.toBeNull();
      expect(lifecycle?.requestId).toBe('req-target-direct');
      expect(lifecycle?.track?.title).toBe('Cyber Rain');
    });

    it('handles track lookup fallback when track has no artist or cover art', async () => {
      mockTracks.push({
        id: 'track-bare',
        title: 'Minimal Techno',
        artist_name: undefined,
        cover_art_url: undefined,
        audio_url: 'https://example.com/bare.mp3',
        tool_used: 'Stable Audio',
        upvotes_count: 5,
      });

      mockCommunityRequests.push({
        id: 'req-bare-test',
        platform: 'discord',
        platform_user_name: 'techno_fan',
        type: 'song',
        content: 'Minimal Techno',
        target: 'track-bare',
        status: 'scheduled',
        created_at: new Date().toISOString(),
      });

      const lifecycle = await getRequestLifecycle('req-bare-test');
      expect(lifecycle?.track?.artist).toBe('PromptFM Artist');
      expect(lifecycle?.track?.coverArtUrl).toBe('/logo-mark.png');
    });

    it('recognizes when request is currently live on air (playing status) via station_state id match', async () => {
      mockCommunityRequests.push({
        id: 'req-live-789',
        platform: 'discord',
        platform_user_name: 'dj_fan',
        type: 'song',
        content: 'Neon Horizon',
        target: 'track-1',
        status: 'playing',
        batch_id: 'BATCH-15:00',
        created_at: new Date().toISOString(),
      });

      mockStationState = {
        channel_slug: 'main',
        airplay_item: {
          id: 'track-1',
          title: 'Neon Horizon',
          artist: 'Synthetic Pulse',
          requested_by: '@dj_fan (discord)',
        },
        started_at: new Date(Date.now() - 30000).toISOString(),
      };

      const lifecycle = await getRequestLifecycle('req-live-789');
      expect(lifecycle).not.toBeNull();
      expect(lifecycle?.status).toBe('playing');
      expect(lifecycle?.badgeLabel).toBe('ON AIR');
      expect(lifecycle?.isNowPlaying).toBe(true);
    });

    it('recognizes when request is live on air via station_state title match', async () => {
      mockCommunityRequests.push({
        id: 'req-title-match',
        platform: 'discord',
        platform_user_name: 'title_fan',
        type: 'song',
        content: 'Cyber Rain',
        target: 'unknown-id',
        status: 'scheduled',
        created_at: new Date().toISOString(),
      });

      mockStationState = {
        channel_slug: 'main',
        airplay_item: {
          id: 'diff-id',
          title: 'Cyber Rain',
          artist: 'LoFi Dreamer',
        },
        started_at: new Date(Date.now() - 15000).toISOString(),
      };

      const lifecycle = await getRequestLifecycle('req-title-match');
      expect(lifecycle?.status).toBe('playing');
      expect(lifecycle?.isNowPlaying).toBe(true);
    });

    it('recognizes when request has played (post-airplay state)', async () => {
      mockCommunityRequests.push({
        id: 'req-past-999',
        platform: 'web',
        platform_user_name: 'web_visitor',
        type: 'song',
        content: 'Neon Horizon',
        target: 'track-1',
        status: 'aired',
        aired_at: new Date(Date.now() - 600000).toISOString(),
        batch_id: 'BATCH-14:45',
        created_at: new Date(Date.now() - 900000).toISOString(),
      });

      const lifecycle = await getRequestLifecycle('req-past-999');
      expect(lifecycle).not.toBeNull();
      expect(lifecycle?.status).toBe('played');
      expect(lifecycle?.badgeLabel).toBe('PLAYED');
      expect(lifecycle?.airedAt).toBeDefined();
    });

    it('resolves track by title lexical search when target track is missing', async () => {
      mockCommunityRequests.push({
        id: 'req-no-target',
        platform: 'discord',
        platform_user_name: 'search_listener',
        type: 'song',
        content: 'Neon Horizon',
        target: null,
        status: 'scheduled',
        created_at: new Date().toISOString(),
      });

      const lifecycle = await getRequestLifecycle('req-no-target');
      expect(lifecycle?.track?.title).toBe('Neon Horizon');
    });

    it('recognizes rejected request and retains rejectionReason', async () => {
      mockCommunityRequests.push({
        id: 'req-rejected-audit',
        platform: 'web',
        platform_user_name: 'flagged_user',
        type: 'song',
        content: 'Inappropriate Content',
        target: null,
        status: 'rejected',
        rejection_reason: 'Ethics standards violation',
        created_at: new Date().toISOString(),
      });

      const lifecycle = await getRequestLifecycle('req-rejected-audit');
      expect(lifecycle?.status).toBe('rejected');
      expect(lifecycle?.rejectionReason).toBe('Ethics standards violation');
      expect(lifecycle?.badgeLabel).toBe('REJECTED');
    });

    it('recognizes playing status when requestRow.status is playing even if station_state is null', async () => {
      mockCommunityRequests.push({
        id: 'req-direct-playing',
        platform: 'discord',
        platform_user_name: 'direct_listener',
        type: 'song',
        content: 'Neon Horizon',
        target: 'track-1',
        status: 'playing',
        created_at: new Date().toISOString(),
      });
      mockStationState = null;

      const lifecycle = await getRequestLifecycle('req-direct-playing');
      expect(lifecycle?.status).toBe('playing');
      expect(lifecycle?.isNowPlaying).toBe(true);
    });

    it('leaves queuePosition undefined when channel_queue items do not match request', async () => {
      mockCommunityRequests.push({
        id: 'req-unmatched-queue',
        platform: 'telegram',
        platform_user_name: 'solo_user',
        type: 'song',
        content: 'Solo Jam',
        target: 'track-1',
        status: 'scheduled',
        created_at: new Date().toISOString(),
      });

      mockChannelQueue.push({
        id: 'q-diff',
        channel_id: 'channel-main',
        track_id: 'track-2',
        prompt_used: 'Completely Different',
        requested_by: '@someone_else (discord)',
        played_at: null,
        created_at: new Date().toISOString(),
      });

      const lifecycle = await getRequestLifecycle('req-unmatched-queue');
      expect(lifecycle?.position).toBeUndefined();
      expect(lifecycle?.status).toBe('accepted');
    });
  });

  describe('syncAirplayRequestTransition', () => {
    it('transitions previously playing requests to aired/played and marks new track as playing', async () => {
      // Previous request that was currently playing
      mockCommunityRequests.push({
        id: 'req-prev-1',
        type: 'song',
        target: 'track-prev',
        content: 'Old Song',
        status: 'playing',
        created_at: new Date(Date.now() - 300000).toISOString(),
      });

      // Upcoming request that is scheduled
      mockCommunityRequests.push({
        id: 'req-next-2',
        type: 'song',
        target: 'track-1',
        content: 'Neon Horizon',
        status: 'scheduled',
        created_at: new Date(Date.now() - 100000).toISOString(),
      });

      const syncResult = await syncAirplayRequestTransition('track-1', 'Neon Horizon', 'main');

      // The previous request must be transitioned to 'aired' / 'played'
      const prevReq = mockCommunityRequests.find((r) => r.id === 'req-prev-1');
      expect(prevReq?.status).toBe('aired');
      expect(prevReq?.aired_at).toBeDefined();
      expect(syncResult.completedRequestIds).toContain('req-prev-1');

      // The new request must be transitioned to 'playing'
      const newReq = mockCommunityRequests.find((r) => r.id === 'req-next-2');
      expect(newReq?.status).toBe('playing');
      expect(syncResult.activeRequest).not.toBeNull();
      expect(syncResult.activeRequest?.requestId).toBe('req-next-2');
      expect(syncResult.activeRequest?.status).toBe('playing');
    });

    it('picks the oldest scheduled request in FIFO order when multiple match target trackId', async () => {
      mockCommunityRequests.push(
        {
          id: 'req-older',
          platform: 'discord',
          platform_user_name: 'first_in_line',
          type: 'song',
          content: 'Shared Song',
          target: 'track-shared',
          status: 'scheduled',
          created_at: new Date(Date.now() - 20000).toISOString(),
        },
        {
          id: 'req-newer',
          platform: 'discord',
          platform_user_name: 'second_in_line',
          type: 'song',
          content: 'Shared Song',
          target: 'track-shared',
          status: 'scheduled',
          created_at: new Date().toISOString(),
        }
      );

      const syncResult = await syncAirplayRequestTransition('track-shared', null, 'main');
      expect(syncResult.activeRequest?.requestId).toBe('req-older');
    });

    it('picks the oldest scheduled request in FIFO order when multiple match startedTitle', async () => {
      mockCommunityRequests.push(
        {
          id: 'req-title-older',
          platform: 'discord',
          platform_user_name: 'first_title',
          type: 'song',
          target: 'uuid-1',
          content: 'Cyber Wave',
          status: 'scheduled',
          created_at: new Date(Date.now() - 20000).toISOString(),
        },
        {
          id: 'req-title-newer',
          platform: 'discord',
          platform_user_name: 'second_title',
          type: 'song',
          target: 'uuid-2',
          content: 'Cyber Wave',
          status: 'scheduled',
          created_at: new Date().toISOString(),
        }
      );

      const syncResult = await syncAirplayRequestTransition('', 'Cyber Wave', 'main');
      expect(syncResult.activeRequest?.requestId).toBe('req-title-older');
    });

    it('matches upcoming request by startedTitle with whitespace trim when trackId does not match', async () => {
      mockCommunityRequests.push({
        id: 'req-title-only',
        type: 'song',
        target: 'other-uuid',
        content: 'Cyber Rain',
        status: 'scheduled',
        created_at: new Date().toISOString(),
      });

      const syncResult = await syncAirplayRequestTransition('unmatched-id', '  Cyber Rain  ', 'main');
      expect(syncResult.activeRequest).not.toBeNull();
      expect(syncResult.activeRequest?.requestId).toBe('req-title-only');
    });

    it('handles airplay transition when no requests are in queue or playing', async () => {
      const syncResult = await syncAirplayRequestTransition('non-requested-track', 'Generic Song', 'main');
      expect(syncResult.activeRequest).toBeNull();
      expect(syncResult.completedRequestIds).toEqual([]);
    });

    it('handles airplay transition when startedTrackId and startedTitle are empty', async () => {
      const syncResult = await syncAirplayRequestTransition('', null, 'main');
      expect(syncResult.activeRequest).toBeNull();
      expect(syncResult.completedRequestIds).toEqual([]);
    });
  });
});
