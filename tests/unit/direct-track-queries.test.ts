import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  formatPostgresSessionUrl,
  getDirectPostgresDatabaseUrl,
  fetchApprovedTracksDirect,
  fetchTrackByIdOrTitleDirect,
  type DirectDbTrackRow,
} from '../../src/lib/dj/direct-track-queries';

describe('direct track queries module', () => {
  it('formats pooler URLs to use session port 5432', () => {
    const pooler6543 = 'postgres://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';
    expect(formatPostgresSessionUrl(pooler6543)).toBe(
      'postgres://user:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'
    );

    const nonPooler = 'postgres://user:pass@db.example.com:5432/db';
    expect(formatPostgresSessionUrl(nonPooler)).toBe(nonPooler);

    // Fallback string matching
    expect(formatPostgresSessionUrl('invalid-pooler.supabase.com:6543/db')).toBe('invalid-pooler.supabase.com:5432/db');
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
});
