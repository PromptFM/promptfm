// src/lib/r2.ts
// Cloudflare R2 S3-compatible client.
// This module is server-only — never imported in Client Components.
//
// The client is initialised lazily (inside getR2Client / getPublicUrl) so that
// missing env vars throw at *request time* rather than at Next.js build-time
// static analysis, which would break the Vercel production build.

import { S3Client } from '@aws-sdk/client-s3';

let _client: S3Client | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Returns a singleton R2 S3Client, initialised on first call. */
export function getR2Client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      },
    });
  }
  return _client;
}

/** The R2 bucket name — validated at request time. */
export function getBucketName(): string {
  return requireEnv('R2_BUCKET_NAME');
}

/** Constructs the public URL for an R2 object by key — validated at request time. */
export function getPublicUrl(key: string): string {
  const base = requireEnv('NEXT_PUBLIC_R2_PUBLIC_URL').replace(/\/$/, '');
  return `${base}/${key}`;
}
