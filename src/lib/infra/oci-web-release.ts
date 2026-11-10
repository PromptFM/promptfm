export interface OCIWebReleaseRecord {
  releaseId: string;
  createdAt: string;
  active?: boolean;
  releasable?: boolean;
}

function toEpoch(createdAt: string): number {
  const epoch = Date.parse(createdAt);
  return Number.isFinite(epoch) ? epoch : 0;
}

function isReleasable(release: OCIWebReleaseRecord): boolean {
  return release.releasable !== false;
}

function sortReleases(releases: readonly OCIWebReleaseRecord[]): OCIWebReleaseRecord[] {
  return [...releases].sort((left, right) => toEpoch(right.createdAt) - toEpoch(left.createdAt));
}

export function getCurrentRelease(
  releases: readonly OCIWebReleaseRecord[],
): OCIWebReleaseRecord | undefined {
  const currentRelease = releases.find((release) => release.active && isReleasable(release));
  if (currentRelease) {
    return currentRelease;
  }

  return sortReleases(releases).find(isReleasable);
}

export function getPreviousRelease(
  releases: readonly OCIWebReleaseRecord[],
): OCIWebReleaseRecord | undefined {
  const currentRelease = getCurrentRelease(releases);

  return sortReleases(releases).find(
    (release) => isReleasable(release) && release.releaseId !== currentRelease?.releaseId,
  );
}

export function planRetainedReleasePrune(
  releases: readonly OCIWebReleaseRecord[],
  retainedReleaseCount = 1,
): OCIWebReleaseRecord[] {
  const currentRelease = getCurrentRelease(releases);
  const protectedReleaseIds = new Set<string>();

  if (currentRelease) {
    protectedReleaseIds.add(currentRelease.releaseId);
  }

  const retainedPreviousReleases = sortReleases(releases)
    .filter((release) => isReleasable(release) && release.releaseId !== currentRelease?.releaseId)
    .slice(0, Math.max(0, retainedReleaseCount));

  for (const release of retainedPreviousReleases) {
    protectedReleaseIds.add(release.releaseId);
  }

  return sortReleases(releases).filter((release) => !protectedReleaseIds.has(release.releaseId));
}
