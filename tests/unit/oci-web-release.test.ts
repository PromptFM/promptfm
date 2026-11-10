import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  getCurrentRelease,
  getPreviousRelease,
  normalizeRetainedReleaseCount,
  planRetainedReleasePrune,
  type OCIWebReleaseRecord,
} from '../../src/lib/infra/oci-web-release';

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
