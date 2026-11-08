// src/lib/infra/release-tag.ts
// Formatters and token resolvers for PromptFM release, rollback, and git tags.

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
