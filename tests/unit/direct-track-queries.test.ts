import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  formatPostgresSessionUrl,
  isSupabasePoolerHost,
  getDirectPostgresDatabaseUrl,
  fetchApprovedTracksDirect,
  fetchTrackByIdOrTitleDirect,
  insertTrackDirect,
  listAllTracksDirect,
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
    });
  });
});
