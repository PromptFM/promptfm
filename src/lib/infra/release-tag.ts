// src/lib/infra/release-tag.ts
// Formatters and token resolvers for PromptFM release, rollback, and git tags.

import { execSync } from 'child_process';
import fs from 'fs';

/**
 * Formats a standardized release tag in the format promptfm/<version>-<short_hash>
 */
export function formatReleaseTag(version: string, commitSha: string): string {
  const trimmedVersion = version.trim();
  if (!trimmedVersion) {
    throw new Error('Version cannot be empty');
  }

  const trimmedSha = commitSha.trim();
  if (!trimmedSha) {
    throw new Error('Commit SHA cannot be empty');
  }

  if (trimmedSha.length < 7) {
    throw new Error('Commit SHA must be at least 7 characters');
  }

  // Strip leading 'v' or 'v.' if provided (e.g., v1.0.0 -> 1.0.0)
  const cleanVersion = trimmedVersion.replace(/^v/i, '');
  const shortSha = trimmedSha.slice(0, 7);

  return `promptfm/${cleanVersion}-${shortSha}`;
}

/**
 * Formats a standardized rollback tag:
 * - promptfm/rollback-<sha> if given a commit sha
 * - promptfm/rollback-<version> if given a release tag or semantic version
 */
export function formatRollbackTag(targetRef: string): string {
  const trimmed = targetRef.trim();
  if (!trimmed) {
    throw new Error('Rollback reference cannot be empty');
  }

  // Check if target is a hex commit SHA (7 to 40 characters)
  const isCommitSha = /^[0-9a-f]{7,40}$/i.test(trimmed);
  if (isCommitSha) {
    return `promptfm/rollback-${trimmed.slice(0, 7)}`;
  }

  // If target is a tag like promptfm/0.1.0-abc1234 or promptfm/v1.0.0
  let version = trimmed.replace(/^promptfm\//i, '');
  // Strip leading 'v' if present
  version = version.replace(/^v/i, '');

  return `promptfm/rollback-${version}`;
}

/**
 * Formats a standardized infrastructure rollback tag:
 * - promptfm-infra/rollback-<sha> if given a commit sha
 * - promptfm-infra/rollback-<version> if given a release tag or semantic version
 */
export function formatInfraRollbackTag(targetRef: string): string {
  const trimmed = targetRef.trim();
  if (!trimmed) {
    throw new Error('Rollback reference cannot be empty');
  }

  const isCommitSha = /^[0-9a-f]{7,40}$/i.test(trimmed);
  if (isCommitSha) {
    return `promptfm-infra/rollback-${trimmed.slice(0, 7)}`;
  }

  let version = trimmed.replace(/^promptfm-infra\//i, '');
  version = version.replace(/^v/i, '');

  return `promptfm-infra/rollback-${version}`;
}

/**
 * Formats a standardized SQL migration rollback tag:
 * - promptfm-sql/rollback-<sha> if given a commit sha
 * - promptfm-sql/rollback-<version> if given a migration version or release tag
 */
export function formatSqlRollbackTag(targetRef: string): string {
  const trimmed = targetRef.trim();
  if (!trimmed) {
    throw new Error('Rollback reference cannot be empty');
  }

  const isCommitSha = /^[0-9a-f]{7,40}$/i.test(trimmed);
  if (isCommitSha) {
    return `promptfm-sql/rollback-${trimmed.slice(0, 7)}`;
  }

  let version = trimmed.replace(/^promptfm-sql\//i, '');
  version = version.replace(/^v/i, '');

  return `promptfm-sql/rollback-${version}`;
}

/**
 * Formats a standardized SQL migration tag: promptfm-sql/<version>-<short_hash>
 */
export function formatSqlTag(version: string, commitSha: string): string {
  const trimmedVersion = version.trim();
  if (!trimmedVersion) {
    throw new Error('Version cannot be empty');
  }

  const trimmedSha = commitSha.trim();
  if (!trimmedSha) {
    throw new Error('Commit SHA cannot be empty');
  }

  const cleanVersion = trimmedVersion.replace(/^v/i, '');
  const shortSha = trimmedSha.slice(0, 7);

  return `promptfm-sql/${cleanVersion}-${shortSha}`;
}

/**
 * Formats a standardized infrastructure tag: promptfm-infra/<version>-<short_hash>
 */
export function formatInfraTag(version: string, commitSha: string): string {
  const trimmedVersion = version.trim();
  if (!trimmedVersion) {
    throw new Error('Version cannot be empty');
  }

  const trimmedSha = commitSha.trim();
  if (!trimmedSha) {
    throw new Error('Commit SHA cannot be empty');
  }

  const cleanVersion = trimmedVersion.replace(/^v/i, '');
  const shortSha = trimmedSha.slice(0, 7);

  return `promptfm-infra/${cleanVersion}-${shortSha}`;
}

/**
 * Extracts a GitHub token embedded in a git remote URL (e.g. from `git remote -v`).
 * Supports https://user:token@github.com/... or https://token@github.com/...
 */
export function extractGhTokenFromRemote(remoteUrl: string): string | null {
  if (!remoteUrl || typeof remoteUrl !== 'string') {
    return null;
  }

  // Match https://[username:]<token>@github.com/
  const match = remoteUrl.match(/https:\/\/(?:[^:@/]+:)?([a-zA-Z0-9_]{10,})@github\.com/);
  if (match?.[1]) {
    return match[1];
  }

  return null;
}

export interface ResolveGitHubTokenOptions {
  envToken?: string;
  remoteUrl?: string;
  env?: Record<string, string | undefined>;
}

/**
 * Resolves a GitHub token, checking explicit options first,
 * then falling back to extracting the token from git remote URL,
 * and finally checking process.env.
 */
export function resolveGitHubToken(options?: ResolveGitHubTokenOptions): string | null {
  if (options?.envToken !== undefined && options.envToken.trim() !== '') {
    return options.envToken.trim();
  }

  if (options?.remoteUrl) {
    const extracted = extractGhTokenFromRemote(options.remoteUrl);
    if (extracted) {
      return extracted;
    }
  }

  const env = options?.env ?? process.env;
  if (env.GH_TOKEN && env.GH_TOKEN.trim() !== '') {
    return env.GH_TOKEN.trim();
  }

  if (env.GITHUB_TOKEN && env.GITHUB_TOKEN.trim() !== '') {
    return env.GITHUB_TOKEN.trim();
  }

  return null;
}

export interface CreateGitReleaseTagOptions {
  version?: string;
  sha?: string;
  targetRef?: string;
  dryRun?: boolean;
  execFn?: (cmd: string) => string;
}

export function createGitReleaseTag(
  type: 'sql' | 'infra' | 'release' | 'infra-rollback' | 'sql-rollback',
  options?: CreateGitReleaseTagOptions
): { tag: string; executed: boolean } {
  const exec = options?.execFn || ((cmd: string) => execSync(cmd, { encoding: 'utf8' }).trim());

  let version: string = options?.version || '';
  if (!version) {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      version = pkg.version || '0.2.0';
    } catch {
      version = '0.2.0';
    }
  }

  let sha: string = options?.sha || '';
  if (!sha) {
    try {
      sha = exec('git rev-parse HEAD');
    } catch {
      sha = '0000000';
    }
  }

  let tag: string;
  let description: string;
  if (type === 'sql') {
    tag = formatSqlTag(version, sha);
    description = `SQL Schema Migration: ${tag}`;
  } else if (type === 'infra') {
    tag = formatInfraTag(version, sha);
    description = `Infrastructure Provisioning: ${tag}`;
  } else if (type === 'infra-rollback') {
    tag = formatInfraRollbackTag(options?.targetRef || sha);
    description = `Infrastructure Rollback: ${tag}`;
  } else if (type === 'sql-rollback') {
    tag = formatSqlRollbackTag(options?.targetRef || version);
    description = `SQL Schema Rollback: ${tag}`;
  } else {
    tag = formatReleaseTag(version, sha);
    description = `Release: ${tag}`;
  }

  if (options?.dryRun) {
    return { tag, executed: false };
  }

  try {
    exec(`git config user.name "github-actions[bot]" && git config user.email "github-actions[bot]@users.noreply.github.com" && git tag -a "${tag}" -m "${description}" && git push origin "${tag}"`);
    return { tag, executed: true };
  } catch {
    return { tag, executed: false };
  }
}

export interface SemVerParts {
  major: number;
  minor: number;
  patch: number;
}

export type ReleaseLane = 'app' | 'infra' | 'sql';
export type BumpType = 'patch' | 'minor' | 'major';

/**
 * Parses semantic version string (e.g. 0.1.0, v1.2.3, 0.2.0-abc1234) into major, minor, patch.
 */
export function parseSemVer(versionStr: string): SemVerParts | null {
  if (!versionStr || typeof versionStr !== 'string') {
    return null;
  }
  const clean = versionStr.trim().replace(/^v/i, '');
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match || !match[1] || !match[2] || !match[3]) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Increments semantic version based on bump type (patch, minor, major).
 */
export function bumpSemVer(version: string, bump: BumpType): string {
  const parts = parseSemVer(version);
  if (!parts) {
    throw new Error(`Invalid semantic version: "${version}"`);
  }

  if (bump === 'major') {
    return `${parts.major + 1}.0.0`;
  }
  if (bump === 'minor') {
    return `${parts.major}.${parts.minor + 1}.0`;
  }
  return `${parts.major}.${parts.minor}.${parts.patch + 1}`;
}

/**
 * Inspects existing Git tags for a release lane and finds the highest SemVer tag.
 */
export function getLatestReleaseVersion(
  lane: ReleaseLane,
  execFn?: (cmd: string) => string
): { tag: string | null; version: string } {
  const exec = execFn || ((cmd: string) => execSync(cmd, { encoding: 'utf8' }).trim());
  const prefix = lane === 'infra' ? 'promptfm-infra' : lane === 'sql' ? 'promptfm-sql' : 'promptfm';

  let defaultVersion = '0.1.0';
  if (lane === 'app') {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      defaultVersion = pkg.version || '0.2.0';
    } catch {
      defaultVersion = '0.2.0';
    }
  }

  try {
    const searchPattern =
      lane === 'app'
        ? `git tag -l "promptfm/*" "v*.*.*"`
        : `git tag -l "${prefix}/*"`;
    const rawTags = exec(searchPattern).trim();
    if (!rawTags) {
      return { tag: null, version: defaultVersion };
    }

    const tagLines = rawTags.split('\n').map((t) => t.trim()).filter(Boolean);
    const parsedTags: Array<{ tag: string; semver: SemVerParts; versionStr: string }> = [];

    for (const tag of tagLines) {
      let afterPrefix = tag;
      if (tag.startsWith(`${prefix}/`)) {
        afterPrefix = tag.slice(`${prefix}/`.length);
      }
      const semver = parseSemVer(afterPrefix);
      if (semver) {
        parsedTags.push({
          tag,
          semver,
          versionStr: `${semver.major}.${semver.minor}.${semver.patch}`,
        });
      }
    }

    if (parsedTags.length === 0) {
      return { tag: null, version: defaultVersion };
    }

    parsedTags.sort((a, b) => {
      if (b.semver.major !== a.semver.major) return b.semver.major - a.semver.major;
      if (b.semver.minor !== a.semver.minor) return b.semver.minor - a.semver.minor;
      return b.semver.patch - a.semver.patch;
    });

    const highest = parsedTags[0];
    if (!highest) {
      return { tag: null, version: defaultVersion };
    }

    return {
      tag: highest.tag,
      version: highest.versionStr,
    };
  } catch {
    return { tag: null, version: defaultVersion };
  }
}

export interface SuggestNextVersionOptions {
  lane: ReleaseLane;
  bump?: BumpType;
  overrideVersion?: string;
  execFn?: (cmd: string) => string;
  sha?: string;
}

/**
 * Suggests the next release version and tag for a lane, or applies an explicit override version.
 */
export function suggestNextVersion(options: SuggestNextVersionOptions): {
  lane: ReleaseLane;
  currentVersion: string;
  suggestedVersion: string;
  suggestedTag: string;
  isOverride: boolean;
} {
  const { lane, bump = 'patch', overrideVersion, execFn, sha = '0000000' } = options;

  let isOverride = false;
  let suggestedVersion = '';

  const latest = getLatestReleaseVersion(lane, execFn);
  const currentVersion = latest.version;

  if (overrideVersion) {
    const parsed = parseSemVer(overrideVersion);
    if (!parsed) {
      throw new Error(`Invalid semantic version override: "${overrideVersion}"`);
    }
    suggestedVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    isOverride = true;
  } else {
    suggestedVersion = bumpSemVer(currentVersion, bump);
  }

  let suggestedTag: string;
  if (lane === 'infra') {
    suggestedTag = formatInfraTag(suggestedVersion, sha);
  } else if (lane === 'sql') {
    suggestedTag = formatSqlTag(suggestedVersion, sha);
  } else {
    suggestedTag = formatReleaseTag(suggestedVersion, sha);
  }

  return {
    lane,
    currentVersion,
    suggestedVersion,
    suggestedTag,
    isOverride,
  };
}


