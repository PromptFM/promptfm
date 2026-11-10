import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  getCurrentRelease,
  getPreviousRelease,
  normalizeRetainedReleaseCount,
  planRetainedReleasePrune,
  type OCIWebReleaseRecord,
} from '@/lib/infra/oci-web-release';

describe('OCI web release retention helper', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const helperPath = path.join(rootDir, 'src/lib/infra/oci-web-release.ts');
  const release = (
    releaseId: string,
    createdAt: string,
    overrides: Partial<OCIWebReleaseRecord> = {},
  ): OCIWebReleaseRecord => ({
    releaseId,
    createdAt,
    releasable: true,
    ...overrides,
  });

  it('exists so release and rollback can share deterministic retained-release logic', () => {
    expect(fs.existsSync(helperPath)).toBe(true);
  });

  it('defines helpers for current release lookup, previous release selection, and prune planning', () => {
    expect(fs.existsSync(helperPath)).toBe(true);
    if (!fs.existsSync(helperPath)) {
      return;
    }

    const content = fs.readFileSync(helperPath, 'utf8');
    expect(content).toMatch(/current.*release|release.*current/i);
    expect(content).toMatch(/previous.*release|release.*previous/i);
    expect(content).toMatch(/prune|retain/i);
  });

  it('prefers the active releasable release as current', () => {
    const releases = [
      release('older', '2026-11-01T10:00:00.000Z'),
      release('active-now', '2026-11-03T10:00:00.000Z', { active: true }),
      release('newer-inactive', '2026-11-04T10:00:00.000Z'),
    ];

    expect(getCurrentRelease(releases)?.releaseId).toBe('active-now');
  });

  it('falls back to the newest releasable release when no active release exists', () => {
    const releases = [
      release('newest-bad', '2026-11-05T10:00:00.000Z', { releasable: false }),
      release('candidate', '2026-11-04T10:00:00.000Z'),
      release('older', '2026-11-03T10:00:00.000Z'),
    ];

    expect(getCurrentRelease(releases)?.releaseId).toBe('candidate');
  });

  it('selects the newest releasable non-current release as previous', () => {
    const releases = [
      release('current', '2026-11-05T10:00:00.000Z', { active: true }),
      release('bad-previous', '2026-11-04T10:00:00.000Z', { releasable: false }),
      release('previous', '2026-11-03T10:00:00.000Z'),
      release('oldest', '2026-11-02T10:00:00.000Z'),
    ];

    expect(getPreviousRelease(releases)?.releaseId).toBe('previous');
  });

  it('prunes only releases outside the current plus retained previous window', () => {
    const releases = [
      release('current', '2026-11-05T10:00:00.000Z', { active: true }),
      release('retain-me', '2026-11-04T10:00:00.000Z'),
      release('prune-me', '2026-11-03T10:00:00.000Z'),
      release('not-releasable', '2026-11-02T10:00:00.000Z', { releasable: false }),
    ];

    expect(planRetainedReleasePrune(releases, 1).map((entry) => entry.releaseId)).toEqual([
      'prune-me',
      'not-releasable',
    ]);
  });

  it('still retains one previous release when asked to retain zero', () => {
    const releases = [
      release('current', '2026-11-05T10:00:00.000Z', { active: true }),
      release('previous', '2026-11-04T10:00:00.000Z'),
      release('older', '2026-11-03T10:00:00.000Z'),
    ];

    expect(planRetainedReleasePrune(releases, 0).map((entry) => entry.releaseId)).toEqual([
      'older',
    ]);
  });

  it('treats the active release as current even when it is not releasable, so prune protection cannot delete it', () => {
    const releases = [
      release('release-2026-01', '2026-01-01T00:00:00Z'),
      release('release-2026-02', '2026-02-01T00:00:00Z'),
      release('release-2026-03', '2026-03-01T00:00:00Z', { active: true, releasable: false }),
    ];

    expect(getCurrentRelease(releases)?.releaseId).toBe('release-2026-03');
    expect(getPreviousRelease(releases)?.releaseId).toBe('release-2026-02');
  });

  it('normalizes retained previous release count so deploys keep at least one immediately-usable rollback target', () => {
    expect(normalizeRetainedReleaseCount()).toBe(1);
    expect(normalizeRetainedReleaseCount(0)).toBe(1);
    expect(normalizeRetainedReleaseCount(-5)).toBe(1);
    expect(normalizeRetainedReleaseCount(2.8)).toBe(2);
  });

  it('never prunes the active release and still keeps one releasable previous release even if asked to retain zero', () => {
    const releases = [
      release('release-2026-01', '2026-01-01T00:00:00Z'),
      release('release-2026-02', '2026-02-01T00:00:00Z'),
      release('release-2026-03', '2026-03-01T00:00:00Z', { active: true, releasable: false }),
    ];

    const prunePlan = planRetainedReleasePrune(releases, 0);

    expect(prunePlan.map((entry) => entry.releaseId)).toEqual(['release-2026-01']);
  });
});
