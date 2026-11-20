// src/lib/library/public-catalog.ts
// Unified public catalog service for PromptFM library browsing, search, and queueing.

import { createAdminClient } from '../supabase/server';
import { fetchApprovedTracksDirect, type MinimalPgClient } from '../dj/direct-track-queries';
import { DEFAULT_PREVIEW_DURATION_SECONDS } from '../audio/preview';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const PUBLIC_PREVIEW_SECONDS = DEFAULT_PREVIEW_DURATION_SECONDS;

export interface CatalogTrackInput {
  id: string;
  title: string;
  artist_name?: string | null;
  audio_url?: string | null;
  tool_used?: string | null;
  status?: string | null;
  upvotes_count?: number | null;
  cover_art_url?: string | null;
  category?: string | null;
  user_id?: string | null;
  lyrics?: string | null;
  description?: string | null;
  rejection_reason?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

export interface PublicCatalogItem {
  id: string;
  title: string;
  artistName: string;
  audioUrl: string;
  toolUsed: string;
  upvotesCount: number;
  coverArtUrl: string | null;
  category: string | null;
  previewSeconds: number;
}

export interface PublicCatalogResponse {
  items: PublicCatalogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  previewSeconds: number;
}

export interface CatalogQuery {
  page: number;
  pageSize: number;
  q: string;
  tool: string;
}

export type QueueBodyParseResult =
  | { ok: true; trackId: string }
  | { ok: false; error: string };

function extractParam(query: unknown, key: string): unknown {
  if (!query || typeof query !== 'object') {
    return undefined;
  }
  if (query instanceof URLSearchParams) {
    return query.get(key) ?? undefined;
  }
  return (query as Record<string, unknown>)[key];
}

export function parseCatalogQuery(queryInput?: unknown): CatalogQuery {
  const rawPage = extractParam(queryInput, 'page');
  const rawPageSize = extractParam(queryInput, 'pageSize');
  const rawQ = extractParam(queryInput, 'q');
  const rawTool = extractParam(queryInput, 'tool');

  let page = 1;
  if (typeof rawPage === 'number' && Number.isFinite(rawPage)) {
    const floored = Math.floor(rawPage);
    page = floored >= 1 ? floored : 1;
  } else if (typeof rawPage === 'string') {
    const parsed = parseInt(rawPage, 10);
    page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  if (typeof rawPageSize === 'number' && Number.isFinite(rawPageSize)) {
    const floored = Math.floor(rawPageSize);
    pageSize = floored > 0 ? Math.min(floored, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  } else if (typeof rawPageSize === 'string') {
    const parsed = parseInt(rawPageSize, 10);
    pageSize = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  }

  const q = typeof rawQ === 'string' ? rawQ.trim() : '';
  const tool = typeof rawTool === 'string' ? rawTool.trim() : '';

  return { page, pageSize, q, tool };
}

export function buildPublicCatalog(
  rows: CatalogTrackInput[],
  queryInput?: unknown
): PublicCatalogResponse {
  const query = parseCatalogQuery(queryInput);
  const qLower = query.q.toLowerCase();
  const toolLower = query.tool.toLowerCase();

  const filtered = rows.filter((row) => {
    if (row.status !== 'approved') {
      return false;
    }
    if (typeof row.id !== 'string' || row.id.trim().length === 0) {
      return false;
    }
    if (typeof row.title !== 'string' || row.title.trim().length === 0) {
      return false;
    }

    if (qLower.length > 0) {
      const titleMatch = (row.title ?? '').toLowerCase().includes(qLower);
      const artistMatch = (row.artist_name ?? '').toLowerCase().includes(qLower);
      if (!titleMatch && !artistMatch) {
        return false;
      }
    }

    if (toolLower.length > 0) {
      const exactTool = (row.tool_used ?? '').trim().toLowerCase();
      if (exactTool !== toolLower) {
        return false;
      }
    }

    return true;
  });

  filtered.sort((a, b) => {
    const votesA = typeof a.upvotes_count === 'number' && Number.isFinite(a.upvotes_count) ? a.upvotes_count : 0;
    const votesB = typeof b.upvotes_count === 'number' && Number.isFinite(b.upvotes_count) ? b.upvotes_count : 0;
    if (votesB !== votesA) {
      return votesB - votesA;
    }
    return (a.title ?? '').localeCompare(b.title ?? '');
  });

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
  const startIndex = (query.page - 1) * query.pageSize;
  const sliced = startIndex < total ? filtered.slice(startIndex, startIndex + query.pageSize) : [];
  const hasNext = query.page < totalPages;

  const items: PublicCatalogItem[] = sliced.map((row) => ({
    id: row.id.trim(),
    title: row.title.trim(),
    artistName: typeof row.artist_name === 'string' ? row.artist_name : '',
    audioUrl: typeof row.audio_url === 'string' ? row.audio_url : '',
    toolUsed: typeof row.tool_used === 'string' ? row.tool_used : '',
    upvotesCount: typeof row.upvotes_count === 'number' && Number.isFinite(row.upvotes_count) ? row.upvotes_count : 0,
    coverArtUrl: typeof row.cover_art_url === 'string' && row.cover_art_url.trim().length > 0 ? row.cover_art_url : null,
    category: typeof row.category === 'string' && row.category.trim().length > 0 ? row.category : null,
    previewSeconds: PUBLIC_PREVIEW_SECONDS,
  }));

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    hasNext,
    previewSeconds: PUBLIC_PREVIEW_SECONDS,
  };
}

export function parseLibraryQueueBody(body: unknown): QueueBodyParseResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'A valid track ID is required.' };
  }

  const trackId = (body as Record<string, unknown>).trackId;
  if (typeof trackId !== 'string' || trackId.trim().length === 0) {
    return { ok: false, error: 'A valid track ID is required.' };
  }

  return { ok: true, trackId: trackId.trim() };
}

export async function fetchApprovedCatalogTracks(
  options: {
    client?: MinimalPgClient;
    databaseUrl?: string;
  } = {}
): Promise<CatalogTrackInput[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('tracks')
      .select('id, title, artist_name, audio_url, tool_used, status, upvotes_count, cover_art_url, category')
      .eq('status', 'approved')
      .order('upvotes_count', { ascending: false });

    if (!error && data && data.length > 0) {
      return data as CatalogTrackInput[];
    }
  } catch {
    // Fail over to direct PostgreSQL
  }

  try {
    const directRows = await fetchApprovedTracksDirect(options);
    return directRows.map((row) => ({
      ...row,
      status: 'approved',
    })) as CatalogTrackInput[];
  } catch {
    return [];
  }
}
