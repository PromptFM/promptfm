// tests/unit/song-pathway.test.ts
// Unit tests for PromptFM Unified Song Pathway (Issue #43)
// Tests queueing, ETA calculation, deduplication, status queries, and safety guardrails across all entrypoints.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateQueueETA,
  formatQueueConfirmation,
  normalizeRequestPlatform,
  executeInsert,
  queueSong,
  getSongQueueStatus,
  type UnifiedSongRequestInput,
} from '@/lib/song/pathway';

// In-memory mock tables
let mockChannelQueue: any[] = [];
let mockCommunityRequests: any[] = [];
let mockTracks: any[] = [];
let mockNowPlaying: any = null;
let mockRagShouldThrow = false;
let mockNowPlayingShouldThrow = false;
let mockCommunityRequestsShouldError = false;
let mockStationState: any = null;

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'channel_queue') {
        return {
          insert: (data: any) => {
            const row = {
              id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              created_at: new Date().toISOString(),
              played_at: null,
              ...data,
            };
            if (data.priority) {
              mockChannelQueue.unshift(row);
            } else {
              mockChannelQueue.push(row);
            }
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          },
          select: (fields?: string) => {
            if (fields === '') throw new Error('Empty select fields on channel_queue');
            return {
              eq: (col: string, val: any) => {
                if (col === '') throw new Error('Empty column in channel_queue eq');
                return {
                  is: (nullCol: string, nullVal: any) => {
                    if (nullCol === '') throw new Error('Empty column in channel_queue is');
                    return {
                      order: (orderCol: string, { ascending }: { ascending: boolean }) => {
                        if (orderCol === '') throw new Error('Empty orderCol in channel_queue');
                        return {
                          limit: async (limitCount: number) => {
                            let filtered = mockChannelQueue
                              .filter((item) => item[col] === val && item[nullCol] === nullVal)
                              .map((item) => ({
                                ...item,
                                track: mockTracks.find((t) => t.id === item.track_id) || null,
                              }));
                            if (!ascending) {
                              filtered = [...filtered].reverse();
                            }
                            return { data: filtered.slice(0, limitCount), error: null };
                          },
                        };
                      },
                    };
                  },
                  eq: (col2: string, val2: any) => ({
                    maybeSingle: async () => {
                      const item = mockChannelQueue.find(
                        (i) => i[col] === val && i[col2] === val2 && i.played_at === null
                      );
                      return { data: item || null, error: null };
                    },
                  }),
                };
              },
            };
          },
        };
      }

      if (table === 'channels') {
        return {
          select: (fields?: string) => {
            if (fields === '') throw new Error('Empty select fields on channels');
            return {
              eq: (col: string, slug: string) => {
                if (col === '') throw new Error('Empty column on channels eq');
                return {
                  maybeSingle: async () => {
                    if (slug === 'non-existent') return { data: null, error: null };
                    return {
                      data: { id: `channel-${slug}`, slug, name: `${slug} Channel` },
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'tracks') {
        return {
          select: (fields?: string) => {
            if (fields === '') throw new Error('Empty select fields on tracks');
            return {
              eq: (col: string, val: any) => ({
                eq: (col2: string, val2: any) => ({
                  maybeSingle: async () => {
                    const track = mockTracks.find((t) => t[col] === val && t[col2] === val2);
                    return { data: track || null, error: null };
                  },
                }),
                ilike: (col2: string, pattern: string) => ({
                  limit: () => ({
                    maybeSingle: async () => {
                      const cleanPattern = pattern.replace(/%/g, '').toLowerCase();
                      const track = mockTracks.find(
                        (t) => t[col] === val && t[col2]?.toLowerCase().includes(cleanPattern)
                      );
                      return { data: track || null, error: null };
                    },
                  }),
                }),
                order: (orderCol: string, { ascending }: { ascending: boolean }) => {
                  if (orderCol === '') throw new Error('Empty orderCol on tracks');
                  return {
                    limit: () => ({
                      maybeSingle: async () => {
                        const sorted = [...mockTracks].filter((t) => t[col] === val);
                        if (!ascending) {
                          sorted.sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0));
                        }
                        return { data: sorted[0] || null, error: null };
                      },
                    }),
                  };
                },
              }),
            };
          },
        };
      }

      if (table === 'station_state') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: mockStationState,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'community_requests') {
        return {
          insert: (data: any) => {
            if (mockCommunityRequestsShouldError) {
              return {
                select: () => ({
                  single: async () => ({ data: null, error: { message: 'Mock DB constraint violation' } }),
                }),
              };
            }
            const row = { id: `req-${Date.now()}-${Math.random()}`, ...data };
            mockCommunityRequests.push(row);
            return {
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            };
          },
        };
      }

      return {};
    },
  }),
}));

vi.mock('@/lib/dj/rag', () => ({
  findTracksByVibe: vi.fn().mockImplementation(async (query: string) => {
    if (mockRagShouldThrow) {
      throw new Error('RAG service offline');
    }
    if (query.includes('cyberpunk') || query.includes('synthwave')) {
      const track = mockTracks.find((t) => t.id === 'track-synth');
      return track ? [{ ...track, similarity: 0.92, matchMethod: 'pgvector_semantic' }] : [];
    }
    return [];
  }),
}));

vi.mock('@/lib/dj/rotation', () => ({
  getNowPlaying: vi.fn().mockImplementation(async () => {
    if (mockNowPlayingShouldThrow) {
      throw new Error('NowPlaying station error');
    }
    return mockNowPlaying;
  }),
}));

vi.mock('@/lib/safety/guardrails', () => ({
  evaluateContentSafety: vi.fn().mockImplementation(async (text: string) => {
    if (text.includes('hate_custom_msg')) {
      return {
        safe: false,
        reason: 'Violation of broadcast ethics',
        category: 'hate_speech',
        refusalMessage: '🚫 Refused via custom message',
      };
    }
    if (text.includes('hate') || text.includes('harassment') || text.includes('offensive')) {
      return {
        safe: false,
        reason: 'Violation of broadcast ethics',
        category: 'hate_speech',
        refusalMessage: null, // Test default template fallback!
      };
    }
    return { safe: true, reason: 'Safe content', category: 'general' };
  }),
}));

describe('Unified Song Pathway (Issue #43)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChannelQueue = [];
    mockCommunityRequests = [];
    mockRagShouldThrow = false;
    mockNowPlayingShouldThrow = false;
    mockCommunityRequestsShouldError = false;
    mockStationState = null;
    mockTracks = [
      {
        id: 'track-synth',
        title: 'Neon Skyline',
        artist_name: 'Synthwave AI',
        status: 'approved',
        upvotes_count: 50,
        duration_seconds: 180,
      },
      {
        id: 'track-ambient',
        title: 'Solar Echoes',
        artist_name: 'Ambient Mind',
        status: 'approved',
        upvotes_count: 20,
        duration_seconds: 210,
      },
    ];
    mockNowPlaying = {
      item: {
        id: 'track-live-now',
        title: 'Current Live Anthem',
        artist: 'PromptFM Resident',
        type: 'music',
      },
      activeDJ: { id: 'dj-sol', name: 'Sol' },
    };
  });

  describe('1. calculateQueueETA', () => {
    it('uses default parameters when optional arguments are omitted', () => {
      const fixedNow = new Date('2026-11-07T12:00:00Z').getTime();
      // Omitting remainingSeconds (default 120), avgDuration (default 180), nowMs (defaults to Date.now())
      const eta = calculateQueueETA(0);

      expect(eta.position).toBe(1);
      expect(eta.itemsAhead).toBe(0);
      expect(eta.waitSeconds).toBe(120);
      expect(eta.waitMinutes).toBe(2);
      expect(eta.formattedETA).toContain('Up Next');
      expect(eta.displayTime).toMatch(/^\d{2}:\d{2} UTC$/);
    });

    it('calculates ETA for position #1 (Up Next) with default remaining current duration', () => {
      const fixedNow = new Date('2026-11-07T12:00:00Z').getTime();
      const eta = calculateQueueETA(0, 120, 180, fixedNow);

      expect(eta.position).toBe(1);
      expect(eta.itemsAhead).toBe(0);
      expect(eta.waitSeconds).toBe(120);
      expect(eta.waitMinutes).toBe(2);
      expect(eta.displayTime).toBe('12:02 UTC');
      expect(eta.formattedETA).toBe('~2 mins (Up Next • ~12:02 UTC)');
    });

    it('calculates ETA for position #3 with 2 items ahead in queue', () => {
      const fixedNow = new Date('2026-11-07T12:00:00Z').getTime();
      const eta = calculateQueueETA(2, 120, 180, fixedNow);

      expect(eta.position).toBe(3);
      expect(eta.itemsAhead).toBe(2);
      expect(eta.waitSeconds).toBe(480);
      expect(eta.waitMinutes).toBe(8);
      expect(eta.displayTime).toBe('12:08 UTC');
      expect(eta.formattedETA).toBe('~8 mins (Queue #3 • ~12:08 UTC)');
    });

    it('handles negative inputs gracefully by clamping to minimum valid numbers', () => {
      const fixedNow = new Date('2026-11-07T12:00:00Z').getTime();
      const eta = calculateQueueETA(-5, -50, 10, fixedNow);

      expect(eta.itemsAhead).toBe(0);
      expect(eta.position).toBe(1);
      expect(eta.waitSeconds).toBe(0);
      expect(eta.waitMinutes).toBe(1); // Clamped minimum
      expect(eta.formattedETA).toBe('~1 min (Up Next • ~12:00 UTC)');
    });

    it('pads single-digit hours and minutes with leading zeroes in displayTime', () => {
      const fixedNow = new Date('2026-11-07T05:01:00Z').getTime();
      const eta = calculateQueueETA(0, 120, 180, fixedNow);

      expect(eta.displayTime).toBe('05:03 UTC');
    });

    it('formats singular min when waitMinutes is exactly 1 for position 1', () => {
      const fixedNow = new Date('2026-11-07T12:00:00Z').getTime();
      const eta = calculateQueueETA(0, 30, 180, fixedNow);

      expect(eta.waitMinutes).toBe(1);
      expect(eta.formattedETA).toContain('~1 min (Up Next');
    });

    it('calculates waitMinutes boundary conditions correctly for 59s, 60s, 61s, 120s, and 121s', () => {
      const fixedNow = new Date('2026-11-07T12:00:00Z').getTime();

      const eta59 = calculateQueueETA(0, 59, 180, fixedNow);
      expect(eta59.waitMinutes).toBe(1);
      expect(eta59.waitSeconds).toBe(59);

      const eta60 = calculateQueueETA(0, 60, 180, fixedNow);
      expect(eta60.waitMinutes).toBe(1);
      expect(eta60.waitSeconds).toBe(60);

      const eta61 = calculateQueueETA(0, 61, 180, fixedNow);
      expect(eta61.waitMinutes).toBe(2);
      expect(eta61.waitSeconds).toBe(61);

      const eta120 = calculateQueueETA(0, 120, 180, fixedNow);
      expect(eta120.waitMinutes).toBe(2);
      expect(eta120.waitSeconds).toBe(120);

      const eta121 = calculateQueueETA(0, 121, 180, fixedNow);
      expect(eta121.waitMinutes).toBe(3);
      expect(eta121.waitSeconds).toBe(121);
    });

    it('calculates position correctly as safeItemsAhead + 1', () => {
      const eta1 = calculateQueueETA(1);
      expect(eta1.position).toBe(2);
      expect(eta1.itemsAhead).toBe(1);

      const eta3 = calculateQueueETA(3);
      expect(eta3.position).toBe(4);
      expect(eta3.itemsAhead).toBe(3);
    });

    it('calculates dynamic ETA accounting for staged track duration', () => {
      const fixedNow = new Date('2026-11-07T12:00:00Z').getTime();
      // itemsAhead: 0, currentRemaining: 60s, avgDuration: 180s, nowMs, stagedTrackSeconds: 210s
      const eta = calculateQueueETA(0, 60, 180, fixedNow, 210);

      expect(eta.position).toBe(1);
      // 60s current remaining + 210s staged track = 270s (~4.5 -> 5 min)
      expect(eta.waitSeconds).toBe(270);
      expect(eta.waitMinutes).toBe(5);
      expect(eta.displayTime).toBe('12:04 UTC');
      expect(eta.formattedETA).toContain('~5 mins');
      expect(eta.isProvisional).toBe(true);
      expect(eta.batchId).toBe('BATCH-12:04');
    });
  });

  describe('2. formatQueueConfirmation', () => {
    it('formats a fresh queue confirmation message with position 1 (Up Next) and artist', () => {
      const msg = formatQueueConfirmation({
        status: 'queued',
        trackTitle: 'Neon Skyline',
        artistName: 'Synthwave AI',
        position: 1,
        waitMinutes: 2,
        displayTime: '12:02 UTC',
        batchId: 'BATCH-12:02',
      });

      expect(msg).toBe(
        '🎵 Track "Neon Skyline" by Synthwave AI queued for live airplay! Position: Up next (#1 in queue) • Scheduled for BATCH-12:02 (~12:02 UTC (est. in ~2m, provisional)). Check live queue anytime with /queue.'
      );
    });

    it('formats a fresh queue confirmation message for position > 1 without artist name', () => {
      const msg = formatQueueConfirmation({
        status: 'queued',
        trackTitle: 'Mystery Sound',
        position: 3,
        waitMinutes: 7,
        displayTime: '12:07 UTC',
        batchId: 'BATCH-12:07',
      });

      expect(msg).toBe(
        '🎵 Track "Mystery Sound" queued for live airplay! Position: #3 in queue • Scheduled for BATCH-12:07 (~12:07 UTC (est. in ~7m, provisional)). Check live queue anytime with /queue.'
      );
    });

    it('formats an already_queued notice with singular min and without artist', () => {
      const msg = formatQueueConfirmation({
        status: 'already_queued',
        trackTitle: 'Solo Beat',
        position: 1,
        waitMinutes: 1,
        displayTime: '12:01 UTC',
      });

      expect(msg).toBe(
        'ℹ️ Track "Solo Beat" is already in the live queue! Position: #${position}'.replace('${position}', '1') +
          ' (Estimated: ~1 min • ~12:01 UTC).'
      );
    });

    it('formats an already_queued notice with plural mins and artist name', () => {
      const msg = formatQueueConfirmation({
        status: 'already_queued',
        trackTitle: 'Neon Skyline',
        artistName: 'Synthwave AI',
        position: 2,
        waitMinutes: 5,
        displayTime: '12:05 UTC',
      });

      expect(msg).toBe(
        'ℹ️ Track "Neon Skyline" by Synthwave AI is already in the live queue! Position: #2 (Estimated: ~5 mins • ~12:05 UTC).'
      );
    });

    it('formats a currently_playing notice when the requested song is on air right now with and without artist', () => {
      const msgWithArtist = formatQueueConfirmation({
        status: 'currently_playing',
        trackTitle: 'Current Live Anthem',
        artistName: 'PromptFM Resident',
        position: 0,
        waitMinutes: 0,
        displayTime: 'Now',
      });
      expect(msgWithArtist).toBe(
        '📻 Track "Current Live Anthem" by PromptFM Resident is playing LIVE right now on air!'
      );

      const msgNoArtist = formatQueueConfirmation({
        status: 'currently_playing',
        trackTitle: 'Secret Jam',
        position: 0,
        waitMinutes: 0,
        displayTime: 'Now',
      });
      expect(msgNoArtist).toBe('📻 Track "Secret Jam" is playing LIVE right now on air!');
    });

    it('formats an already_queued notice when track is staged as up next with and without artist', () => {
      const msgStagedWithArtist = formatQueueConfirmation({
        status: 'already_queued',
        trackTitle: 'Cyber Skyline',
        artistName: 'Synth Master',
        position: 1,
        waitMinutes: 3,
        displayTime: '12:03 UTC',
        isStaged: true,
      });
      expect(msgStagedWithArtist).toBe(
        'ℹ️ Track "Cyber Skyline" by Synth Master is already staged as UP NEXT! Estimated: ~3 mins • ~12:03 UTC. Plays immediately after current track. Check live queue anytime with /queue.'
      );

      const msgStagedNoArtist = formatQueueConfirmation({
        status: 'already_queued',
        trackTitle: 'Cyber Skyline',
        position: 1,
        waitMinutes: 1,
        displayTime: '12:01 UTC',
        isStaged: true,
      });
      expect(msgStagedNoArtist).toBe(
        'ℹ️ Track "Cyber Skyline" is already staged as UP NEXT! Estimated: ~1 min • ~12:01 UTC. Plays immediately after current track. Check live queue anytime with /queue.'
      );
    });

    it('formats a queued confirmation for unmatched generic track requests', () => {
      const msgUnmatched = formatQueueConfirmation({
        status: 'queued',
        trackTitle: 'retro 80s arcade vibe',
        position: 2,
        waitMinutes: 5,
        displayTime: '12:05 UTC',
        batchId: 'BATCH-12:05',
        isUnmatched: true,
      });
      expect(msgUnmatched).toBe(
        '🎵 Track request "retro 80s arcade vibe" added to airplay queue! Position: #2 in queue • Scheduled for BATCH-12:05 (~12:05 UTC (est. in ~5m, provisional)). Check live queue anytime with /queue.'
      );
    });

    it('omits batch label when batchId is omitted or empty', () => {
      const msgNoBatch = formatQueueConfirmation({
        status: 'queued',
        trackTitle: 'Direct Cut',
        position: 1,
        waitMinutes: 2,
        displayTime: '12:02 UTC',
      });
      expect(msgNoBatch).not.toContain('• Scheduled for');
      expect(msgNoBatch).toBe(
        '🎵 Track "Direct Cut" queued for live airplay! Position: Up next (#1 in queue) (~12:02 UTC (est. in ~2m, provisional)). Check live queue anytime with /queue.'
      );
    });

    it('formats standard already_queued when isStaged is explicitly false', () => {
      const msg = formatQueueConfirmation({
        status: 'already_queued',
        trackTitle: 'Queued Beat',
        position: 2,
        waitMinutes: 4,
        displayTime: '12:04 UTC',
        isStaged: false,
      });
      expect(msg).toContain('already in the live queue! Position: #2');
      expect(msg).not.toContain('UP NEXT');
    });
  });

  describe('2b. normalizeRequestPlatform', () => {
    it('normalizes cli, mcp, and web_admin to web platform', () => {
      expect(normalizeRequestPlatform('cli')).toBe('web');
      expect(normalizeRequestPlatform('mcp')).toBe('web');
      expect(normalizeRequestPlatform('web_admin')).toBe('web');
    });

    it('preserves native discord, telegram, and web platforms', () => {
      expect(normalizeRequestPlatform('discord')).toBe('discord');
      expect(normalizeRequestPlatform('telegram')).toBe('telegram');
      expect(normalizeRequestPlatform('web')).toBe('web');
    });
  });

  describe('2c. executeInsert', () => {
    it('executes builder with select().single() returning data and null error', async () => {
      const builder = {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'row-1' }, error: null }),
        }),
      };
      const res = await executeInsert(builder);
      expect(res.data).toEqual({ id: 'row-1' });
      expect(res.error).toBeNull();
      expect(builder.select).toHaveBeenCalled();
    });

    it('executes builder with select().single() returning error and null data', async () => {
      const builder = {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'unique constraint' } }),
        }),
      };
      const res = await executeInsert(builder);
      expect(res.data).toBeNull();
      expect(res.error).toEqual({ message: 'unique constraint' });
    });

    it('executes direct promise builder without select method returning data', async () => {
      const builder = Promise.resolve({ data: { id: 'row-direct' }, error: null });
      const res = await executeInsert(builder);
      expect(res.data).toEqual({ id: 'row-direct' });
      expect(res.error).toBeNull();
    });

    it('executes direct promise builder without select method returning error', async () => {
      const builder = Promise.resolve({ data: null, error: { message: 'network timeout' } });
      const res = await executeInsert(builder);
      expect(res.data).toBeNull();
      expect(res.error).toEqual({ message: 'network timeout' });
    });

    it('handles undefined or null builder gracefully', async () => {
      const res = await executeInsert(null);
      expect(res.data).toBeNull();
      expect(res.error).toBeNull();
    });
  });

  describe('3. queueSong Core Pathway', () => {
    it('successfully queues a song via semantic RAG vibe search', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'discord',
        requestedBy: 'NeonFan#1234',
        userId: 'discord-u1',
        messageId: 'msg-999',
        prompt: 'cyberpunk synthwave driving fast',
      };

      const result = await queueSong(input);

      expect(result.status).toBe('queued');
      expect(result.track.id).toBe('track-synth');
      expect(result.track.title).toBe('Neon Skyline');
      expect(result.position).toBe(1);
      expect(result.eta.waitMinutes).toBeGreaterThanOrEqual(1);
      expect(result.confirmationMessage).toContain('Neon Skyline');
      expect(result.confirmationMessage).toContain('Position: Up next (#1 in queue)');

      // Verify channel_queue insertion
      expect(mockChannelQueue).toHaveLength(1);
      expect(mockChannelQueue[0].track_id).toBe('track-synth');
      expect(mockChannelQueue[0].prompt_used).toBe('cyberpunk synthwave driving fast');
      expect(mockChannelQueue[0].requested_by).toBe('@NeonFan#1234 (discord)');

      // Verify community_requests logging
      expect(mockCommunityRequests).toHaveLength(1);
      expect(mockCommunityRequests[0].type).toBe('song');
      expect(mockCommunityRequests[0].status).toBe('scheduled');
      expect(mockCommunityRequests[0].platform).toBe('discord');
      expect(mockCommunityRequests[0].content).toBe('cyberpunk synthwave driving fast');
      expect(mockCommunityRequests[0].target).toBe('track-synth');
      expect(mockCommunityRequests[0].batch_id).toBe(result.eta.batchId);
      expect(mockCommunityRequests[0].platform_message_id).toBe('msg-999');

      expect(result.queueItemId).toBe(mockChannelQueue[0].id);
      expect(result.requestId).toBe(mockCommunityRequests[0].id);
    });

    it('formats requestedBy without prepending redundant @ if already present', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'telegram',
        requestedBy: '@already_at',
        prompt: 'cyberpunk',
      };

      await queueSong(input);
      expect(mockChannelQueue[0].requested_by).toBe('@already_at (telegram)');
    });

    it('maps cli, mcp, and web_admin platforms to web in community_requests', async () => {
      await queueSong({ source: 'cli', requestedBy: 'admin', prompt: 'cyberpunk' });
      expect(mockCommunityRequests[0].platform).toBe('web');

      mockCommunityRequests = [];
      mockChannelQueue = [];
      await queueSong({ source: 'mcp', requestedBy: 'agent', prompt: 'cyberpunk' });
      expect(mockCommunityRequests[0].platform).toBe('web');

      mockCommunityRequests = [];
      mockChannelQueue = [];
      await queueSong({ source: 'web_admin', requestedBy: 'director', prompt: 'cyberpunk' });
      expect(mockCommunityRequests[0].platform).toBe('web');
    });

    it('falls back to lexical title search when RAG search yields no match', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'web',
        requestedBy: 'Web Listener',
        prompt: 'Solar Echoes', // RAG mock only matches cyberpunk/synthwave
      };

      const result = await queueSong(input);

      expect(result.status).toBe('queued');
      expect(result.track.id).toBe('track-ambient');
      expect(result.track.title).toBe('Solar Echoes');
    });

    it('falls back to top approved track when prompt matches neither RAG nor title', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'web',
        requestedBy: 'Web Listener',
        prompt: 'obscure totally unindexed prompt 12345',
      };

      const result = await queueSong(input);

      expect(result.status).toBe('queued');
      expect(result.track.id).toBe('track-synth'); // Top track by upvotes
    });

    it('falls back gracefully to lexical and top track when RAG throws an error', async () => {
      mockRagShouldThrow = true;

      const input: UnifiedSongRequestInput = {
        source: 'discord',
        requestedBy: 'listener',
        prompt: 'Solar Echoes',
      };

      const result = await queueSong(input);
      expect(result.status).toBe('queued');
      expect(result.track.title).toBe('Solar Echoes');
    });

    it('returns no_match when library is completely empty and no track can be resolved', async () => {
      mockTracks = [];

      const input: UnifiedSongRequestInput = {
        source: 'discord',
        requestedBy: 'user',
        prompt: 'anything',
      };

      const result = await queueSong(input);
      expect(result.status).toBe('no_match');
      expect(result.confirmationMessage).toContain('No approved tracks found');
    });

    it('returns no_match when prompt is empty and trackId is not provided', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'discord',
        requestedBy: 'user',
        prompt: '   ',
      };

      const result = await queueSong(input);
      expect(result.status).toBe('no_match');
    });

    it('handles direct trackId lookup when track exists and is approved', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'cli',
        requestedBy: 'Admin',
        trackId: 'track-ambient',
      };

      const result = await queueSong(input);
      expect(result.status).toBe('queued');
      expect(result.track.id).toBe('track-ambient');
    });

    it('detects when requested track is currently playing on air and prevents duplicate queueing', async () => {
      mockTracks.push({
        id: 'track-live-now',
        title: 'Current Live Anthem',
        artist_name: 'PromptFM Resident',
        status: 'approved',
      });

      const input: UnifiedSongRequestInput = {
        source: 'telegram',
        requestedBy: 'tele_user',
        userId: 'tg-u2',
        prompt: 'Current Live Anthem',
      };

      const result = await queueSong(input);

      expect(result.status).toBe('currently_playing');
      expect(result.confirmationMessage).toContain('playing LIVE right now');
      expect(mockChannelQueue).toHaveLength(0);
    });

    it('continues queueing normally if getNowPlaying throws an exception', async () => {
      mockNowPlayingShouldThrow = true;

      const input: UnifiedSongRequestInput = {
        source: 'web',
        requestedBy: 'listener',
        prompt: 'cyberpunk',
      };

      const result = await queueSong(input);
      expect(result.status).toBe('queued');
      expect(result.track.id).toBe('track-synth');
    });

    it('detects when requested track is already pending in queue and returns existing position & ETA', async () => {
      await queueSong({
        source: 'discord',
        requestedBy: 'first_user',
        prompt: 'Neon Skyline',
      });
      expect(mockChannelQueue).toHaveLength(1);

      const duplicateAttempt = await queueSong({
        source: 'telegram',
        requestedBy: 'second_user',
        prompt: 'Neon Skyline',
      });

      expect(duplicateAttempt.status).toBe('already_queued');
      expect(duplicateAttempt.position).toBe(1);
      expect(duplicateAttempt.confirmationMessage).toContain('already in the live queue');
      expect(mockChannelQueue).toHaveLength(1);
    });

    it('factors in staged track duration when computing ETA for new song request', async () => {
      mockStationState = {
        channel_slug: 'main',
        airplay_item: {
          id: 'track-live',
          title: 'Live Track',
          duration_hint_seconds: 180,
        },
        staged_item: {
          id: 'track-staged',
          title: 'Staged Ambient Synth',
          duration_hint_seconds: 210,
        },
        started_at: new Date(Date.now() - 60 * 1000).toISOString(), // 120s remaining
      };

      const result = await queueSong({
        source: 'discord',
        requestedBy: 'TestUser',
        prompt: 'cyberpunk',
      });

      expect(result.status).toBe('queued');
      // 120s current + 210s staged = 330s (~6 mins)
      expect(result.eta.waitMinutes).toBe(6);
      expect(result.confirmationMessage).toContain('~6m');
    });

    it('deduplicates when listener requests a track currently staged in station_state', async () => {
      mockStationState = {
        channel_slug: 'main',
        airplay_item: {
          id: 'track-live',
          title: 'Live Track',
          duration_hint_seconds: 180,
        },
        staged_item: {
          id: 'track-synth',
          title: 'Neon Skyline',
          artist: 'Synthwave AI',
          duration_hint_seconds: 180,
        },
        started_at: new Date(Date.now() - 60 * 1000).toISOString(),
      };

      const result = await queueSong({
        source: 'discord',
        requestedBy: 'TestUser',
        prompt: 'Neon Skyline',
      });

      expect(result.status).toBe('already_queued');
      expect(mockChannelQueue).toHaveLength(0);
      expect(result.confirmationMessage).toContain('already');
      expect(result.confirmationMessage).toContain('Neon Skyline');
    });

    it('matches staged item by prompt matching staged title and falls back to staged artist', async () => {
      mockTracks.push({
        id: 'track-no-artist',
        title: 'Cyber Drift',
        artist_name: '',
        status: 'approved',
      });

      mockStationState = {
        channel_slug: 'main',
        airplay_item: {
          id: 'track-live',
          title: 'Live Track',
          duration_hint_seconds: 180,
        },
        staged_item: {
          id: 'track-no-artist',
          title: 'Cyber Drift',
          artist: 'Staged Fallback Artist',
          // Omit duration_hint_seconds to test 210 default fallback
        },
        started_at: new Date(Date.now() - 60 * 1000).toISOString(),
      };

      const result = await queueSong({
        source: 'telegram',
        requestedBy: 'TgUser',
        prompt: 'Cyber Drift',
      });

      expect(result.status).toBe('already_queued');
      expect(result.confirmationMessage).toContain('by Staged Fallback Artist');
      expect(result.confirmationMessage).toContain('already staged as UP NEXT');
    });

    it('bypasses staged deduplication when request includes dedicationTarget', async () => {
      mockStationState = {
        channel_slug: 'main',
        airplay_item: { id: 'track-live', title: 'Live' },
        staged_item: { id: 'track-synth', title: 'Neon Skyline' },
      };

      const result = await queueSong({
        source: 'discord',
        requestedBy: 'Lover',
        prompt: 'Neon Skyline',
        dedicationTarget: 'Friend',
      });

      expect(result.status).toBe('queued');
      expect(mockChannelQueue.length).toBe(1);
    });

    it('rejects submissions violating broadcast guardrails and uses default message when refusalMessage is null', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'mcp',
        requestedBy: 'ai-agent',
        prompt: 'hate speech and offensive lyrics',
      };

      const result = await queueSong(input);

      expect(result.status).toBe('rejected');
      expect(result.isRejected).toBe(true);
      expect(result.rejectionReason).toContain('Violation of broadcast ethics');
      expect(result.confirmationMessage).toContain('broadcast ethics (hate speech)');
      expect(result.confirmationMessage).toContain('PromptFM operates as a family-safe and inclusive 24/7 radio station');
      expect(mockChannelQueue).toHaveLength(0);
      expect(mockCommunityRequests).toHaveLength(1);
      expect(mockCommunityRequests[0].status).toBe('rejected');
      expect(mockCommunityRequests[0].platform).toBe('web');
      expect(mockCommunityRequests[0].platform_user_id).toBe('anon');
      expect(mockCommunityRequests[0].platform_message_id).toBeNull();
      expect(mockCommunityRequests[0].type).toBe('song');
      expect(mockCommunityRequests[0].target).toBeNull();
    });

    it('rejects submissions with custom userId, messageId, and dedicationTarget and logs them to community_requests', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'discord',
        requestedBy: 'MaliciousUser',
        userId: 'user-hate-123',
        messageId: 'msg-hate-456',
        dedicationTarget: 'Ex-Partner',
        prompt: 'harassment text',
      };

      const result = await queueSong(input);

      expect(result.status).toBe('rejected');
      expect(mockCommunityRequests).toHaveLength(1);
      expect(mockCommunityRequests[0].platform).toBe('discord');
      expect(mockCommunityRequests[0].platform_user_id).toBe('user-hate-123');
      expect(mockCommunityRequests[0].platform_message_id).toBe('msg-hate-456');
      expect(mockCommunityRequests[0].target).toBe('Ex-Partner');
      expect(mockCommunityRequests[0].type).toBe('song');
      expect(mockCommunityRequests[0].status).toBe('rejected');
    });

    it('propagates custom non-main channelSlug to findTracksByVibe', async () => {
      const { findTracksByVibe } = await import('@/lib/dj/rag');
      const input: UnifiedSongRequestInput = {
        source: 'web',
        requestedBy: 'VibeLover',
        channelSlug: 'cyberpunk',
        prompt: 'cyberpunk driving fast',
      };

      const result = await queueSong(input);

      expect(result.status).toBe('queued');
      expect(findTracksByVibe).toHaveBeenCalledWith(
        'cyberpunk driving fast',
        expect.objectContaining({ channelSlug: 'cyberpunk' })
      );
    });

    it('handles direct trackId lookup when track ID does not exist in library', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'cli',
        requestedBy: 'AdminUser',
        trackId: 'track-does-not-exist',
      };

      const result = await queueSong(input);

      expect(result.status).toBe('no_match');
      expect(result.confirmationMessage).toContain('No approved tracks found matching "request"');
    });

    it('deduplicates when requested trackId already exists in pending channel_queue', async () => {
      mockChannelQueue.push({
        id: 'q-queued-earlier',
        track_id: 'track-synth',
        channel_id: 'channel-main',
        created_at: new Date(Date.now() - 30 * 1000).toISOString(),
        played_at: null,
      });

      const input: UnifiedSongRequestInput = {
        source: 'discord',
        requestedBy: 'RepeatUser',
        trackId: 'track-synth',
      };

      const result = await queueSong(input);

      expect(result.status).toBe('already_queued');
      expect(result.position).toBe(1);
      expect(result.confirmationMessage).toContain('already in the live queue');
    });

    it('rejects submissions violating broadcast guardrails and preserves custom refusalMessage if present', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'mcp',
        requestedBy: 'ai-agent',
        prompt: 'hate_custom_msg',
      };

      const result = await queueSong(input);

      expect(result.status).toBe('rejected');
      expect(result.confirmationMessage).toBe('🚫 Refused via custom message');
    });

    it('supports direct trackId specification with priority bump to front of queue', async () => {
      mockChannelQueue.push({
        id: 'q-existing',
        track_id: 'track-ambient',
        channel_id: 'channel-main',
        created_at: '2026-11-07T10:00:00Z',
        played_at: null,
      });

      const input: UnifiedSongRequestInput = {
        source: 'cli',
        requestedBy: 'Station Admin',
        trackId: 'track-synth',
        priority: true,
      };

      const result = await queueSong(input);

      expect(result.status).toBe('queued');
      expect(result.position).toBe(1);
      expect(result.track.id).toBe('track-synth');
      expect(mockChannelQueue[0].prompt_used).toBe('Neon Skyline');
      expect(mockCommunityRequests[0].content).toBe('Neon Skyline');
    });

    it('falls back to channel-main when channel query returns null', async () => {
      const input: UnifiedSongRequestInput = {
        source: 'web',
        requestedBy: 'user',
        channelSlug: 'non-existent',
        prompt: 'cyberpunk',
      };

      const result = await queueSong(input);
      expect(result.status).toBe('queued');
      expect(mockChannelQueue[0].channel_id).toBe('channel-main');
    });

    it('calculates position and ETA correctly for position 3 when 2 tracks are ahead', async () => {
      mockChannelQueue.push(
        { id: 'q1', track_id: 't1', channel_id: 'channel-main', played_at: null, created_at: '2026-11-07T10:00:00Z' },
        { id: 'q2', track_id: 't2', channel_id: 'channel-main', played_at: null, created_at: '2026-11-07T10:01:00Z' }
      );
      const result = await queueSong({
        source: 'discord',
        requestedBy: 'user3',
        prompt: 'Neon Skyline',
      });
      expect(result.status).toBe('queued');
      expect(result.position).toBe(3);
      expect(result.eta.itemsAhead).toBe(2);
      expect(result.eta.waitSeconds).toBe(540);
      expect(result.eta.waitMinutes).toBe(9);
      expect(mockCommunityRequests[0].batch_id).toMatch(/^BATCH-/);
      expect(mockCommunityRequests[0].platform_user_id).toBe('station-user');
      expect(mockCommunityRequests[0].platform_message_id).toBeNull();
      expect(mockCommunityRequests[0].target).toBe('track-synth');
    });

    it('returns position 2 and accurate ETA when track is 2nd in active queue', async () => {
      mockChannelQueue.push(
        { id: 'q1', track_id: 'track-ambient', channel_id: 'channel-main', played_at: null, created_at: '2026-11-07T10:00:00Z' },
        { id: 'q2', track_id: 'track-synth', channel_id: 'channel-main', played_at: null, created_at: '2026-11-07T10:01:00Z' }
      );
      const result = await queueSong({
        source: 'discord',
        requestedBy: 'user2',
        prompt: 'Neon Skyline',
      });
      expect(result.status).toBe('already_queued');
      expect(result.position).toBe(2);
      expect(result.eta.itemsAhead).toBe(1);
      expect(result.eta.waitMinutes).toBe(5);
      expect(result.queueItemId).toBe('q2');
    });

    it('records track title as content when prompt is omitted but trackId is provided', async () => {
      const res = await queueSong({
        source: 'web',
        requestedBy: 'Admin',
        trackId: 'track-ambient',
      });
      expect(res.status).toBe('queued');
      expect(mockCommunityRequests[0].content).toBe('Solar Echoes');
      expect(mockCommunityRequests[0].platform).toBe('web');
    });

    it('throws when community_requests insert returns database error', async () => {
      mockCommunityRequestsShouldError = true;
      await expect(
        queueSong({
          source: 'web',
          requestedBy: 'user',
          prompt: 'Neon Skyline',
        })
      ).rejects.toThrow('Failed to log request: Mock DB constraint violation');
    });

    it('formats requestedBy with dedication when dedicationTarget is provided', async () => {
      const result = await queueSong({
        source: 'discord',
        requestedBy: 'user',
        prompt: 'Neon Skyline',
        dedicationTarget: 'FriendName',
      });
      expect(result.status).toBe('queued');
      expect(mockChannelQueue[0].requested_by).toBe('@user (Dedicated to @FriendName)');
    });

    it('schedules fallback request when allowFallbackRequest is true and no track matches', async () => {
      mockTracks = [];
      const result = await queueSong({
        source: 'telegram',
        requestedBy: 'user',
        prompt: 'unmatched melody',
        allowFallbackRequest: true,
      });
      expect(result.status).toBe('queued');
      expect(result.confirmationMessage).toContain('Track request "unmatched melody" added to airplay queue!');
      expect(mockChannelQueue).toHaveLength(0);
      expect(mockCommunityRequests).toHaveLength(1);
    });
  });

  describe('4. getSongQueueStatus', () => {
    beforeEach(() => {
      mockChannelQueue.push(
        {
          id: 'q-1',
          track_id: 'track-synth',
          channel_id: 'channel-main',
          prompt_used: 'cyberpunk vibe',
          requested_by: '@alex (discord)',
          created_at: new Date(Date.now() - 60000).toISOString(),
          played_at: null,
        },
        {
          id: 'q-2',
          track_id: 'track-ambient',
          channel_id: 'channel-main',
          prompt_used: 'chill ambient',
          requested_by: '@elena (telegram)',
          created_at: new Date().toISOString(),
          played_at: null,
        }
      );
    });

    it('returns ordered list of queued tracks with accurate positions and live ETAs with default main slug', async () => {
      const status = await getSongQueueStatus(); // Test default parameter

      expect(status.channelSlug).toBe('main');
      expect(status.totalQueued).toBe(2);
      expect(status.items).toHaveLength(2);

      const first = status.items[0];
      expect(first?.position).toBe(1);
      expect(first?.track.title).toBe('Neon Skyline');
      expect(first?.eta.formattedETA).toContain('Up Next');

      const second = status.items[1];
      expect(second?.position).toBe(2);
      expect(second?.track.title).toBe('Solar Echoes');
      expect(second?.eta.formattedETA).toContain('Queue #2');
    });

    it('finds a specific track in queue by track ID', async () => {
      const status = await getSongQueueStatus('main', 'track-ambient');

      expect(status.matchedItem).toBeDefined();
      expect(status.matchedItem?.position).toBe(2);
      expect(status.matchedItem?.track.id).toBe('track-ambient');
    });

    it('finds a specific track in queue by prompt used with whitespace and uppercase', async () => {
      const status = await getSongQueueStatus('main', '  CYBERPUNK VIBE  ');

      expect(status.matchedItem).toBeDefined();
      expect(status.matchedItem?.position).toBe(1);
      expect(status.matchedItem?.track.title).toBe('Neon Skyline');
    });

    it('returns undefined matchedItem when search query does not match any queued item', async () => {
      const status = await getSongQueueStatus('main', 'heavy polka jazz polka');

      expect(status.matchedItem).toBeUndefined();
      expect(status.totalQueued).toBe(2);
    });

    it('handles channel returning null in getSongQueueStatus', async () => {
      const status = await getSongQueueStatus('non-existent');
      expect(status.channelSlug).toBe('non-existent');
    });

    it('finds track in queue using lowercase title when track title is mixed case', async () => {
      const status = await getSongQueueStatus('main', 'neon skyline');
      expect(status.matchedItem).toBeDefined();
      expect(status.matchedItem?.track.title).toBe('Neon Skyline');
    });

    it('handles items in queue with missing track or prompt without throwing', async () => {
      mockChannelQueue.unshift({
        id: 'q-broken',
        track_id: 't-ghost',
        channel_id: 'channel-main',
        prompt_used: null,
        requested_by: 'system',
        created_at: new Date(Date.now() - 120000).toISOString(),
        played_at: null,
      });
      const status = await getSongQueueStatus('main', 'Solar Echoes');
      expect(status.matchedItem).toBeDefined();
      expect(status.matchedItem?.track.title).toBe('Solar Echoes');
      expect(status.totalQueued).toBe(3);
    });

    it('maintains strict ascending order by created_at timestamp', async () => {
      const status = await getSongQueueStatus('main');
      const time0 = new Date(status.items[0]?.createdAt || '').getTime();
      const time1 = new Date(status.items[1]?.createdAt || '').getTime();
      expect(time0).toBeLessThan(time1);
    });

    it('returns empty items array when channel queue is empty', async () => {
      mockChannelQueue = [];
      const status = await getSongQueueStatus('main');
      expect(status.totalQueued).toBe(0);
      expect(status.items).toEqual([]);
      expect(status.matchedItem).toBeUndefined();
    });
  });
});
