// tests/unit/up-next-library-fill.test.ts
// Issue #219 — library slots in getUpNext respect anti-repeat / distinct rotation picks

import { describe, it, expect } from 'vitest';
import { selectTracksForUpNextLibraryFill } from '@/lib/dj/up-next-library-fill';

const tracks = [
  { id: 't1', title: 'One', upvotes_count: 100 },
  { id: 't2', title: 'Two', upvotes_count: 90 },
  { id: 't3', title: 'Three', upvotes_count: 80 },
  { id: 't4', title: 'Four', upvotes_count: 70 },
];

describe('selectTracksForUpNextLibraryFill (Issue #219)', () => {
  it('returns no picks when maxCount is zero', () => {
    expect(selectTracksForUpNextLibraryFill(tracks, new Set(), [], 0)).toEqual([]);
  });

  it('fills library slots with distinct tracks in vote order when none are excluded', () => {
    const picked = selectTracksForUpNextLibraryFill(tracks, new Set(), [], 3);
    expect(picked.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('skips recently played tracks so the 3rd slot is not stuck on the same headline pick', () => {
    const excluded = new Set(['on-air']);
    const recent = ['t1', 't2'];
    const picked = selectTracksForUpNextLibraryFill(tracks, excluded, recent, 2);
    expect(picked.map((t) => t.id)).toEqual(['t3', 't4']);
    expect(new Set(picked.map((t) => t.id)).size).toBe(picked.length);
  });

  it('relaxes recent exclusion only when additional slots are still needed', () => {
    const excluded = new Set(['on-air']);
    const recent = ['t1', 't2'];
    const picked = selectTracksForUpNextLibraryFill(tracks, excluded, recent, 3);
    expect(picked.map((t) => t.id)).toEqual(['t3', 't4', 't1']);
  });

  it('never returns duplicate ids even when the catalog has duplicate rows', () => {
    const duped = [
      ...tracks,
      { id: 't3', title: 'Three duplicate row', upvotes_count: 79 },
    ];
    const picked = selectTracksForUpNextLibraryFill(duped, new Set(['on-air']), [], 3);
    expect(picked.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('relaxes recent exclusion when the library is too shallow to fill the window', () => {
    const shallow = [tracks[0]!, tracks[1]!];
    const picked = selectTracksForUpNextLibraryFill(shallow, new Set(['on-air']), ['t1', 't2'], 2);
    expect(picked.map((t) => t.id)).toEqual(['t1', 't2']);
  });
});