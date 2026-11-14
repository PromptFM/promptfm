// src/lib/infra/local-media-cutover.ts
// Pure helper functions for local media cutover to Cloudflare R2.

export const ARCHIVED_LEGACY_TRACK_TITLES = new Set([
  'Echoes of the Violin',
  'PromptFM Ambient AI Anthem',
  'Desert Mirage',
  'Serpent Voice',
  'Sunset Grooves',
  'Level Up',
  'All Talk, No Spark (Lento Mix)',
  'Alphabet Song',
  'Scarlet Haze',
  'MINUIT (VIENS ICI)',
  'Haina-mi este cea mai draga',
  'HAI HAI (DIN CARPAȚI)',
  'NOAPTEA MĂ CHEAMĂ',
  'Hold That Line',
  'You’re on the Road',
  'Justify',
]);

export function buildLegacyR2AudioKey(supabaseUrl: string): string {
  const parts = supabaseUrl.split('/');
  const filename = decodeURIComponent(parts[parts.length - 1] || '');
  return `tracks/legacy/${filename}`;
}

export function buildLegacyR2CoverKey(
  supabaseAudioUrl: string,
  existingCoverUrl?: string | null,
): string | null {
  if (!existingCoverUrl || existingCoverUrl === '/logo-mark.png') {
    return null;
  }

  try {
    const parsed = new URL(existingCoverUrl);
    if (!parsed.pathname.includes('/storage/')) {
      return null;
    }
    const parts = parsed.pathname.split('/');
    const filename = decodeURIComponent(parts[parts.length - 1] || '');
    return `tracks/legacy/covers/${filename}`;
  } catch {
    return null;
  }
}

export function normalizeFilenameMatch(targetFilename: string, candidateFilename: string): boolean {
  const cleanTarget = targetFilename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(mp3|mp4|m4a|wav)$/i, '');
  const cleanCandidate = candidateFilename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(mp3|mp4|m4a|wav)$/i, '');

  if (cleanTarget === cleanCandidate) {
    return true;
  }

  // Check if both or neither are remix
  const targetIsRemix = targetFilename.toLowerCase().includes('remix');
  const candidateIsRemix = candidateFilename.toLowerCase().includes('remix');
  if (targetIsRemix !== candidateIsRemix) {
    return false;
  }

  return cleanTarget.includes(cleanCandidate) || cleanCandidate.includes(cleanTarget);
}

export function isMissingLegacyTrack(title: string, artist: string): boolean {
  if (ARCHIVED_LEGACY_TRACK_TITLES.has(title)) {
    return true;
  }
  // Check without diacritics / formatting
  const normalizedTitle = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const archived of ARCHIVED_LEGACY_TRACK_TITLES) {
    if (archived.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalizedTitle) {
      return true;
    }
  }
  return false;
}
