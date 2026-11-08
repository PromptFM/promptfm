// src/lib/infra/gcp-secrets.ts
// Google Cloud Secret Manager Client & In-Memory Resolver ($0 Always-Free Tier).
// Adheres strictly to the 3 Golden Rules:
// 1. Destroy old versions on rotation (disabled/enabled count against quota; destroyed do not).
// 2. Cache in memory with TTL to stay well below 10,000 monthly access requests.
// 3. Single-region / automatic replication to prevent multi-region version multiplication.

import { execSync } from 'child_process';

export const DEFAULT_GCP_PROJECT_ID = 'promptfm-radio-1793623670';
export const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const secretCache = new Map<string, CacheEntry>();

export function clearSecretCache(): void {
  secretCache.clear();
}

export interface ResolveSecretOptions {
  fallbackEnvVar?: string;
  projectId?: string;
  ttlMs?: number;
  skipCache?: boolean;
  required?: boolean;
  execGcloud?: (cmd: string) => string;
}

export interface DestroyVersionsOptions {
  projectId?: string;
  keepVersions?: number;
  execGcloud?: (cmd: string) => string;
}

function defaultExecGcloud(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * Resolves a secret from environment variables, in-memory cache, or Google Cloud Secret Manager.
 * Guarantees zero disk persistence and strictly minimizes Secret Manager API calls.
 */
export async function resolveGcpSecret(
  secretName: string,
  options: ResolveSecretOptions = {}
): Promise<string> {
  const {
    fallbackEnvVar,
    projectId = DEFAULT_GCP_PROJECT_ID,
    ttlMs = DEFAULT_CACHE_TTL_MS,
    skipCache = false,
    required = false,
    execGcloud = defaultExecGcloud,
  } = options;

  const cacheKey = `${projectId}:${secretName}`;

  // 1. Check fallback environment variable first
  if (fallbackEnvVar && process.env[fallbackEnvVar]) {
    const rawVal = process.env[fallbackEnvVar]!.trim();
    if (rawVal && !rawVal.startsWith('[SENSITIVE')) {
      secretCache.set(cacheKey, { value: rawVal, expiresAt: Date.now() + ttlMs });
      return rawVal;
    }
  }

  // 2. Check in-memory cache (unless skipCache is requested)
  if (!skipCache && secretCache.has(cacheKey)) {
    const cached = secretCache.get(cacheKey)!;
    if (Date.now() < cached.expiresAt) {
      return cached.value;
    }
    secretCache.delete(cacheKey);
  }

  // 3. Fetch from Google Cloud Secret Manager using ambient ADC or gcloud CLI
  try {
    const cmd = `gcloud secrets versions access latest --secret=${secretName} --project=${projectId}`;
    const output = execGcloud(cmd).trim();

    if (output) {
      secretCache.set(cacheKey, { value: output, expiresAt: Date.now() + ttlMs });
      return output;
    }
  } catch (err: any) {
    if (required) {
      throw new Error(
        `Failed to resolve required GCP secret "${secretName}" in project "${projectId}": ${err.message}`
      );
    }
  }

  return '';
}

/**
 * Destroys older secret versions after rotation to prevent active version count
 * from exceeding the GCP 6-version Always-Free quota.
 */
export async function destroyPreviousSecretVersions(
  secretName: string,
  options: DestroyVersionsOptions = {}
): Promise<string[]> {
  const {
    projectId = DEFAULT_GCP_PROJECT_ID,
    keepVersions = 1,
    execGcloud = defaultExecGcloud,
  } = options;

  const destroyed: string[] = [];

  try {
    const listCmd = `gcloud secrets versions list ${secretName} --project=${projectId} --format=json`;
    const rawList = execGcloud(listCmd);
    const versions = JSON.parse(rawList);

    if (!Array.isArray(versions)) {
      return destroyed;
    }

    // Filter to active versions (ENABLED or DISABLED - both count against quota)
    // Destroyed versions have state 'DESTROYED' and do not count.
    const activeVersions = versions
      .filter((v: any) => v.state === 'ENABLED' || v.state === 'DISABLED')
      .map((v: any) => {
        const parts = (v.name || '').split('/');
        return {
          versionId: parts[parts.length - 1],
          createTime: v.createTime || '',
        };
      })
      .sort((a, b) => Number(b.versionId) - Number(a.versionId));

    // Keep the most recent `keepVersions` (usually 1, the latest)
    const toDestroy = activeVersions.slice(keepVersions);

    for (const v of toDestroy) {
      const destroyCmd = `gcloud secrets versions destroy ${v.versionId} --secret=${secretName} --project=${projectId} --quiet`;
      execGcloud(destroyCmd);
      destroyed.push(v.versionId);
    }
  } catch (err: any) {
    // If version listing fails, return whatever was collected
  }

  return destroyed;
}
