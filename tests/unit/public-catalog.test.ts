import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PUBLIC_PREVIEW_SECONDS,
  buildPublicCatalog,
  parseCatalogQuery,
  parseLibraryQueueBody,
  fetchApprovedCatalogTracks,
  type CatalogTrackInput,
} from '@/lib/library/public-catalog';
import * as supabaseServer from '@/lib/supabase/server';

function track(overrides: Partial<CatalogTrackInput> = {}): CatalogTrackInput {
  return {
    id: 'track-1',
    title: 'Aurora Drift',
    artist_name: 'Nova',
    audio_url: 'https://cdn.example/aurora.mp3',
    tool_used: 'Suno',
    status: 'approved',
    upvotes_count: 4,
    cover_art_url: 'https://cdn.example/aurora.jpg',
    category: 'Synthwave & Electro',
    user_id: 'user-secret',
    lyrics: 'private lyrics',
    description: 'private description',
    rejection_reason: 'nope',
    email: 'listener@example.com',
    ...overrides,
  };
}

describe('public catalog query parsing', () => {
  it('uses page 1 and the default page size when the query is empty', () => {
    expect(parseCatalogQuery(null)).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, q: '', tool: '' });
    expect(parseCatalogQuery('string')).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, q: '', tool: '' });
    expect(parseCatalogQuery(new URLSearchParams('page=3&pageSize=15&q=synth&tool=Udio'))).toEqual({
      page: 3,
      pageSize: 15,
      q: 'synth',
      tool: 'Udio',
    });
    expect(parseCatalogQuery(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      q: '',
      tool: '',
    });
  });

  it('floors numeric pages and clamps invalid pages to 1', () => {
    expect(parseCatalogQuery({ page: 2.2 }).page).toBe(2);
    expect(parseCatalogQuery({ page: 1.9 }).page).toBe(1);
    expect(parseCatalogQuery({ page: '3' }).page).toBe(3);
    expect(parseCatalogQuery({ page: 0 }).page).toBe(1);
    expect(parseCatalogQuery({ page: -4 }).page).toBe(1);
    expect(parseCatalogQuery({ page: 'abc' }).page).toBe(1);
    expect(parseCatalogQuery({ page: true }).page).toBe(1);
    expect(parseCatalogQuery({ page: null }).page).toBe(1);
  });

  it('clamps page size between 1 and 50', () => {
    expect(parseCatalogQuery({ pageSize: 50 }).pageSize).toBe(50);
    expect(parseCatalogQuery({ pageSize: 50.9 }).pageSize).toBe(50);
    expect(parseCatalogQuery({ pageSize: 51 }).pageSize).toBe(50);
    expect(parseCatalogQuery({ pageSize: '20' }).pageSize).toBe(20);
    expect(parseCatalogQuery({ pageSize: 0 }).pageSize).toBe(20);
    expect(parseCatalogQuery({ pageSize: -3 }).pageSize).toBe(20);
    expect(parseCatalogQuery({ pageSize: '0' }).pageSize).toBe(20);
    expect(parseCatalogQuery({ pageSize: '' }).pageSize).toBe(20);
    expect(parseCatalogQuery({ pageSize: 'nope' }).pageSize).toBe(20);
  });

  it('trims text filters and ignores non-strings', () => {
    expect(parseCatalogQuery({ q: '  neon  ', tool: ' Suno ' })).toMatchObject({ q: 'neon', tool: 'Suno' });
    expect(parseCatalogQuery({ q: 12, tool: { name: 'Suno' } })).toMatchObject({ q: '', tool: '' });
  });
});

describe('buildPublicCatalog', () => {
  it('returns only public fields for approved tracks and a 15 second preview', () => {
    const page = buildPublicCatalog([track()], {});
    expect(page.previewSeconds).toBe(15);
    expect(page.total).toBe(1);
    expect(page.totalPages).toBe(1);
    expect(page.hasNext).toBe(false);
    expect(page.items).toEqual([
      {
        id: 'track-1',
        title: 'Aurora Drift',
        artistName: 'Nova',
        audioUrl: 'https://cdn.example/aurora.mp3',
        toolUsed: 'Suno',
        upvotesCount: 4,
        coverArtUrl: 'https://cdn.example/aurora.jpg',
        category: 'Synthwave & Electro',
        previewSeconds: 15,
      },
    ]);
    expect(Object.keys(page.items[0] ?? {}).sort()).toEqual([
      'artistName',
      'audioUrl',
      'category',
      'coverArtUrl',
      'id',
      'previewSeconds',
      'title',
      'toolUsed',
      'upvotesCount',
    ]);
    expect(JSON.stringify(page.items[0])).not.toMatch(/user-secret|private lyrics|listener@example.com|rejection/);
  });

  it('drops unapproved, untitled, and id-less rows', () => {
    const page = buildPublicCatalog(
      [
        track({ id: 'ok', title: 'Kept', status: 'approved' }),
        track({ id: 'pend', status: 'pending' }),
        track({ id: 'rej', status: 'rejected' }),
        track({ id: 'cap', status: 'Approved' }),
        track({ id: 'blank', title: '   ' }),
        track({ id: '   ', title: 'No Id' }),
        track({ id: 'missing-title', title: '' }),
      ],
      {},
    );
    expect(page.items.map((item) => item.id)).toEqual(['ok']);
    expect(page.total).toBe(1);
  });

  it('filters by title or artist and by exact tool, then sorts by votes and title', () => {
    const rows = [
      track({ id: 'a', title: 'Bravo', artist_name: 'Ann', upvotes_count: 2, tool_used: 'Udio' }),
      track({ id: 'b', title: 'Alpha', artist_name: 'Ann', upvotes_count: 2, tool_used: 'Suno' }),
      track({ id: 'c', title: 'Night Drive', artist_name: 'Nova', upvotes_count: 9, tool_used: 'Suno' }),
      track({ id: 'd', title: 'Other', artist_name: 'Midnight Nova', upvotes_count: 1, tool_used: 'Stable Audio' }),
    ];

    const byArtist = buildPublicCatalog(rows, { q: 'nova' });
    expect(byArtist.items.map((item) => item.id)).toEqual(['c', 'd']);

    const byTool = buildPublicCatalog(rows, { tool: 'suno' });
    expect(byTool.items.map((item) => item.id)).toEqual(['c', 'b']);

    const partialTool = buildPublicCatalog(rows, { tool: 'sun' });
    expect(partialTool.total).toBe(0);
    expect(partialTool.totalPages).toBe(0);
    expect(partialTool.hasNext).toBe(false);
    expect(partialTool.items).toEqual([]);
  });

  it('pages past the top 20 and reports whether another page exists', () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      track({
        id: `t-${index + 1}`,
        title: `Track ${String(index + 1).padStart(2, '0')}`,
        upvotes_count: 100 - index,
        user_id: `secret-${index}`,
      }),
    );

    const first = buildPublicCatalog(rows, { page: 1, pageSize: 20 });
    expect(first.items).toHaveLength(20);
    expect(first.total).toBe(25);
    expect(first.totalPages).toBe(2);
    expect(first.hasNext).toBe(true);
    expect(first.items[0]?.id).toBe('t-1');
    expect(first.items.some((item) => item.title === 'Track 25')).toBe(false);

    const second = buildPublicCatalog(rows, { page: 2, pageSize: 20 });
    expect(second.items.map((item) => item.title)).toEqual([
      'Track 21',
      'Track 22',
      'Track 23',
      'Track 24',
      'Track 25',
    ]);
    expect(second.hasNext).toBe(false);

    const past = buildPublicCatalog(rows, { page: 9, pageSize: 20 });
    expect(past.items).toEqual([]);
    expect(past.total).toBe(25);
    expect(past.totalPages).toBe(2);
    expect(past.hasNext).toBe(false);

    const exact = buildPublicCatalog(rows.slice(0, 20), { page: 1, pageSize: 20 });
    expect(exact.hasNext).toBe(false);
    expect(exact.totalPages).toBe(1);
  });

  it('uses null for missing or whitespace cover art and category, and handles missing/invalid types', () => {
    const page = buildPublicCatalog(
      [
        track({ cover_art_url: undefined, category: undefined, artist_name: '', audio_url: '', tool_used: '', upvotes_count: 0 }),
        track({ id: 't2', cover_art_url: '   ', category: '   ', artist_name: null, audio_url: null, tool_used: null, upvotes_count: NaN }),
        track({ id: 't3', cover_art_url: null, category: null, artist_name: undefined, audio_url: undefined, tool_used: undefined, upvotes_count: Infinity }),
      ],
      {},
    );
    expect(page.items[0]).toMatchObject({
      artistName: '',
      audioUrl: '',
      toolUsed: '',
      upvotesCount: 0,
      coverArtUrl: null,
      category: null,
    });
    expect(page.items[1]).toMatchObject({
      artistName: '',
      audioUrl: '',
      toolUsed: '',
      upvotesCount: 0,
      coverArtUrl: null,
      category: null,
    });
    expect(page.items[2]).toMatchObject({
      artistName: '',
      audioUrl: '',
      toolUsed: '',
      upvotesCount: 0,
      coverArtUrl: null,
      category: null,
    });
  });
});

describe('fetchApprovedCatalogTracks', () => {
  it('returns rows on success and checks select and order parameters', async () => {
    const mockData = [
      { id: '1', title: 'T1', status: 'approved' },
      { id: '2', title: 'T2', status: 'approved' },
    ];
    const orderMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.spyOn(supabaseServer, 'createAdminClient').mockReturnValue({ from: fromMock } as any);

    const rows = await fetchApprovedCatalogTracks();
    expect(rows).toEqual(mockData);
    expect(fromMock).toHaveBeenCalledWith('tracks');
    expect(selectMock).toHaveBeenCalledWith('id, title, artist_name, audio_url, tool_used, status, upvotes_count, cover_art_url, category');
    expect(eqMock).toHaveBeenCalledWith('status', 'approved');
    expect(orderMock).toHaveBeenCalledWith('upvotes_count', { ascending: false });
  });

  it('returns empty array when supabase returns error even if data is non-null', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: { message: 'db error' } });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.spyOn(supabaseServer, 'createAdminClient').mockReturnValue({ from: fromMock } as any);

    const rows = await fetchApprovedCatalogTracks();
    expect(rows).toEqual([]);
  });

  it('returns empty array when supabase returns error or null data', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.spyOn(supabaseServer, 'createAdminClient').mockReturnValue({ from: fromMock } as any);

    const rows = await fetchApprovedCatalogTracks();
    expect(rows).toEqual([]);
  });

  it('returns empty array when query throws', async () => {
    vi.spyOn(supabaseServer, 'createAdminClient').mockImplementation(() => {
      throw new Error('connection fail');
    });

    const rows = await fetchApprovedCatalogTracks();
    expect(rows).toEqual([]);
  });
});

describe('parseLibraryQueueBody', () => {
  it('accepts a trimmed track id', () => {
    expect(parseLibraryQueueBody({ trackId: '  abc-1  ' })).toEqual({ ok: true, trackId: 'abc-1' });
  });

  it('rejects empty or non-object bodies', () => {
    for (const body of [null, undefined, [], 'abc', 4, { trackId: '' }, { trackId: '   ' }, { trackId: 9 }, {}]) {
      const result = parseLibraryQueueBody(body);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/track id/i);
      }
    }
  });
});
