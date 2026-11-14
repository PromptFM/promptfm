// src/lib/dj/cli-upload.ts
// Service for uploading audio files and embedded cover art to Cloudflare R2
// and inserting track records directly into PostgreSQL database.

import fs from 'fs';
import { basename } from 'path';
import { randomUUID } from 'crypto';
import { ensureGcpSecretsLoaded } from '../infra/gcp-secrets';
import { uploadBufferToR2 } from '../r2';
import { insertTrackDirect, type InsertTrackInput } from './direct-track-queries';
import { extractMetadataFromBuffer, DEFAULT_TRACK_ICON, type ExtractedAudioMetadata } from '../audio/metadata';

export interface CliUploadOptions {
  filePath: string;
  title?: string;
  artist?: string;
  category?: string;
  tool?: string;
  description?: string;
  lyrics?: string;
  votes?: number;
  familyFriendly?: boolean;
  isExplicit?: boolean;
  ensureSecrets?: boolean;
  r2Uploader?: (key: string, buffer: Buffer | Uint8Array, contentType: string) => Promise<string>;
  dbInserter?: (input: InsertTrackInput) => Promise<any>;
  metadataExtractor?: (buffer: Buffer, fileName: string, contentType: string) => Promise<Partial<ExtractedAudioMetadata>>;
}

export interface CliUploadResult {
  success: boolean;
  trackId: string;
  title: string;
  artist: string;
  audioUrl: string;
  coverArtUrl: string;
  category: string;
  tool: string;
  upvotesCount: number;
}

function detectMediaType(fileName: string): { ext: string; contentType: string } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.mp4')) return { ext: 'mp4', contentType: 'video/mp4' };
  if (lower.endsWith('.m4a')) return { ext: 'm4a', contentType: 'audio/mp4' };
  if (lower.endsWith('.wav')) return { ext: 'wav', contentType: 'audio/wav' };
  if (lower.endsWith('.ogg')) return { ext: 'ogg', contentType: 'audio/ogg' };
  if (lower.endsWith('.flac')) return { ext: 'flac', contentType: 'audio/flac' };
  return { ext: 'mp3', contentType: 'audio/mpeg' };
}

export async function executeCliTrackUpload(
  options: CliUploadOptions
): Promise<CliUploadResult> {
  const {
    filePath,
    ensureSecrets = true,
    r2Uploader = uploadBufferToR2,
    dbInserter = insertTrackDirect,
    metadataExtractor = extractMetadataFromBuffer,
  } = options;

  if (ensureSecrets) {
    await ensureGcpSecretsLoaded();
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at "${filePath}"`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const rawFileName = basename(filePath);
  const cleanFileName = rawFileName.replace(/^["']|["']$/g, '');
  const { ext, contentType } = detectMediaType(cleanFileName);

  const meta = await metadataExtractor(fileBuffer, cleanFileName, contentType);

  const title = (options.title || meta.title || cleanFileName.replace(/\.[^.]+$/, '')).trim();
  const artist = (options.artist || meta.artist || 'PromptFM Resident DJ').trim();
  const category = (options.category || meta.category || 'General').trim();
  const tool = (options.tool || 'Suno').trim();
  const description = options.description || meta.description || null;
  const lyrics = options.lyrics || meta.lyrics || null;
  const initialVotes = typeof options.votes === 'number' ? options.votes : 25;
  const familyFriendly = options.familyFriendly !== false;
  const isExplicit = Boolean(options.isExplicit);

  // 1. Upload audio to Cloudflare R2
  const audioKey = `tracks/admin/${randomUUID()}.${ext}`;
  const audioUrl = await r2Uploader(audioKey, fileBuffer, contentType);

  // 2. Upload embedded cover art to Cloudflare R2 if present
  let coverArtUrl = DEFAULT_TRACK_ICON;
  if (meta.hasCoverArt && meta.coverArtUrl) {
    if (meta.coverArtUrl.startsWith('data:image/')) {
      const base64Data = meta.coverArtUrl.split(',')[1];
      if (base64Data) {
        const coverBuffer = Buffer.from(base64Data, 'base64');
        const coverKey = `tracks/admin/covers/${randomUUID()}-cover.jpg`;
        coverArtUrl = await r2Uploader(coverKey, coverBuffer, 'image/jpeg');
      }
    } else {
      coverArtUrl = meta.coverArtUrl;
    }
  }

  // 3. Insert track directly into PostgreSQL database
  const inserted = await dbInserter({
    title,
    artist_name: artist,
    audio_url: audioUrl,
    category,
    tool_used: tool,
    description,
    lyrics,
    cover_art_url: coverArtUrl,
    status: 'approved',
    upvotes_count: initialVotes,
    family_friendly: familyFriendly,
    is_explicit: isExplicit,
    channel_exclusions: [],
  });

  return {
    success: true,
    trackId: inserted.id,
    title,
    artist,
    audioUrl,
    coverArtUrl,
    category,
    tool,
    upvotesCount: initialVotes,
  };
}
