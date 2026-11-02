// src/lib/audio/metadata.ts
// PromptFM Audio Metadata & Tag Extraction Engine
// Extracts ID3/MP4 metadata (Title, Artist, Category/Genre, Prompt Description, Lyrics, Cover Art)
// Supports both client-side File/Blob in the browser and Node Buffer in the CLI.

import { STATION_CATEGORIES, StationCategory } from '@/types/database';

export const DEFAULT_TRACK_ICON = '/logo-mark.png';

export interface ExtractedAudioMetadata {
  title: string;
  artist: string;
  category: StationCategory;
  description: string | null;
  lyrics: string | null;
  hasCoverArt: boolean;
  coverArtUrl: string;
  defaultIcon: string;
  durationSeconds?: number | null;
  format?: string | null;
  bitrate?: number | null;
}

/**
 * Matches a detected ID3 genre or text vibe against official PromptFM station categories.
 */
export function matchCategory(genre?: string): StationCategory {
  if (!genre) return 'Synthwave & Electro';

  const g = genre.toLowerCase().trim();

  if (g.includes('cyber') || g.includes('industrial') || g.includes('ebm') || g.includes('darkwave')) {
    return 'Cyberpunk & Industrial';
  }
  if (g.includes('chip') || g.includes('8bit') || g.includes('8-bit') || g.includes('arcade') || g.includes('game') || g.includes('pixel')) {
    return 'Chiptune & 8-Bit';
  }
  if (g.includes('synth') || g.includes('electro') || g.includes('retro') || g.includes('80s') || g.includes('wave')) {
    return 'Synthwave & Electro';
  }
  if (g.includes('ambient') || g.includes('lofi') || g.includes('lo-fi') || g.includes('chill') || g.includes('meditat') || g.includes('relax')) {
    return 'Ambient & Lo-Fi';
  }
  if (g.includes('dance') || g.includes('edm') || g.includes('house') || g.includes('techno') || g.includes('trance') || g.includes('club')) {
    return 'EDM & Dance';
  }
  if (g.includes('rock') || g.includes('metal') || g.includes('punk') || g.includes('grunge')) {
    return 'Rock & Metal';
  }
  if (g.includes('pop') || g.includes('vocal') || g.includes('r&b') || g.includes('soul')) {
    return 'Pop & Vocal';
  }
  if (g.includes('cinematic') || g.includes('cinema') || g.includes('classic') || g.includes('orchestr') || g.includes('soundtrack') || g.includes('score')) {
    return 'Cinematic & Classical';
  }
  if (g.includes('hip') || g.includes('rap') || g.includes('trap') || g.includes('beat')) {
    return 'Hip-Hop & Beats';
  }

  // Check if it exactly matches any existing station category name
  const exact = STATION_CATEGORIES.find((c) => c.toLowerCase() === g);
  if (exact) return exact;

  return 'Other / Experimental';
}

/**
 * Strips extensions, cleans underscores/hyphens, and cleans common bitrate/watermark strings.
 */
export function cleanFilenameToTitle(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, '');
  return base
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b(128kbps|320kbps|final|master|v\d+|mp3|audio)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes raw tags extracted by music-metadata into PromptFM metadata.
 */
export function normalizeExtractedMetadata(
  common: {
    title?: string;
    artist?: string;
    genre?: string[] | string;
    comment?: Array<{ text?: string } | string> | string;
    lyrics?: Array<{ text?: string } | string> | string;
    picture?: Array<{ format: string; data: Uint8Array | Buffer }>;
  },
  fallbackFilename: string,
  formatInfo?: { duration?: number; bitrate?: number; container?: string }
): ExtractedAudioMetadata {
  const title = common.title?.trim() || cleanFilenameToTitle(fallbackFilename) || 'Untitled AI Track';
  const artist = common.artist?.trim() || 'PromptFM Resident';

  let rawGenre = '';
  if (Array.isArray(common.genre)) {
    rawGenre = common.genre[0] || '';
  } else if (typeof common.genre === 'string') {
    rawGenre = common.genre;
  }
  const category = matchCategory(rawGenre);

  let description: string | null = null;
  if (Array.isArray(common.comment) && common.comment.length > 0) {
    const first = common.comment[0];
    description = typeof first === 'string' ? first : first?.text || null;
  } else if (typeof common.comment === 'string') {
    description = common.comment;
  }

  let lyrics: string | null = null;
  if (Array.isArray(common.lyrics) && common.lyrics.length > 0) {
    const first = common.lyrics[0];
    lyrics = typeof first === 'string' ? first : first?.text || null;
  } else if (typeof common.lyrics === 'string') {
    lyrics = common.lyrics;
  }

  // Extract primary cover picture
  let hasCoverArt = false;
  let coverArtUrl = DEFAULT_TRACK_ICON;

  if (common.picture && common.picture.length > 0) {
    const pic = common.picture[0];
    if (pic && pic.data && pic.data.length > 0) {
      const mime = pic.format || 'image/jpeg';
      let base64 = '';
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(pic.data)) {
        base64 = pic.data.toString('base64');
      } else {
        const bytes = new Uint8Array(pic.data);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64');
      }

      if (base64) {
        hasCoverArt = true;
        coverArtUrl = `data:${mime};base64,${base64}`;
      }
    }
  }

  return {
    title,
    artist,
    category,
    description: description ? description.trim() : null,
    lyrics: lyrics ? lyrics.trim() : null,
    hasCoverArt,
    coverArtUrl,
    defaultIcon: DEFAULT_TRACK_ICON,
    durationSeconds: formatInfo?.duration ? Math.round(formatInfo.duration) : null,
    format: formatInfo?.container || null,
    bitrate: formatInfo?.bitrate ? Math.round(formatInfo.bitrate / 1000) : null,
  };
}

/**
 * Extracts metadata from a browser File or Blob.
 */
export async function extractMetadataFromBlob(blob: Blob, filename: string): Promise<ExtractedAudioMetadata> {
  try {
    const mm = await import('music-metadata');
    const metadata = await mm.parseBlob(blob);
    return normalizeExtractedMetadata(metadata.common, filename, metadata.format);
  } catch (err) {
    console.warn('Failed to parse audio metadata from blob:', err);
    return normalizeExtractedMetadata({}, filename);
  }
}

/**
 * Extracts metadata from a Node.js Buffer or Uint8Array.
 */
export async function extractMetadataFromBuffer(
  buffer: Uint8Array | Buffer,
  filename: string,
  mimeType?: string
): Promise<ExtractedAudioMetadata> {
  try {
    const mm = await import('music-metadata');
    const metadata = await mm.parseBuffer(buffer, mimeType ? { mimeType } : undefined);
    return normalizeExtractedMetadata(metadata.common, filename, metadata.format);
  } catch (err) {
    console.warn('Failed to parse audio metadata from buffer:', err);
    return normalizeExtractedMetadata({}, filename);
  }
}

