// src/lib/player/player-vote.ts
// Player upvote persistence and API reconciliation for the sticky AudioPlayer quick vote control.

export const PLAYER_VOTE_STORAGE_PREFIX = 'promptfm_voted_';

export function getPlayerVoteStorageKey(trackId: string): string {
  return `${PLAYER_VOTE_STORAGE_PREFIX}${trackId}`;
}

export function readPlayerVoteFromStorage(trackId: string, storage?: Storage | null): boolean {
  if (!trackId || !storage) {
    return false;
  }
  try {
    return storage.getItem(getPlayerVoteStorageKey(trackId)) === 'true';
  } catch {
    return false;
  }
}

export function writePlayerVoteToStorage(trackId: string, voted: boolean, storage?: Storage | null): void {
  if (!trackId || !storage) {
    return;
  }
  try {
    const key = getPlayerVoteStorageKey(trackId);
    if (voted) {
      storage.setItem(key, 'true');
    } else {
      storage.removeItem(key);
    }
  } catch {
    // Ignore localStorage restrictions
  }
}

export function applyOptimisticVoteCount(current?: number): number {
  return (current ?? 0) + 1;
}

export function reconcileVoteAfterResponse(input: {
  ok: boolean;
  serverCount?: number;
  previousCount?: number;
  optimisticCount: number;
}): { voted: boolean; upvotesCount: number } {
  if (!input.ok) {
    return {
      voted: false,
      upvotesCount: input.previousCount ?? 0,
    };
  }

  const upvotesCount =
    typeof input.serverCount === 'number' ? input.serverCount : input.optimisticCount;

  return { voted: true, upvotesCount };
}

export async function postPlayerQuickVote(
  trackId: string,
  fetchFn: typeof fetch = fetch
): Promise<{ ok: boolean; upvotes_count?: number }> {
  try {
    const res = await fetchFn('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId }),
    });

    if (!res.ok) {
      return { ok: false };
    }

    const json = (await res.json()) as { upvotes_count?: number };
    return {
      ok: true,
      upvotes_count: json.upvotes_count,
    };
  } catch {
    return { ok: false };
  }
}