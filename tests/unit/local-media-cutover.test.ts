import { describe, expect, it } from 'vitest';
import {
  buildLegacyR2AudioKey,
  buildLegacyR2CoverKey,
  normalizeFilenameMatch,
  isMissingLegacyTrack,
  ARCHIVED_LEGACY_TRACK_TITLES,
} from '../../src/lib/infra/local-media-cutover';

describe('local media cutover helpers', () => {
  it('builds stable R2 audio keys from legacy Supabase URLs', () => {
    const url = 'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/MAP-born-by-the-devil-remix.mp3';
    expect(buildLegacyR2AudioKey(url)).toBe('tracks/legacy/MAP-born-by-the-devil-remix.mp3');
  });

  it('normalizes filenames for fuzzy disk matching', () => {
    expect(normalizeFilenameMatch('ES_Don_t_Let_This_Go_To_Waste_-_Loving_Caliber.mp3', "ES_Don't Let This Go To Waste - Loving Caliber.mp3")).toBe(true);
    expect(normalizeFilenameMatch('MAP-crown-of-the-frozen-moon_remix.mp3', 'MAP-crown-of-the-frozen-moon remix.mp3')).toBe(true);
    expect(normalizeFilenameMatch('born_to_break.mp3', '"Born to Break".mp3')).toBe(true);
    expect(normalizeFilenameMatch('rise_and_rebuild.mp3', 'rise and rebuild.mp3')).toBe(true);
    expect(normalizeFilenameMatch('forged_in_pain.mp4', 'Forged-in-pain-.MP4')).toBe(true);
  });

  it('builds R2 cover keys preserving naming convention', () => {
    const audioUrl = 'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/MAP-born-by-the-devil-remix.mp3';
    const coverUrl = 'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/covers/MAP-born-by-the-devil-remix-cover.jpg';
    expect(buildLegacyR2CoverKey(audioUrl, coverUrl)).toBe('tracks/legacy/covers/MAP-born-by-the-devil-remix-cover.jpg');

    // fallback when cover is /logo-mark.png
    expect(buildLegacyR2CoverKey(audioUrl, '/logo-mark.png')).toBeNull();
  });

  it('identifies the 16 missing legacy tracks for archival', () => {
    expect(isMissingLegacyTrack('Echoes of the Violin', 'AbsoluteSound')).toBe(true);
    expect(isMissingLegacyTrack('PromptFM Ambient AI Anthem', 'PromptFM Core')).toBe(true);
    expect(isMissingLegacyTrack('BORN BY THE DEVIL - Remix', 'alextrifan')).toBe(false);
    expect(ARCHIVED_LEGACY_TRACK_TITLES.size).toBe(16);
  });
});
