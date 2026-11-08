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

