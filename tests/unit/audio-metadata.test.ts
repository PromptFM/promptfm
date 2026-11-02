// tests/unit/audio-metadata.test.ts
// Comprehensive Unit tests for PromptFM Audio Metadata & Tag Extraction Service

import { describe, it, expect, vi } from 'vitest';
import {
  matchCategory,
  cleanFilenameToTitle,
  normalizeExtractedMetadata,
  extractMetadataFromBuffer,
  extractMetadataFromBlob,
  DEFAULT_TRACK_ICON,
  type ExtractedAudioMetadata,
} from '@/lib/audio/metadata';
import { STATION_CATEGORIES } from '@/types/database';

describe('Audio Metadata Extraction & Categorization', () => {
  describe('DEFAULT_TRACK_ICON', () => {
    it('is configured to /logo-mark.png', () => {
      expect(DEFAULT_TRACK_ICON).toBe('/logo-mark.png');
    });
  });

  describe('cleanFilenameToTitle', () => {
    it('strips directory paths from Windows and POSIX filenames', () => {
      expect(cleanFilenameToTitle('/home/music/tracks/cyber_drive.mp3')).toBe('cyber drive');
      expect(cleanFilenameToTitle('C:\\Users\\Music\\ambient_chill.mp3')).toBe('ambient chill');
    });

    it('strips extensions correctly', () => {
      expect(cleanFilenameToTitle('soundtrack_theme.wav')).toBe('soundtrack theme');
      expect(cleanFilenameToTitle('radio_jingle.flac')).toBe('radio jingle');
    });

    it('replaces underscores and hyphens with spaces', () => {
      expect(cleanFilenameToTitle('neon-lights_in_the-dark.mp3')).toBe('neon lights in the dark');
    });

    it('removes audio tags like 128kbps, 320kbps, final, master, v1, mp3, audio', () => {
      expect(cleanFilenameToTitle('track_128kbps_final_master_v2_audio.mp3')).toBe('track');
      expect(cleanFilenameToTitle('320kbps_cyber_beat.mp3')).toBe('cyber beat');
    });

    it('collapses multiple whitespace characters and trims ends', () => {
      expect(cleanFilenameToTitle('  spacy   song   title   .mp3')).toBe('spacy song title');
    });

    it('returns empty string if filename only consisted of stripped keywords', () => {
      expect(cleanFilenameToTitle('320kbps_final.mp3')).toBe('');
    });
  });

  describe('matchCategory', () => {
    it('matches Synthwave & Electro keywords (synth, electro, retro, 80s, wave)', () => {
      expect(matchCategory('Synthwave')).toBe('Synthwave & Electro');
      expect(matchCategory('Electro Pop')).toBe('Synthwave & Electro');
      expect(matchCategory('Retro Funk')).toBe('Synthwave & Electro');
      expect(matchCategory('80s Synth')).toBe('Synthwave & Electro');
      expect(matchCategory('Dark Wave')).toBe('Synthwave & Electro');
    });

    it('matches Ambient & Lo-Fi keywords (ambient, lofi, lo-fi, chill, meditat, relax)', () => {
      expect(matchCategory('Ambient Soundscape')).toBe('Ambient & Lo-Fi');
      expect(matchCategory('lofi study beats')).toBe('Ambient & Lo-Fi');
      expect(matchCategory('lo-fi morning')).toBe('Ambient & Lo-Fi');
      expect(matchCategory('Chillout lounge')).toBe('Ambient & Lo-Fi');
      expect(matchCategory('Meditation music')).toBe('Ambient & Lo-Fi');
      expect(matchCategory('Relaxing guitar')).toBe('Ambient & Lo-Fi');
    });

    it('matches Cyberpunk & Industrial keywords (cyber, industrial, ebm, darkwave)', () => {
      expect(matchCategory('Cyberpunk soundtrack')).toBe('Cyberpunk & Industrial');
      expect(matchCategory('Industrial metal')).toBe('Cyberpunk & Industrial');
      expect(matchCategory('Classic EBM bass')).toBe('Cyberpunk & Industrial');
      expect(matchCategory('Darkwave night')).toBe('Cyberpunk & Industrial');
    });

    it('matches Chiptune & 8-Bit keywords (chip, 8bit, 8-bit, arcade, game, pixel)', () => {
      expect(matchCategory('Chiptune melody')).toBe('Chiptune & 8-Bit');
      expect(matchCategory('8bit adventure')).toBe('Chiptune & 8-Bit');
      expect(matchCategory('8-bit retro')).toBe('Chiptune & 8-Bit');
      expect(matchCategory('Arcade theme')).toBe('Chiptune & 8-Bit');
      expect(matchCategory('Game soundtrack')).toBe('Chiptune & 8-Bit');
      expect(matchCategory('Pixel quest')).toBe('Chiptune & 8-Bit');
    });

    it('matches EDM & Dance keywords (dance, edm, house, techno, trance, club)', () => {
      expect(matchCategory('Euro Dance')).toBe('EDM & Dance');
      expect(matchCategory('Festival EDM')).toBe('EDM & Dance');
      expect(matchCategory('Deep House')).toBe('EDM & Dance');
      expect(matchCategory('Dark Techno')).toBe('EDM & Dance');
      expect(matchCategory('Progressive Trance')).toBe('EDM & Dance');
      expect(matchCategory('Club anthem')).toBe('EDM & Dance');
    });

    it('matches Rock & Metal keywords (rock, metal, punk, grunge)', () => {
      expect(matchCategory('Heavy Metal')).toBe('Rock & Metal');
      expect(matchCategory('Hard Rock')).toBe('Rock & Metal');
      expect(matchCategory('Cyber Punk')).toBe('Cyberpunk & Industrial'); // cyber takes priority
      expect(matchCategory('Pure Punk')).toBe('Rock & Metal');
      expect(matchCategory('90s Grunge')).toBe('Rock & Metal');
    });

    it('matches Pop & Vocal keywords (pop, vocal, r&b, soul)', () => {
      expect(matchCategory('Indie Pop')).toBe('Pop & Vocal');
      expect(matchCategory('Female Vocalist')).toBe('Pop & Vocal');
      expect(matchCategory('Smooth R&B')).toBe('Pop & Vocal');
      expect(matchCategory('Neo Soul')).toBe('Pop & Vocal');
    });

    it('matches Cinematic & Classical keywords (cinematic, cinema, classic, orchestr, soundtrack, score)', () => {
      expect(matchCategory('Cinematic drama')).toBe('Cinematic & Classical');
      expect(matchCategory('Cinema mood')).toBe('Cinematic & Classical');
      expect(matchCategory('Classical piano')).toBe('Cinematic & Classical');
      expect(matchCategory('Orchestral strings')).toBe('Cinematic & Classical');
      expect(matchCategory('Epic Soundtrack')).toBe('Cinematic & Classical');
      expect(matchCategory('Film Score')).toBe('Cinematic & Classical');
    });

    it('matches Hip-Hop & Beats keywords (hip, rap, trap, beat)', () => {
      expect(matchCategory('Hip Hop Beats')).toBe('Hip-Hop & Beats');
      expect(matchCategory('Trap 808')).toBe('Hip-Hop & Beats');
      expect(matchCategory('Boom Bap Beat')).toBe('Hip-Hop & Beats');
      expect(matchCategory('Fast Rap Flow')).toBe('Hip-Hop & Beats');
    });

    it('matches exact category names regardless of casing', () => {
      for (const cat of STATION_CATEGORIES) {
        expect(matchCategory(cat.toLowerCase())).toBe(cat);
        expect(matchCategory(cat.toUpperCase())).toBe(cat);
      }
    });

    it('defaults unknown genres to Other / Experimental or fallback for undefined', () => {
      expect(matchCategory('experimental polka')).toBe('Other / Experimental');
      expect(matchCategory('random unmapped genre')).toBe('Other / Experimental');
      expect(matchCategory(undefined)).toBe('Synthwave & Electro');
      expect(matchCategory('')).toBe('Synthwave & Electro');
    });
  });

  describe('normalizeExtractedMetadata', () => {
    it('normalizes full metadata with embedded cover picture, comments, and lyrics', () => {
      const mockRaw = {
        title: 'Neon Nights',
        artist: 'CyberUnit 9',
        genre: ['Synthwave'],
        comment: ['Generated with Suno v3. Prompt: dark retro 80s synth bass.'],
        lyrics: ['Walking down the neon street\nUnderneath the pulsing beat'],
        picture: [
          {
            format: 'image/jpeg',
            data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), // JPEG SOI header
          },
        ],
      };

      const result = normalizeExtractedMetadata(
        mockRaw,
        'neon_nights_final.mp3',
        { duration: 184.6, bitrate: 320100, container: 'MPEG' }
      );

      expect(result.title).toBe('Neon Nights');
      expect(result.artist).toBe('CyberUnit 9');
      expect(result.category).toBe('Synthwave & Electro');
      expect(result.description).toBe('Generated with Suno v3. Prompt: dark retro 80s synth bass.');
      expect(result.lyrics).toBe('Walking down the neon street\nUnderneath the pulsing beat');
      expect(result.hasCoverArt).toBe(true);
      expect(result.coverArtUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(result.defaultIcon).toBe(DEFAULT_TRACK_ICON);
      expect(result.durationSeconds).toBe(185);
      expect(result.bitrate).toBe(320);
      expect(result.format).toBe('MPEG');
    });

    it('handles comment and lyrics as string or object with text property', () => {
      const resultObj = normalizeExtractedMetadata(
        {
          title: 'Test Song',
          comment: [{ text: 'Comment from text property' }],
          lyrics: [{ text: 'Lyrics from text property' }],
        },
        'test.mp3'
      );
      expect(resultObj.description).toBe('Comment from text property');
      expect(resultObj.lyrics).toBe('Lyrics from text property');

      const resultString = normalizeExtractedMetadata(
        {
          title: 'Test Song 2',
          genre: 'ambient',
          comment: 'Direct string comment',
          lyrics: 'Direct string lyrics',
        },
        'test2.mp3'
      );
      expect(resultString.category).toBe('Ambient & Lo-Fi');
      expect(resultString.description).toBe('Direct string comment');
      expect(resultString.lyrics).toBe('Direct string lyrics');
    });

    it('handles picture with Node Buffer data', () => {
      const bufferPic = Buffer.from([1, 2, 3, 4]);
      const result = normalizeExtractedMetadata(
        {
          picture: [{ format: 'image/png', data: bufferPic }],
        },
        'track.mp3'
      );
      expect(result.hasCoverArt).toBe(true);
      expect(result.coverArtUrl).toBe(`data:image/png;base64,${bufferPic.toString('base64')}`);
    });

    it('handles picture with default mimeType if format missing', () => {
      const bufferPic = Buffer.from([1, 2, 3, 4]);
      const result = normalizeExtractedMetadata(
        {
          picture: [{ format: '', data: bufferPic }],
        },
        'track.mp3'
      );
      expect(result.coverArtUrl).toContain('data:image/jpeg;base64,');
    });

    it('ignores empty picture array or invalid picture data', () => {
      const result = normalizeExtractedMetadata(
        {
          picture: [{ format: 'image/jpeg', data: new Uint8Array([]) }],
        },
        'track.mp3'
      );
      expect(result.hasCoverArt).toBe(false);
      expect(result.coverArtUrl).toBe(DEFAULT_TRACK_ICON);
    });

    it('falls back to Untitled AI Track when filename produces empty string', () => {
      const result = normalizeExtractedMetadata({}, '320kbps_final.mp3');
      expect(result.title).toBe('Untitled AI Track');
      expect(result.artist).toBe('PromptFM Resident');
      expect(result.durationSeconds).toBeNull();
      expect(result.bitrate).toBeNull();
      expect(result.format).toBeNull();
    });
  });

  describe('extractMetadataFromBuffer', () => {
    it('gracefully handles parsing errors by returning fallback metadata', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const badBuffer = new Uint8Array([0, 0, 0, 0]);
      const result = await extractMetadataFromBuffer(badBuffer, 'corrupted_track.mp3');

      expect(result.title).toBe('corrupted track');
      expect(result.artist).toBe('PromptFM Resident');
      expect(result.category).toBe('Synthwave & Electro');
      expect(result.hasCoverArt).toBe(false);
      consoleWarnSpy.mockRestore();
    });
  });

  describe('extractMetadataFromBlob', () => {
    it('gracefully handles parsing errors on invalid blob', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fakeBlob = {
        size: 4,
        type: 'audio/mpeg',
        arrayBuffer: async () => new ArrayBuffer(4),
        slice: () => fakeBlob,
        stream: () => ({} as any),
        text: async () => '',
      } as unknown as Blob;

      const result = await extractMetadataFromBlob(fakeBlob, 'test_blob.mp3');
      expect(result.title).toBe('test blob');
      expect(result.artist).toBe('PromptFM Resident');
      consoleWarnSpy.mockRestore();
    });
  });
});
