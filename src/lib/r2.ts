// src/lib/r2.ts
// Cloudflare R2 S3-compatible client.
// This module is server-only — never imported in Client Components.

import { S3Client } from '@aws-sdk/client-s3';

if (!process.env.R2_ACCOUNT_ID) throw new Error('Missing R2_ACCOUNT_ID env var');
if (!process.env.R2_ACCESS_KEY_ID) throw new Error('Missing R2_ACCESS_KEY_ID env var');
if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error('Missing R2_SECRET_ACCESS_KEY env var');
if (!process.env.R2_BUCKET_NAME) throw new Error('Missing R2_BUCKET_NAME env var');

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

/** Constructs the public URL for an R2 object by key. */
export function getPublicUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Missing NEXT_PUBLIC_R2_PUBLIC_URL env var');
  return `${base}/${key}`;
}
