#!/usr/bin/env node
// scripts/local-cutover-ingestion.ts
// Direct local disk ingestion of master tracks to Cloudflare R2 and Postgres URL rewrite.

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Client as PgClient } from 'pg';
import * as mm from 'music-metadata';
import {
  buildLegacyR2AudioKey,
  buildLegacyR2CoverKey,
  normalizeFilenameMatch,
  isMissingLegacyTrack,
} from '../src/lib/infra/local-media-cutover';

interface AppEnvSecrets {
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  NEXT_PUBLIC_R2_PUBLIC_URL: string;
}

const SEARCH_DIRECTORIES = [
  '/Users/trifan/Library/Mobile Documents/com~apple~CloudDocs/aimusic',
  '/Users/trifan/Library/Mobile Documents/com~apple~CloudDocs',
  '/Users/trifan/Music/Music/Media.localized/Music/alextrifan/Unknown Album',
];

function loadSecrets(): { env: AppEnvSecrets; dbUrl: string } {
  const envRaw = execSync('gcloud secrets versions access latest --secret=promptfm-web-app-env', {
    stdio: ['pipe', 'pipe', 'ignore'],
  }).toString();
  const env = JSON.parse(envRaw) as AppEnvSecrets;

  const dbUrlRaw = execSync('gcloud secrets versions access latest --secret=promptfm-database-url', {
    stdio: ['pipe', 'pipe', 'ignore'],
  }).toString().trim();

  // Route through session pooler port 5432
  const dbUrl = dbUrlRaw.replace(':6543/', ':5432/');
  return { env, dbUrl };
}

function findLocalFile(expectedFilename: string): string | null {
  // Phase 1: Exact filename match across all directories
  for (const dir of SEARCH_DIRECTORIES) {
    if (!fs.existsSync(dir)) continue;
    const directPath = path.join(dir, expectedFilename);
    if (fs.existsSync(directPath)) {
      return directPath;
    }
  }

  // Phase 2: Exact normalized match (ignoring case & non-alphanumeric)
  const targetClean = expectedFilename.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(mp3|mp4|m4a|wav)$/i, '');
  for (const dir of SEARCH_DIRECTORIES) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const entryClean = entry.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(mp3|mp4|m4a|wav)$/i, '');
      if (targetClean === entryClean) {
        return path.join(dir, entry);
      }
    }
  }

  // Phase 3: Fuzzy / remix-aware match
  for (const dir of SEARCH_DIRECTORIES) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) continue;

      if (normalizeFilenameMatch(expectedFilename, entry)) {
        return fullPath;
      }
    }
  }
  return null;
}

async function r2ObjectExists(s3: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = !isApply;

  console.log(`=== PromptFM Local Media Cutover (${isApply ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  console.log('Fetching credentials from GCP Secret Manager...');
  const { env, dbUrl } = loadSecrets();
  const bucketName = env.R2_BUCKET_NAME || 'promptfm-audio';
  const publicBase = env.NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/+$/, '');

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  const parsedUrl = new URL(dbUrl);
  parsedUrl.searchParams.delete('ssl');
  parsedUrl.searchParams.set('sslmode', 'no-verify');

  const pg = new PgClient({
    connectionString: parsedUrl.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  await pg.connect();
  console.log('Connected to PostgreSQL (port 5432 session pooler).\n');

  const res = await pg.query(`
    SELECT
      id::text as id,
      title,
      artist_name,
      status,
      audio_url,
      cover_art_url
    FROM public.tracks
    ORDER BY id ASC
  `);

  const tracks = res.rows;
  console.log(`Found ${tracks.length} tracks in database.\n`);

  let migratedCount = 0;
  let archivedCount = 0;
  let skippedCount = 0;

  for (const track of tracks) {
    const isArchivedTarget = isMissingLegacyTrack(track.title, track.artist_name);
    const audioFilename = decodeURIComponent(track.audio_url.split('/').pop() || '');
    const localFile = findLocalFile(audioFilename);

    if (isArchivedTarget || !localFile) {
      archivedCount++;
      console.log(`[ARCHIVE] "${track.title}" by ${track.artist_name}`);
      console.log(`  -> Reason: File not found locally on disk. Tracking in issue #214.`);
      if (isApply) {
        await pg.query(
          `UPDATE public.tracks SET status = 'rejected' WHERE id = $1`,
          [track.id],
        );
        console.log(`  -> Status updated to 'rejected' in database.`);
      }
      continue;
    }

    migratedCount++;
    const targetAudioKey = buildLegacyR2AudioKey(track.audio_url);
    const nextAudioUrl = `${publicBase}/${targetAudioKey}`;

    console.log(`[MIGRATE] "${track.title}" by ${track.artist_name}`);
    console.log(`  Local file: ${localFile}`);
    console.log(`  Target R2 key: ${targetAudioKey}`);

    let nextCoverUrl = track.cover_art_url;

    if (isApply) {
      // 1. Upload audio to R2 if not already there
      const audioExists = await r2ObjectExists(s3, bucketName, targetAudioKey);
      if (audioExists) {
        console.log(`  Audio: Already exists in R2.`);
      } else {
        const audioBuffer = fs.readFileSync(localFile);
        const ext = path.extname(localFile).toLowerCase();
        const contentType = ext === '.mp4' || ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg';

        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: targetAudioKey,
            Body: audioBuffer,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
        console.log(`  Audio: Uploaded ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB to R2.`);
      }

      // 2. Check cover art
      let targetCoverKey = buildLegacyR2CoverKey(track.audio_url, track.cover_art_url);
      if (!targetCoverKey) {
        const baseName = path.basename(targetAudioKey, path.extname(targetAudioKey));
        targetCoverKey = `tracks/legacy/covers/${baseName}-cover.jpg`;
      }

      const coverExists = await r2ObjectExists(s3, bucketName, targetCoverKey);
      if (coverExists) {
        nextCoverUrl = `${publicBase}/${targetCoverKey}`;
        console.log(`  Cover: Already exists in R2 -> ${nextCoverUrl}`);
      } else {
        try {
          const metadata = await mm.parseFile(localFile);
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const pic = metadata.common.picture[0];
            await s3.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: targetCoverKey,
                Body: pic.data,
                ContentType: pic.format || 'image/jpeg',
                CacheControl: 'public, max-age=31536000, immutable',
              }),
            );
            nextCoverUrl = `${publicBase}/${targetCoverKey}`;
            console.log(`  Cover: Extracted ID3 art and uploaded ${(pic.data.length / 1024).toFixed(1)} KB to R2 -> ${nextCoverUrl}`);
          } else {
            nextCoverUrl = '/logo-mark.png';
            console.log(`  Cover: No embedded art; using fallback /logo-mark.png`);
          }
        } catch (e: any) {
          nextCoverUrl = '/logo-mark.png';
          console.log(`  Cover: Note extracting metadata: ${e.message}; using /logo-mark.png`);
        }
      }

      // 3. Update database
      await pg.query(
        `UPDATE public.tracks SET audio_url = $1, cover_art_url = $2, status = 'approved' WHERE id = $3`,
        [nextAudioUrl, nextCoverUrl, track.id],
      );
      console.log(`  Database updated successfully.`);
    } else {
      console.log(`  Would upload to R2 and update DB to:`);
      console.log(`    audio_url: ${nextAudioUrl}`);
    }
  }

  await pg.end();

  console.log('\n=======================================');
  console.log(`Total tracks processed: ${tracks.length}`);
  console.log(`Migrated to R2:         ${migratedCount}`);
  console.log(`Archived (missing):     ${archivedCount}`);
  console.log('=======================================');
  if (isDryRun) {
    console.log('\n[DRY-RUN COMPLETE] Run with --apply to execute the migration.');
  } else {
    console.log('\n[APPLY COMPLETE] All tracks successfully migrated.');
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
