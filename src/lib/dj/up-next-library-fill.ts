// src/lib/dj/up-next-library-fill.ts
// Picks distinct library tracks for Up Next preview slots with anti-repeat awareness (Issue #219).

export function selectTracksForUpNextLibraryFill<T extends { id: string }>(
  orderedTracks: T[],
  excludedIds: Set<string>,
  recentIds: string[],
  maxCount: number
): T[] {
  if (maxCount <= 0) return [];

  const selected: T[] = [];
  const seen = new Set<string>();

  const pickFrom = (blockRecent: boolean): void => {
    const blocked = new Set(excludedIds);
    if (blockRecent) {
      for (const id of recentIds) {
        blocked.add(id);
      }
    }
    for (const track of orderedTracks) {
      if (selected.length >= maxCount) {
        break;
      }
      if (blocked.has(track.id) || seen.has(track.id)) {
        continue;
      }
      selected.push(track);
      seen.add(track.id);
      blocked.add(track.id);
    }
  };

  pickFrom(true);

  if (selected.length < maxCount) {
    pickFrom(false);
  }

  return selected;
}