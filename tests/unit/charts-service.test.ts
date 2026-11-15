// tests/unit/charts-service.test.ts
// Unit tests for charts service with Supabase PostgREST and direct PostgreSQL failover

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as supabaseServer from '@/lib/supabase/server';
import * as directTrackQueries from '@/lib/dj/direct-track-queries';
import { fetchTopApprovedTracks } from '@/lib/charts/charts-service';

describe('fetchTopApprovedTracks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns top tracks from Supabase when query succeeds', async () => {
    const mockData = [
      { id: 'track-1', title: 'Song 1', upvotes_count: 50, status: 'approved' },
      { id: 'track-2', title: 'Song 2', upvotes_count: 40, status: 'approved' },
    ];
    const limitMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.spyOn(supabaseServer, 'createAdminClient').mockReturnValue({ from: fromMock } as any);

    const result = await fetchTopApprovedTracks({ limit: 20 });
    expect(result).toHaveLength(2);
    expect(result[0]?.title).toBe('Song 1');
    expect(fromMock).toHaveBeenCalledWith('tracks');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('status', 'approved');
    expect(orderMock).toHaveBeenCalledWith('upvotes_count', { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(20);
  });

  it('defaults invalid, zero, or negative limit to 20', async () => {
    const limitMock = vi.fn().mockResolvedValue({ data: [{ id: 't1' }], error: null });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.spyOn(supabaseServer, 'createAdminClient').mockReturnValue({ from: fromMock } as any);

    await fetchTopApprovedTracks({ limit: 0 });
    expect(limitMock).toHaveBeenCalledWith(20);

    await fetchTopApprovedTracks({ limit: -5 });
    expect(limitMock).toHaveBeenCalledWith(20);

    await fetchTopApprovedTracks({ limit: 'invalid' as any });
    expect(limitMock).toHaveBeenCalledWith(20);

    await fetchTopApprovedTracks({});
    expect(limitMock).toHaveBeenCalledWith(20);
  });

  it('fails over to direct PostgreSQL when Supabase returns error even with data present', async () => {
    const limitMock = vi.fn().mockResolvedValue({
      data: [{ id: 'stale-1' }],
      error: { message: 'exceed_cached_egress_quota' },
    });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.spyOn(supabaseServer, 'createAdminClient').mockReturnValue({ from: fromMock } as any);

    const directRows: directTrackQueries.DirectDbTrackRow[] = [
      {
        id: 'direct-t1',
        title: 'Direct Anthem',
        artist_name: 'AI Composer',
        audio_url: 'https://r2.dev/direct.mp3',
        tool_used: 'Suno',
        upvotes_count: 99,
      },
    ];
    const directSpy = vi.spyOn(directTrackQueries, 'fetchApprovedTracksDirect').mockResolvedValue(directRows);

    const result = await fetchTopApprovedTracks({ limit: 10 });
    expect(directSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('direct-t1');
  });

  it('fails over to direct PostgreSQL when Supabase returns empty data', async () => {
    const limitMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.spyOn(supabaseServer, 'createAdminClient').mockReturnValue({ from: fromMock } as any);

    const directRows: directTrackQueries.DirectDbTrackRow[] = [
      {
        id: 'direct-empty-fallback',
        title: 'Fallback Song',
        artist_name: 'Direct',
        audio_url: 'https://r2.dev/fallback.mp3',
        tool_used: '',
        upvotes_count: 10,
        category: null,
        is_explicit: true,
        family_friendly: false,
      },
    ];
    vi.spyOn(directTrackQueries, 'fetchApprovedTracksDirect').mockResolvedValue(directRows);

    const result = await fetchTopApprovedTracks();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('direct-empty-fallback');
    expect(result[0]?.tool_used).toBe('Suno');
    expect(result[0]?.category).toBeUndefined();
    expect(result[0]?.is_explicit).toBe(true);
    expect(result[0]?.family_friendly).toBe(false);
  });

  it('fails over to direct PostgreSQL when Supabase returns 402 or error', async () => {
    const limitMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'exceed_cached_egress_quota' },
    });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.spyOn(supabaseServer, 'createAdminClient').mockReturnValue({ from: fromMock } as any);

    const directRows: directTrackQueries.DirectDbTrackRow[] = [
      {
        id: 'direct-t1',
        title: 'Direct Anthem',
        artist_name: 'AI Composer',
        audio_url: 'https://r2.dev/direct.mp3',
        tool_used: 'Suno',
        upvotes_count: 99,
      },
    ];
    const directSpy = vi.spyOn(directTrackQueries, 'fetchApprovedTracksDirect').mockResolvedValue(directRows);

    const result = await fetchTopApprovedTracks({ limit: 10 });
    expect(directSpy).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('direct-t1');
    expect(result[0]?.title).toBe('Direct Anthem');
    expect(result[0]?.status).toBe('approved');
  });

  it('fails over to direct PostgreSQL when Supabase query throws', async () => {
    vi.spyOn(supabaseServer, 'createAdminClient').mockImplementation(() => {
      throw new Error('Supabase gateway down');
    });

    const directRows: directTrackQueries.DirectDbTrackRow[] = [
      {
        id: 'direct-t2',
        title: 'Direct Anthem 2',
        artist_name: 'AI Composer',
        audio_url: 'https://r2.dev/direct2.mp3',
        tool_used: 'Udio',
        upvotes_count: 88,
      },
    ];
    vi.spyOn(directTrackQueries, 'fetchApprovedTracksDirect').mockResolvedValue(directRows);

    const result = await fetchTopApprovedTracks();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('direct-t2');
  });

  it('returns empty array when both Supabase and direct PostgreSQL fail', async () => {
    vi.spyOn(supabaseServer, 'createAdminClient').mockImplementation(() => {
      throw new Error('Supabase gateway down');
    });
    vi.spyOn(directTrackQueries, 'fetchApprovedTracksDirect').mockResolvedValue([]);

    const result = await fetchTopApprovedTracks();
    expect(result).toEqual([]);
  });
});
