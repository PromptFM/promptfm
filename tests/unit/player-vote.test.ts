import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PLAYER_VOTE_STORAGE_PREFIX,
  getPlayerVoteStorageKey,
  readPlayerVoteFromStorage,
  writePlayerVoteToStorage,
  applyOptimisticVoteCount,
  reconcileVoteAfterResponse,
  postPlayerQuickVote,
} from '@/lib/player/player-vote';

describe('Issue #190: player quick vote persistence', () => {
  const trackId = 'track-abc-123';
  let storage: Storage;

  beforeEach(() => {
    const map = new Map<string, string>();
    storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it('builds a stable localStorage key per track id', () => {
    expect(getPlayerVoteStorageKey(trackId)).toBe(`${PLAYER_VOTE_STORAGE_PREFIX}${trackId}`);
  });

  it('reads false when no vote was stored for the track', () => {
    expect(readPlayerVoteFromStorage(trackId, storage)).toBe(false);
  });

  it('reads true only when the stored flag is exactly "true"', () => {
    writePlayerVoteToStorage(trackId, true, storage);
    expect(readPlayerVoteFromStorage(trackId, storage)).toBe(true);

    storage.setItem(getPlayerVoteStorageKey(trackId), '1');
    expect(readPlayerVoteFromStorage(trackId, storage)).toBe(false);
  });

  it('removes the storage entry when clearing a vote after a failed request', () => {
    writePlayerVoteToStorage(trackId, true, storage);
    writePlayerVoteToStorage(trackId, false, storage);
    expect(readPlayerVoteFromStorage(trackId, storage)).toBe(false);
  });

  it('increments the optimistic upvote count by one', () => {
    expect(applyOptimisticVoteCount(12)).toBe(13);
    expect(applyOptimisticVoteCount(undefined)).toBe(1);
  });

  it('keeps voted=false and restores the previous count when the API response is not ok', () => {
    const result = reconcileVoteAfterResponse({
      ok: false,
      previousCount: 20,
      optimisticCount: 21,
    });

    expect(result).toEqual({ voted: false, upvotesCount: 20 });
  });

  it('persists voted=true and prefers the server count when the API succeeds', () => {
    const result = reconcileVoteAfterResponse({
      ok: true,
      serverCount: 44,
      previousCount: 20,
      optimisticCount: 21,
    });

    expect(result).toEqual({ voted: true, upvotesCount: 44 });
  });

  it('falls back to the optimistic count when the API omits upvotes_count', () => {
    const result = reconcileVoteAfterResponse({
      ok: true,
      previousCount: 9,
      optimisticCount: 10,
    });

    expect(result).toEqual({ voted: true, upvotesCount: 10 });
  });

  it('posts to /api/vote and surfaces ok=false on non-2xx without throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'db down' }),
    });

    const result = await postPlayerQuickVote(trackId, fetchMock as unknown as typeof fetch);

    expect(result).toEqual({ ok: false });
    expect(fetchMock).toHaveBeenCalledWith('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId }),
    });
  });

  it('returns the server upvote count when the vote request succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, upvotes_count: 27 }),
    });

    const result = await postPlayerQuickVote(trackId, fetchMock as unknown as typeof fetch);

    expect(result).toEqual({ ok: true, upvotes_count: 27 });
  });

  it('returns ok=false when fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

    const result = await postPlayerQuickVote(trackId, fetchMock as unknown as typeof fetch);

    expect(result).toEqual({ ok: false });
  });
});