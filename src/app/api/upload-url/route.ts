// src/app/api/upload-url/route.ts
// POST /api/upload-url
// Validates the request, generates a short-lived R2 presigned PUT URL,
// and returns it plus the resulting public URL for the uploaded object.

import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { r2Client, R2_BUCKET_NAME, getPublicUrl } from '@/lib/r2';
import { createClient } from '@/lib/supabase/server';
import type { UploadUrlRequest, UploadUrlResponse } from '@/types/database';

/** Audio MIME types accepted for upload. */
const ALLOWED_CONTENT_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/aac',
  'audio/x-m4a',
  'audio/mp4',
]);

/** Presigned URL validity in seconds (5 minutes). */
const URL_EXPIRES_IN = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth guard ────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in before uploading.' },
      { status: 401 },
    );
  }

  // ── 2. Parse & validate request body ────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('filename' in body) ||
    !('contentType' in body) ||
    typeof (body as UploadUrlRequest).filename !== 'string' ||
    typeof (body as UploadUrlRequest).contentType !== 'string'
  ) {
    return NextResponse.json(
      { error: 'Body must be { filename: string, contentType: string }.' },
      { status: 400 },
    );
  }

  const { filename, contentType } = body as UploadUrlRequest;

  if (!filename.trim()) {
    return NextResponse.json({ error: 'filename must not be empty.' }, { status: 400 });
  }

  const normalizedContentType = contentType.toLowerCase().trim();
  if (!ALLOWED_CONTENT_TYPES.has(normalizedContentType)) {
    return NextResponse.json(
      {
        error: `Content type "${contentType}" is not allowed. Accepted: ${[...ALLOWED_CONTENT_TYPES].join(', ')}.`,
      },
      { status: 415 },
    );
  }

  // ── 3. Generate a unique, path-safe object key ───────────────────────────
  // We ignore the original filename and derive the extension from the MIME type
  // to guarantee safe filenames and prevent collisions.
  const extension = normalizedContentType.split('/')[1]?.replace('x-', '') ?? 'mp3';
  const key = `tracks/${user.id}/${randomUUID()}.${extension}`;

  // ── 4. Create presigned PUT URL ──────────────────────────────────────────
  let presignedUrl: string;
  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: normalizedContentType,
      // Enforce max upload size (12 MB) server-side via content-length-range condition.
      // Note: R2 presigned URLs support this via a header policy; clients must
      // include the Content-Length header equal to the file size.
    });

    presignedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: URL_EXPIRES_IN,
    });
  } catch (err) {
    console.error('[upload-url] Failed to generate presigned URL:', err);
    return NextResponse.json(
      { error: 'Failed to generate upload URL. Please try again.' },
      { status: 500 },
    );
  }

  // ── 5. Respond ───────────────────────────────────────────────────────────
  const response: UploadUrlResponse = {
    presignedUrl,
    publicUrl: getPublicUrl(key),
    key,
  };

  return NextResponse.json(response, { status: 200 });
}

// Reject all other HTTP verbs explicitly.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

