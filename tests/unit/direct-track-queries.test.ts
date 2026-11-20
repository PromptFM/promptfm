import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockPgEnd = vi.fn().mockResolvedValue(undefined);
const mockPgConnect = vi.fn().mockResolvedValue(undefined);
const mockPgQuery = vi.fn().mockResolvedValue({ rows: [] });

vi.mock('pg', () => {
  class MockClient {
    connect = mockPgConnect;
    query = mockPgQuery;
    end = mockPgEnd;
  }
  return {
    Client: MockClient,
  };
});

import {
  formatPostgresSessionUrl,
  isSupabasePoolerHost,
  getDirectPostgresDatabaseUrl,
  fetchApprovedTracksDirect,
  fetchTrackByIdOrTitleDirect,
  insertTrackDirect,
  listAllTracksDirect,
  fetchTrackByTitleOrLyricsDirect,
  fetchStationStateDirect,
  countPendingQueueDirect,
  insertChannelQueueDirect,
  insertCommunityRequestDirect,
  incrementTrackUpvotesDirect,
  type DirectDbTrackRow,
  type InsertTrackInput,
} from '../../src/lib/dj/direct-track-queries';

describe('direct track queries module', () => {
  it('validates supabase pooler hostnames securely without substring bypasses', () => {
    expect(isSupabasePoolerHost('pooler.supabase.com')).toBe(true);
    expect(isSupabasePoolerHost('aws-0-us-east-1.pooler.supabase.com')).toBe(true);
    expect(isSupabasePoolerHost('AWS-0-EU-CENTRAL-1.POOLER.SUPABASE.COM')).toBe(true);

    // Substring bypasses must fail
    expect(isSupabasePoolerHost('evil-pooler.supabase.com')).toBe(false);
    expect(isSupabasePoolerHost('pooler.supabase.com.attacker.com')).toBe(false);
    expect(isSupabasePoolerHost('attacker-pooler.supabase.com')).toBe(false);
    expect(isSupabasePoolerHost('db.example.com')).toBe(false);
    expect(isSupabasePoolerHost('')).toBe(false);
    expect(isSupabasePoolerHost(null as any)).toBe(false);
  });

  it('formats pooler URLs to use session port 5432', () => {
    const pooler6543 = 'postgres://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';
    expect(formatPostgresSessionUrl(pooler6543)).toBe(
      'postgres://user:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'
    );

    const nonPooler = 'postgres://user:pass@db.example.com:5432/db';
    expect(formatPostgresSessionUrl(nonPooler)).toBe(nonPooler);

    // Non-pooler with port 6543 should remain unchanged
    expect(formatPostgresSessionUrl('postgres://user:pass@db.example.com:6543/db')).toBe(
      'postgres://user:pass@db.example.com:6543/db'
    );

    // Scheme-less pooler URL
    expect(formatPostgresSessionUrl('aws-0-us-east-1.pooler.supabase.com:6543/postgres')).toBe(
      'aws-0-us-east-1.pooler.supabase.com:5432/postgres'
    );

    // Falsy or non-string input
    expect(formatPostgresSessionUrl('' as any)).toBe('');
    expect(formatPostgresSessionUrl(null as any)).toBeNull();
    expect(formatPostgresSessionUrl('http://[invalid-ipv6')).toBe('http://[invalid-ipv6');
  });

  it('resolves database URL with expected priority and session formatting', () => {
    const env = {
      DATABASE_URL: 'postgres://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require',
      POSTGRES_URL: 'postgres://other:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require',
    };
    expect(getDirectPostgresDatabaseUrl(env)).toBe(
      'postgres://user:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'
    );

    expect(getDirectPostgresDatabaseUrl({ POSTGRES_URL_NON_POOLING: 'postgres://direct:5432/db' })).toBe(
      'postgres://direct:5432/db'
    );

    expect(getDirectPostgresDatabaseUrl({ POSTGRES_URL: 'postgres://direct:5432/db' })).toBe(
      'postgres://direct:5432/db'
    );

    expect(getDirectPostgresDatabaseUrl({ SUPABASE_DB_URL: 'postgres://direct:5432/db' })).toBe(
      'postgres://direct:5432/db'
    );

    expect(getDirectPostgresDatabaseUrl({})).toBeNull();
    expect(getDirectPostgresDatabaseUrl({ DATABASE_URL: '   ' })).toBeNull();
  });

  it('fetches approved tracks using mock pg client with default and custom limits', async () => {
    const mockRows: DirectDbTrackRow[] = [
      {
        id: '1',
        title: 'Song 1',
        artist_name: 'Artist 1',
        audio_url: 'https://r2.dev/song1.mp3',
        tool_used: 'Suno',
        upvotes_count: 10,
        cover_art_url: '/cover1.jpg',
      },
    ];

    const mockQuery = vi.fn().mockResolvedValue({ rows: mockRows });
    const mockClient = {
      query: mockQuery,
      end: vi.fn().mockResolvedValue(undefined),
    };

    const tracks = await fetchApprovedTracksDirect({
      limit: 10,
      client: mockClient as any,
    });

    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.title).toBe('Song 1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = 'approved'"),
      [10]
    );
    expect(mockClient.end).not.toHaveBeenCalled();

    // Default limit
    await fetchApprovedTracksDirect({
      client: mockClient as any,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = 'approved'"),
      [200]
    );
    expect(mockClient.end).not.toHaveBeenCalled();
  });

  it('fetchApprovedTracksDirect creates and closes own client when databaseUrl is provided', async () => {
    mockPgQuery.mockResolvedValueOnce({ rows: [] });
    await fetchApprovedTracksDirect({ databaseUrl: 'postgres://localhost:5432/db' });
    expect(mockPgConnect).toHaveBeenCalled();
    expect(mockPgEnd).toHaveBeenCalled();
  });

  it('returns empty array when no client and no databaseUrl is configured', async () => {
    const originalEnv = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.POSTGRES_URL_NON_POOLING;
    delete process.env.SUPABASE_DB_URL;

    try {
      const tracks = await fetchApprovedTracksDirect({});
      expect(tracks).toEqual([]);

      const single = await fetchTrackByIdOrTitleDirect({ id: '1' });
      expect(single).toBeNull();
    } finally {
      if (originalEnv) process.env.DATABASE_URL = originalEnv;
    }
  });

  it('fetches a single track by id', async () => {
    const mockRow: DirectDbTrackRow = {
      id: 'track-123',
      title: 'Echoes of Sound',
      artist_name: 'Artist',
      audio_url: 'https://r2.dev/echoes.mp3',
      tool_used: 'Stable Audio',
      upvotes_count: 20,
    };

    const mockQuery = vi.fn().mockResolvedValue({ rows: [mockRow] });
    const mockClient = {
      query: mockQuery,
      end: vi.fn().mockResolvedValue(undefined),
    };

    const track = await fetchTrackByIdOrTitleDirect({
      id: 'track-123',
      client: mockClient as any,
    });

    expect(track).not.toBeNull();
    expect(track?.id).toBe('track-123');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('id::text = $1'),
      ['track-123']
    );
  });

  it('fetches a single track by title with trimmed case-insensitive search', async () => {
    const mockRow: DirectDbTrackRow = {
      id: 'track-123',
      title: 'Echoes of Sound',
      artist_name: 'Artist',
      audio_url: 'https://r2.dev/echoes.mp3',
      tool_used: 'Stable Audio',
      upvotes_count: 20,
    };

    const mockQuery = vi.fn().mockResolvedValue({ rows: [mockRow] });
    const mockClient = {
      query: mockQuery,
      end: vi.fn().mockResolvedValue(undefined),
    };

    const trackByTitle = await fetchTrackByIdOrTitleDirect({
      title: '  Echoes of Sound  ',
      client: mockClient as any,
    });

    expect(trackByTitle?.title).toBe('Echoes of Sound');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(title) = LOWER($1)'),
      ['Echoes of Sound']
    );
    expect(mockClient.end).not.toHaveBeenCalled();
  });

  it('fetchTrackByIdOrTitleDirect creates and closes own client when databaseUrl is provided', async () => {
    mockPgQuery.mockResolvedValueOnce({ rows: [] });
    await fetchTrackByIdOrTitleDirect({ id: '1', databaseUrl: 'postgres://localhost:5432/db' });
    expect(mockPgConnect).toHaveBeenCalled();
    expect(mockPgEnd).toHaveBeenCalled();
  });

  it('returns null when query has neither id nor title', async () => {
    const mockClient = {
      query: vi.fn(),
      end: vi.fn(),
    };

    const track = await fetchTrackByIdOrTitleDirect({
      client: mockClient as any,
    });

    expect(track).toBeNull();
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('returns null when track is not found in database', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const mockClient = {
      query: mockQuery,
      end: vi.fn().mockResolvedValue(undefined),
    };

    const track = await fetchTrackByIdOrTitleDirect({
      id: 'non-existent',
      client: mockClient as any,
    });

    expect(track).toBeNull();
  });

  describe('insertTrackDirect', () => {
    it('inserts a track with full metadata and returns the created row', async () => {
      const mockInserted = {
        id: 'new-track-uuid',
        title: 'Cyber Sunrise',
        artist_name: 'DJ Nova',
        audio_url: 'https://pub-r2.dev/tracks/admin/new-track.mp3',
        tool_used: 'Suno',
        upvotes_count: 50,
        cover_art_url: 'https://pub-r2.dev/tracks/admin/covers/cover.jpg',
        category: 'Synthwave',
        description: 'Sunrise vibes',
        lyrics: 'Glow in the dawn',
        is_explicit: false,
        family_friendly: true,
        channel_exclusions: ['18plus'],
        status: 'approved',
      };

      const mockQuery = vi.fn().mockResolvedValue({ rows: [mockInserted] });
      const mockClient = {
        query: mockQuery,
        end: vi.fn().mockResolvedValue(undefined),
      };

      const track = await insertTrackDirect(
        {
          title: 'Cyber Sunrise',
          artist_name: 'DJ Nova',
          audio_url: 'https://pub-r2.dev/tracks/admin/new-track.mp3',
          category: 'Synthwave',
          tool_used: 'Suno',
          description: 'Sunrise vibes',
          lyrics: 'Glow in the dawn',
          cover_art_url: 'https://pub-r2.dev/tracks/admin/covers/cover.jpg',
          upvotes_count: 50,
          family_friendly: true,
          is_explicit: false,
          channel_exclusions: ['18plus'],
        },
        { client: mockClient as any }
      );

      expect(track.id).toBe('new-track-uuid');
      expect(track.title).toBe('Cyber Sunrise');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.tracks'),
        [
          'Cyber Sunrise',
          'DJ Nova',
          'https://pub-r2.dev/tracks/admin/new-track.mp3',
          'Synthwave',
          'Suno',
          'Sunrise vibes',
          'Glow in the dawn',
          'https://pub-r2.dev/tracks/admin/covers/cover.jpg',
          'approved',
          50,
          true,
          false,
          ['18plus'],
        ]
      );
    });

    it('applies standard defaults when optional metadata is omitted', async () => {
      const mockInserted = {
        id: 'default-track-uuid',
        title: 'Minimal Song',
        artist_name: 'Artist',
        audio_url: 'https://pub-r2.dev/minimal.mp3',
        tool_used: 'Suno',
        upvotes_count: 25,
        cover_art_url: null,
        category: 'General',
        description: null,
        lyrics: null,
        is_explicit: false,
        family_friendly: true,
        channel_exclusions: [],
        status: 'approved',
      };

      const mockQuery = vi.fn().mockResolvedValue({ rows: [mockInserted] });
      const mockClient = {
        query: mockQuery,
        end: vi.fn().mockResolvedValue(undefined),
      };

      const track = await insertTrackDirect(
        {
          title: 'Minimal Song',
          artist_name: 'Artist',
          audio_url: 'https://pub-r2.dev/minimal.mp3',
        },
        { client: mockClient as any }
      );

      expect(track.id).toBe('default-track-uuid');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.tracks'),
        [
          'Minimal Song',
          'Artist',
          'https://pub-r2.dev/minimal.mp3',
          'General',
          'Suno',
          null,
          null,
          null,
          'approved',
          25,
          true,
          false,
          [],
        ]
      );
    });

    it('throws validation error when required fields are missing', async () => {
      const mockClient = {
        query: vi.fn(),
        end: vi.fn(),
      };

      await expect(
        insertTrackDirect(
          { title: '', artist_name: 'Artist', audio_url: 'https://r2.dev/a.mp3' },
          { client: mockClient as any }
        )
      ).rejects.toThrow('Track title is required');

      await expect(
        insertTrackDirect(
          { title: 'Title', artist_name: '   ', audio_url: 'https://r2.dev/a.mp3' },
          { client: mockClient as any }
        )
      ).rejects.toThrow('Artist name is required');

      await expect(
        insertTrackDirect(
          { title: 'Title', artist_name: 'Artist', audio_url: '' },
          { client: mockClient as any }
        )
      ).rejects.toThrow('Audio URL is required');
    });

    it('creates and closes own client when databaseUrl is provided', async () => {
      mockPgQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'track-own',
            title: 'Own Track',
            artist_name: 'Artist',
            audio_url: 'https://r2.dev/track.mp3',
            tool_used: 'Suno',
            upvotes_count: 25,
            status: 'approved',
          },
        ],
      });

      const res = await insertTrackDirect(
        { title: 'Own Track', artist_name: 'Artist', audio_url: 'https://r2.dev/track.mp3' },
        { databaseUrl: 'postgres://localhost:5432/db' }
      );

      expect(res.id).toBe('track-own');
      expect(mockPgConnect).toHaveBeenCalled();
      expect(mockPgEnd).toHaveBeenCalled();
    });
  });

  describe('listAllTracksDirect', () => {
    it('queries tracks ordered by creation time with default and custom limits', async () => {
      const mockRows: DirectDbTrackRow[] = [
        {
          id: '1',
          title: 'Track 1',
          artist_name: 'Artist 1',
          audio_url: 'https://r2.dev/1.mp3',
          tool_used: 'Suno',
          upvotes_count: 10,
        },
      ];

      const mockQuery = vi.fn().mockResolvedValue({ rows: mockRows });
      const mockClient = {
        query: mockQuery,
        end: vi.fn().mockResolvedValue(undefined),
      };

      const tracks = await listAllTracksDirect({
        limit: 50,
        client: mockClient as any,
      });

      expect(tracks).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [50]
      );

      // Default limit 200
      await listAllTracksDirect({
        client: mockClient as any,
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [200]
      );
      expect(mockClient.end).not.toHaveBeenCalled();
    });

    it('listAllTracksDirect creates and closes own client when databaseUrl is provided', async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [] });
      await listAllTracksDirect({ databaseUrl: 'postgres://localhost:5432/db' });
      expect(mockPgConnect).toHaveBeenCalled();
      expect(mockPgEnd).toHaveBeenCalled();
    });
  });

  describe('direct queue and request failover queries (Issues #259 & #97)', () => {
    it('fetchTrackByTitleOrLyricsDirect matches on title or lyrics', async () => {
      const mockTrack: DirectDbTrackRow = {
        id: 'track-lyrics-1',
        title: 'Neon Nights',
        artist_name: 'SynthBot',
        audio_url: 'https://r2.dev/track.mp3',
        tool_used: 'Suno',
        upvotes_count: 42,
        lyrics: 'We are dancing in the neon rain tonight',
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [mockTrack] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      // Search by title and lyrics
      const res = await fetchTrackByTitleOrLyricsDirect({
        prompt: 'Neon Nights',
        lyrics: 'neon rain',
        client: mockClient as any,
      });

      expect(res).toEqual(mockTrack);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'approved'"),
        expect.arrayContaining(['%Neon Nights%', '%neon rain%'])
      );
      expect(mockClient.end).not.toHaveBeenCalled();
    });

    it('fetchTrackByTitleOrLyricsDirect falls through when prompt and lyrics query returns empty', async () => {
      const mockTrack: DirectDbTrackRow = {
        id: 'track-lyrics-fallback',
        title: 'Neon Sunset',
        artist_name: 'SynthBot',
        audio_url: 'https://r2.dev/track.mp3',
        tool_used: 'Suno',
        upvotes_count: 40,
        lyrics: 'Glow in the dark',
      };

      // First query (prompt+lyrics) returns empty, second query (lyrics only) returns match
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [mockTrack] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const res = await fetchTrackByTitleOrLyricsDirect({
        prompt: 'Unmatched Prompt',
        lyrics: 'Glow in the dark',
        client: mockClient as any,
      });

      expect(res).toEqual(mockTrack);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockClient.end).not.toHaveBeenCalled();
    });

    it('fetchTrackByTitleOrLyricsDirect searches with lyrics only', async () => {
      const mockTrack: DirectDbTrackRow = {
        id: 'track-lyrics-only',
        title: 'Midnight Sun',
        artist_name: 'SynthBot',
        audio_url: 'https://r2.dev/track.mp3',
        tool_used: 'Suno',
        upvotes_count: 35,
        lyrics: 'Singing under midnight sun',
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [mockTrack] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const res = await fetchTrackByTitleOrLyricsDirect({
        lyrics: 'midnight sun',
        client: mockClient as any,
      });

      expect(res).toEqual(mockTrack);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('lyrics ILIKE $1'),
        ['%midnight sun%']
      );
      expect(mockClient.end).not.toHaveBeenCalled();
    });

    it('fetchTrackByTitleOrLyricsDirect searches with prompt only', async () => {
      const mockTrack: DirectDbTrackRow = {
        id: 'track-prompt-only',
        title: 'Retro Wave',
        artist_name: 'SynthBot',
        audio_url: 'https://r2.dev/track.mp3',
        tool_used: 'Suno',
        upvotes_count: 30,
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [mockTrack] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const res = await fetchTrackByTitleOrLyricsDirect({
        prompt: 'Retro Wave',
        client: mockClient as any,
      });

      expect(res).toEqual(mockTrack);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('(title ILIKE $1 OR description ILIKE $1)'),
        ['%Retro Wave%']
      );
      expect(mockClient.end).not.toHaveBeenCalled();
    });

    it('fetchTrackByTitleOrLyricsDirect falls back to top approved track when neither or nothing matches', async () => {
      const topMock: DirectDbTrackRow = {
        id: 'top-1',
        title: 'Top Track',
        artist_name: 'Top Artist',
        audio_url: 'https://r2.dev/top.mp3',
        tool_used: 'Suno',
        upvotes_count: 100,
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [topMock] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const res = await fetchTrackByTitleOrLyricsDirect({
        client: mockClient as any,
      });
      expect(res).toEqual(topMock);
      expect(mockClient.end).not.toHaveBeenCalled();

      // When fallback returns empty rows
      const emptyClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const nullRes = await fetchTrackByTitleOrLyricsDirect({
        client: emptyClient as any,
      });
      expect(nullRes).toBeNull();
      expect(emptyClient.end).not.toHaveBeenCalled();
    });

    it('fetchTrackByTitleOrLyricsDirect returns null in test env when client and databaseUrl are missing', async () => {
      const res = await fetchTrackByTitleOrLyricsDirect({
        prompt: 'test',
      });
      expect(res).toBeNull();
    });

    it('fetchTrackByTitleOrLyricsDirect creates and closes own client when databaseUrl is provided', async () => {
      mockPgQuery.mockResolvedValueOnce({
        rows: [{ id: 'own-1', title: 'Own Track', artist_name: 'A', audio_url: 'u', tool_used: 'Suno', upvotes_count: 1 }],
      });

      const res = await fetchTrackByTitleOrLyricsDirect({
        prompt: 'Own Track',
        databaseUrl: 'postgres://user:pass@localhost:5432/testdb',
      });

      expect(res?.id).toBe('own-1');
      expect(mockPgConnect).toHaveBeenCalled();
      expect(mockPgEnd).toHaveBeenCalled();
    });

    it('fetchStationStateDirect retrieves active airplay and staged item with custom or default slug', async () => {
      const mockState = {
        channel_slug: 'chill',
        airplay_item: { id: 'track-active', title: 'Active Song', duration_hint_seconds: 200 },
        staged_item: { id: 'track-staged', title: 'Staged Song', duration_hint_seconds: 180 },
        started_at: new Date().toISOString(),
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [mockState] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const state = await fetchStationStateDirect({
        channelSlug: 'chill',
        client: mockClient as any,
      });

      expect(state).toEqual(mockState);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM public.station_state'),
        ['chill']
      );
      expect(mockClient.end).not.toHaveBeenCalled();

      // Default channelSlug ('main') and empty result
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      const defaultState = await fetchStationStateDirect({
        client: mockClient as any,
      });
      expect(defaultState).toBeNull();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM public.station_state'),
        ['main']
      );
      expect(mockClient.end).not.toHaveBeenCalled();
    });

    it('fetchStationStateDirect handles missing client and ownClient lifecycle', async () => {
      const nullRes = await fetchStationStateDirect({});
      expect(nullRes).toBeNull();

      mockPgQuery.mockResolvedValueOnce({
        rows: [{ channel_slug: 'main', airplay_item: {}, started_at: 'now' }],
      });

      const state = await fetchStationStateDirect({
        databaseUrl: 'postgres://localhost:5432/db',
      });
      expect(state?.channel_slug).toBe('main');
      expect(mockPgEnd).toHaveBeenCalled();
    });

    it('countPendingQueueDirect counts unplayed queue items with custom or default slug', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ count: '5' }] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const count = await countPendingQueueDirect({
        channelSlug: 'cyberpunk',
        client: mockClient as any,
      });

      expect(count).toBe(5);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('played_at IS NULL'),
        ['cyberpunk']
      );
      expect(mockClient.end).not.toHaveBeenCalled();

      // Default slug 'main' and empty/invalid count rows
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      const emptyCount = await countPendingQueueDirect({
        client: mockClient as any,
      });
      expect(emptyCount).toBe(0);
      expect(mockClient.end).not.toHaveBeenCalled();

      mockClient.query.mockResolvedValueOnce({ rows: [{ count: null }] });
      const nullCount = await countPendingQueueDirect({
        client: mockClient as any,
      });
      expect(nullCount).toBe(0);
      expect(mockClient.end).not.toHaveBeenCalled();
    });

    it('countPendingQueueDirect handles missing client and ownClient lifecycle', async () => {
      const zeroCount = await countPendingQueueDirect({});
      expect(zeroCount).toBe(0);

      mockPgQuery.mockResolvedValueOnce({ rows: [{ count: '12' }] });
      const res = await countPendingQueueDirect({
        databaseUrl: 'postgres://localhost:5432/db',
      });
      expect(res).toBe(12);
      expect(mockPgEnd).toHaveBeenCalled();
    });

    it('insertChannelQueueDirect inserts queue item directly via postgres', async () => {
      const insertedRow = {
        id: 'queue-direct-123',
        channel_id: 'channel-main-id',
        track_id: 'track-999',
        prompt_used: 'cyber synth',
        requested_by: '@alex.trifan (discord)',
        priority: true,
        created_at: new Date().toISOString(),
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [insertedRow] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const result = await insertChannelQueueDirect({
        channelSlug: 'chill',
        trackId: 'track-999',
        promptUsed: 'cyber synth',
        requestedBy: '@alex.trifan (discord)',
        priority: true,
        client: mockClient as any,
      });

      expect(result).toEqual(insertedRow);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.channel_queue'),
        expect.arrayContaining(['chill', 'track-999', 'cyber synth', '@alex.trifan (discord)', true])
      );
      expect(mockClient.end).not.toHaveBeenCalled();

      // Test default channelSlug and priority: false
      await insertChannelQueueDirect({
        trackId: 'track-888',
        promptUsed: 'default prompt',
        requestedBy: '@user',
        client: mockClient as any,
      });
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.channel_queue'),
        expect.arrayContaining(['main', 'track-888', 'default prompt', '@user', false])
      );
      expect(mockClient.end).not.toHaveBeenCalled();
    });

    it('insertChannelQueueDirect validates client requirement and tests ownClient lifecycle', async () => {
      await expect(
        insertChannelQueueDirect({
          trackId: '1',
          promptUsed: 'test',
          requestedBy: 'user',
        })
      ).rejects.toThrow('Database client or URL must be provided in test environment');

      mockPgQuery.mockResolvedValueOnce({
        rows: [{ id: 'q-own-1', track_id: '1' }],
      });

      const res = await insertChannelQueueDirect({
        trackId: '1',
        promptUsed: 'test',
        requestedBy: 'user',
        databaseUrl: 'postgres://localhost:5432/db',
      });
      expect(res.id).toBe('q-own-1');
      expect(mockPgEnd).toHaveBeenCalled();
    });

    it('insertCommunityRequestDirect logs request directly via postgres including optional lyrics and fallback', async () => {
      const insertedRow = {
        id: 'req-direct-456',
        platform: 'discord',
        platform_user_id: 'user-777',
        platform_user_name: 'alex.trifan',
        type: 'song',
        content: 'cyber synth',
        target: 'track-999',
        batch_id: 'BATCH-23:45',
        status: 'scheduled',
        lyrics: 'neon lights burning bright',
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [insertedRow] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const result = await insertCommunityRequestDirect({
        platform: 'discord',
        platformUserId: 'user-777',
        platformUserName: 'alex.trifan',
        type: 'song',
        content: 'cyber synth',
        target: 'track-999',
        batchId: 'BATCH-23:45',
        status: 'scheduled',
        lyrics: 'neon lights burning bright',
        client: mockClient as any,
      });

      expect(result).toEqual(insertedRow);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.community_requests'),
        expect.arrayContaining([
          'discord',
          'user-777',
          'alex.trifan',
          'song',
          'cyber synth',
          'track-999',
          'BATCH-23:45',
          'scheduled',
          'neon lights burning bright',
        ])
      );
      expect(mockClient.end).not.toHaveBeenCalled();

      // Test minimal params where optionals are null
      const minClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 'req-min-1' }] }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      await insertCommunityRequestDirect({
        platform: 'discord',
        platformUserId: 'u',
        platformUserName: 'n',
        type: 'song',
        content: 'c',
        status: 's',
        client: minClient as any,
      });
      expect(minClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.community_requests'),
        ['discord', 'u', 'n', null, 'song', 'c', null, null, 's', null, null]
      );
      expect(minClient.end).not.toHaveBeenCalled();

      // Test fallback when first insert fails (e.g. column "lyrics" does not exist yet)
      const fallbackRow = {
        ...insertedRow,
        lyrics: undefined,
      };
      const fallbackClient = {
        query: vi
          .fn()
          .mockRejectedValueOnce(new Error('column "lyrics" of relation "community_requests" does not exist'))
          .mockResolvedValueOnce({ rows: [fallbackRow] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const fallbackResult = await insertCommunityRequestDirect({
        platform: 'telegram',
        platformUserId: 'user-888',
        platformUserName: 'telegram.user',
        type: 'song',
        content: 'synth pop',
        status: 'pending',
        client: fallbackClient as any,
      });

      expect(fallbackResult).toEqual(fallbackRow);
      expect(fallbackClient.query).toHaveBeenCalledTimes(2);
      expect(fallbackClient.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO public.community_requests'),
        ['telegram', 'user-888', 'telegram.user', null, 'song', 'synth pop', null, null, 'pending', null]
      );
      expect(fallbackClient.end).not.toHaveBeenCalled();

      // Test fallback when optional fields are present
      const fallbackWithFieldsClient = {
        query: vi
          .fn()
          .mockRejectedValueOnce(new Error('no lyrics column'))
          .mockResolvedValueOnce({ rows: [{ id: 'fb-fields' }] }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      await insertCommunityRequestDirect({
        platform: 'discord',
        platformUserId: 'u-fb',
        platformUserName: 'name-fb',
        platformMessageId: 'msg-fb',
        type: 'song',
        content: 'content-fb',
        target: 'target-fb',
        batchId: 'batch-fb',
        estimatedAirTime: 'time-fb',
        status: 'queued',
        client: fallbackWithFieldsClient as any,
      });
      expect(fallbackWithFieldsClient.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO public.community_requests'),
        ['discord', 'u-fb', 'name-fb', 'msg-fb', 'song', 'content-fb', 'target-fb', 'batch-fb', 'queued', 'time-fb']
      );
      expect(fallbackWithFieldsClient.end).not.toHaveBeenCalled();
    });

    it('insertCommunityRequestDirect validates client requirement and tests ownClient lifecycle', async () => {
      await expect(
        insertCommunityRequestDirect({
          platform: 'discord',
          platformUserId: 'u',
          platformUserName: 'n',
          type: 'song',
          content: 'c',
          status: 's',
        })
      ).rejects.toThrow('Database client or URL must be provided in test environment');

      mockPgQuery.mockResolvedValueOnce({
        rows: [{ id: 'req-own-1', platform: 'discord' }],
      });

      const res = await insertCommunityRequestDirect({
        platform: 'discord',
        platformUserId: 'u',
        platformUserName: 'n',
        type: 'song',
        content: 'c',
        status: 's',
        databaseUrl: 'postgres://localhost:5432/db',
      });
      expect(res.id).toBe('req-own-1');
      expect(mockPgEnd).toHaveBeenCalled();

      // Non-blocking cleanup when end() throws
      mockPgQuery.mockResolvedValueOnce({
        rows: [{ id: 'req-own-2', platform: 'discord' }],
      });
      mockPgEnd.mockRejectedValueOnce(new Error('connection end error'));
      const res2 = await insertCommunityRequestDirect({
        platform: 'discord',
        platformUserId: 'u',
        platformUserName: 'n',
        type: 'song',
        content: 'c',
        status: 's',
        databaseUrl: 'postgres://localhost:5432/db',
      });
      expect(res2.id).toBe('req-own-2');
    });
  });

  describe('incrementTrackUpvotesDirect', () => {
    it('increments track upvotes using direct PostgreSQL client', async () => {
      const mockResult = {
        rows: [{ id: 'track-123', title: 'Cyber Pulse', upvotes_count: 42 }],
      };
      const mockQuery = vi.fn().mockResolvedValue(mockResult);
      const mockClient = {
        query: mockQuery,
        end: vi.fn().mockResolvedValue(undefined),
      };

      const result = await incrementTrackUpvotesDirect('track-123', {
        client: mockClient as any,
      });

      expect(result).toEqual({
        id: 'track-123',
        title: 'Cyber Pulse',
        upvotes_count: 42,
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.tracks'),
        ['track-123']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET upvotes_count = COALESCE(upvotes_count, 0) + 1'),
        ['track-123']
      );
      expect(mockClient.end).not.toHaveBeenCalled();
    });

    it('returns null for empty or non-string trackId', async () => {
      const mockClient = {
        query: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
      };

      expect(await incrementTrackUpvotesDirect('', { client: mockClient as any })).toBeNull();
      expect(await incrementTrackUpvotesDirect('   ', { client: mockClient as any })).toBeNull();
      expect(await incrementTrackUpvotesDirect(null as any, { client: mockClient as any })).toBeNull();
      expect(await incrementTrackUpvotesDirect(12345 as any, { client: mockClient as any })).toBeNull();
      expect(await incrementTrackUpvotesDirect(undefined as any, { client: mockClient as any })).toBeNull();
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('trims leading and trailing whitespace from trackId', async () => {
      const mockQuery = vi.fn().mockResolvedValue({
        rows: [{ id: 'trimmed-id', title: 'Trimmed Song', upvotes_count: 5 }],
      });
      const mockClient = {
        query: mockQuery,
        end: vi.fn().mockResolvedValue(undefined),
      };

      const result = await incrementTrackUpvotesDirect('   trimmed-id   ', {
        client: mockClient as any,
      });

      expect(result).toEqual({ id: 'trimmed-id', title: 'Trimmed Song', upvotes_count: 5 });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id::text = $1'),
        ['trimmed-id']
      );
    });

    it('returns null when track is not found in database', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const mockClient = {
        query: mockQuery,
        end: vi.fn().mockResolvedValue(undefined),
      };

      const result = await incrementTrackUpvotesDirect('non-existent', {
        client: mockClient as any,
      });

      expect(result).toBeNull();
    });

    it('returns null when no client and no databaseUrl is configured in test env', async () => {
      const result = await incrementTrackUpvotesDirect('track-123');
      expect(result).toBeNull();
    });
  });
});
