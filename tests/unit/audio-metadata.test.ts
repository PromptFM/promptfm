// tests/unit/audio-metadata.test.ts
// Unit tests for PromptFM Audio Metadata & Tag Extraction Service

import { describe, it, expect } from 'vitest';
import {
  matchCategory,
  normalizeExtractedMetadata,
  DEFAULT_TRACK_ICON,
  type ExtractedAudioMetadata,
} from '@/lib/audio/metadata';
import { STATION_CATEGORIES } from '@/types/database';

describe('Audio Metadata Extraction & Categorization', () => {
  describe('matchCategory', () => {
    it('matches known genre tags to official PromptFM station categories', () => {
      expect(matchCategory('synthwave')).toBe('Synthwave & Electro');
      expect(matchCategory('Electro Pop')).toBe('Synthwave & Electro');
      expect(matchCategory('Lofi Chill')).toBe('Ambient & Lo-Fi');
      expect(matchCategory('Cyberpunk Industrial')).toBe('Cyberpunk & Industrial');
      expect(matchCategory('Chiptune')).toBe('Chiptune & 8-Bit');
      expect(matchCategory('Dance EDM')).toBe('EDM & Dance');
      expect(matchCategory('Heavy Metal')).toBe('Rock & Metal');
      expect(matchCategory('Cinematic Symphony')).toBe('Cinematic & Classical');
      expect(matchCategory('Hip Hop Beats')).toBe('Hip-Hop & Beats');
    });

    it('defaults unknown genres to Synthwave & Electro or Other / Experimental', () => {
      expect(matchCategory('random unmapped genre')).toBe('Other / Experimental');
      expect(matchCategory(undefined)).toBe('Synthwave & Electro');
    });
  });

  describe('normalizeExtractedMetadata', () => {
    it('normalizes full metadata with embedded cover picture and lyrics', () => {
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

      const result = normalizeExtractedMetadata(mockRaw, 'neon_nights_final.mp3');

      expect(result.title).toBe('Neon Nights');
      expect(result.artist).toBe('CyberUnit 9');
      expect(result.category).toBe('Synthwave & Electro');
      expect(result.description).toContain('Generated with Suno v3');
      expect(result.lyrics).toContain('Walking down the neon street');
      expect(result.hasCoverArt).toBe(true);
      expect(result.coverArtUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(result.defaultIcon).toBe(DEFAULT_TRACK_ICON);
    });

    it('falls back gracefully to filename and defaults when tags are missing', () => {
      const result = normalizeExtractedMetadata({}, 'Neon_City_Cruise_128kbps.mp3');

      expect(result.title).toBe('Neon City Cruise');
      expect(result.artist).toBe('PromptFM Resident');
      expect(result.category).toBe('Synthwave & Electro');
      expect(result.description).toBeNull();
      expect(result.lyrics).toBeNull();
      expect(result.hasCoverArt).toBe(false);
      expect(result.coverArtUrl).toBe(DEFAULT_TRACK_ICON);
      expect(result.defaultIcon).toBe(DEFAULT_TRACK_ICON);
    });
  });
});

