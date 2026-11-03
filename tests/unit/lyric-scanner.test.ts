// tests/unit/lyric-scanner.test.ts
// Unit tests for Token-Efficient Lyric & Content Scanning (Gemini 3.5 Flash & Heuristics)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scanLyricsAndContent,
  isChannelPermittedForTrack,
  detectObviousProfanity,
  determineAllowedChannels,
} from '@/lib/safety/lyric-scanner';

describe('Token-Efficient AI Lyric & Content Scanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Local Heuristic Pre-Filter (0 Tokens Consumed)', () => {
    it('detects obvious profanity and flags is_explicit: true with 0 tokens', async () => {
      const result = await scanLyricsAndContent({
        title: 'Dirty Track',
        lyrics: 'This is a song with damn shit and fuck words everywhere',
      });

      expect(result.is_explicit).toBe(true);
      expect(result.family_friendly).toBe(false);
      expect(result.flags).toEqual(['profanity_detected']);
      expect(result.method).toBe('heuristic_zero_token');
      expect(result.tokens_used).toBe(0);

      // Explicit tracks are NOT allowed on Kids (channel 4) or Chillout (channel 3)
      expect(result.allowed_channels).toEqual(['main', 'cyberpunk']);
    });

    it('detects profanity present in title or description even if lyrics are clean', async () => {
      const result = await scanLyricsAndContent({
        title: 'Total Asshole Antics',
        description: 'Some background description with whore notes',
        lyrics: 'Just some innocent melody line singing lalala',
      });

      expect(result.is_explicit).toBe(true);
      expect(result.family_friendly).toBe(false);
      expect(result.flags).toEqual(['profanity_detected']);
      expect(result.method).toBe('heuristic_zero_token');
    });

    it('classifies instrumental or clean short lyrics as family friendly with 0 tokens', async () => {
      const resultEmpty = await scanLyricsAndContent({
        title: 'Morning Breeze',
        lyrics: '', // Instrumental / no lyrics
      });

      expect(resultEmpty.is_explicit).toBe(false);
      expect(resultEmpty.family_friendly).toBe(true);
      expect(resultEmpty.flags).toEqual(['instrumental_or_clean']);
      expect(resultEmpty.method).toBe('instrumental_clean');
      expect(resultEmpty.tokens_used).toBe(0);

      // Boundary check: exactly 9 chars (< 10)
      const resultShort = await scanLyricsAndContent({
        title: 'Short Tune',
        lyrics: 'La la la!',
      });
      expect(resultShort.method).toBe('instrumental_clean');
    });

    it('detectObviousProfanity catches severe profanity variants and handles empty text', () => {
      expect(detectObviousProfanity('')).toBe(false);
      expect(detectObviousProfanity('What the fuck is this')).toBe(true);
      expect(detectObviousProfanity('Complete bullshit here')).toBe(true);
      expect(detectObviousProfanity('bitch please')).toBe(true);
      expect(detectObviousProfanity('asshole driver')).toBe(true);
      expect(detectObviousProfanity('nasty cunt')).toBe(true);
      expect(detectObviousProfanity('big cock')).toBe(true);
      expect(detectObviousProfanity('slutty vibes')).toBe(true);
      expect(detectObviousProfanity('motherfucker')).toBe(true);
      expect(detectObviousProfanity('A peaceful starry night')).toBe(false);
      expect(detectObviousProfanity('Sunshine and butterflies')).toBe(false);
    });
  });

  describe('Channel Airplay Permissions (Channels 1, 3, 4)', () => {
    it('determines allowed channels accurately based on flags', () => {
      // Family-friendly track: allowed on ALL channels including 1, 3, 4
      const familyChannels = determineAllowedChannels({
        is_explicit: false,
        family_friendly: true,
      });
      expect(familyChannels).toEqual(['main', 'cyberpunk', 'chillout', 'kids']);

      // Explicit track: only allowed on main (1) and cyberpunk (2) during watershed; banned from 3 and 4
      const explicitChannels = determineAllowedChannels({
        is_explicit: true,
        family_friendly: false,
      });
      expect(explicitChannels).toEqual(['main', 'cyberpunk']);

      // Clean general track (not strictly kids-family, but not explicit): allowed on 1, 2, 3; banned from 4
      const generalChannels = determineAllowedChannels({
        is_explicit: false,
        family_friendly: false,
      });
      expect(generalChannels).toEqual(['main', 'cyberpunk', 'chillout']);
    });

    it('isChannelPermittedForTrack validates specific channel playback with case insensitivity', () => {
      const cleanFamilyTrack = { is_explicit: false, family_friendly: true };
      const cleanGeneralTrack = { is_explicit: false, family_friendly: false };
      const explicitTrack = { is_explicit: true, family_friendly: false };

      // Channel 4 (Kids) requires family_friendly AND non-explicit
      expect(isChannelPermittedForTrack('kids', cleanFamilyTrack)).toBe(true);
      expect(isChannelPermittedForTrack('  KIDS  ', cleanFamilyTrack)).toBe(true);
      expect(isChannelPermittedForTrack('kids', cleanGeneralTrack)).toBe(false);
      expect(isChannelPermittedForTrack('kids', explicitTrack)).toBe(false);

      // Channel 3 (Chillout) forbids explicit
      expect(isChannelPermittedForTrack('chillout', cleanFamilyTrack)).toBe(true);
      expect(isChannelPermittedForTrack('chillout', cleanGeneralTrack)).toBe(true);
      expect(isChannelPermittedForTrack('chillout', explicitTrack)).toBe(false);

      // Channel 1 (Main)
      expect(isChannelPermittedForTrack('main', cleanFamilyTrack)).toBe(true);
      expect(isChannelPermittedForTrack('main', cleanGeneralTrack)).toBe(true);
      expect(isChannelPermittedForTrack('main', explicitTrack)).toBe(true);

      // Unknown or non-existent channel returns false
      expect(isChannelPermittedForTrack('unknown-channel', cleanFamilyTrack)).toBe(false);
      expect(isChannelPermittedForTrack('unknown-channel', explicitTrack)).toBe(false);
    });
  });

  describe('Gemini 3.5 Flash Token-Optimized Scan', () => {
    it('uses Gemini 3.5 Flash with minimal tokens when lyrics need nuanced semantic analysis', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ explicit: false, family_friendly: true }) }],
              },
            },
          ],
          usageMetadata: {
            totalTokenCount: 65,
          },
        }),
      });
      global.fetch = fakeFetch as unknown as typeof fetch;

      const longLyrics = 'Twinkle twinkle little star, how I wonder what you are. Up above the world so high, like a diamond in the sky. '.repeat(10);
      const result = await scanLyricsAndContent(
        {
          title: 'Little Star In The Sky',
          lyrics: longLyrics,
        },
        'mock-api-key'
      );

      expect(result.is_explicit).toBe(false);
      expect(result.family_friendly).toBe(true);
      expect(result.flags).toEqual(['family_friendly']);
      expect(result.method).toBe('ai_gemini_flash');
      expect(result.tokens_used).toBe(65);
      expect(result.allowed_channels).toEqual(['main', 'cyberpunk', 'chillout', 'kids']);

      // Verify Gemini API endpoint and model
      expect(fakeFetch).toHaveBeenCalled();
      const calledUrl = fakeFetch.mock.calls[0]![0] as string;
      expect(calledUrl).toContain('gemini-3.5-flash');

      const calledBody = JSON.parse(fakeFetch.mock.calls[0]![1]!.body as string);
      expect(calledBody.generationConfig?.thinkingConfig?.thinkingBudget).toBe(0);
      expect(calledBody.generationConfig?.maxOutputTokens).toBe(25);
      // Ensure input was truncated down from 1200 chars to <= 650 chars including system template
      expect(calledBody.contents[0].parts[0].text.length).toBeLessThanOrEqual(650);
      expect(calledBody.contents[0].parts[0].text.length).toBeGreaterThan(200);
    });

    it('handles explicit detection from Gemini 3.5 Flash semantic scan', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ explicit: true, family_friendly: false }) }],
              },
            },
          ],
        }),
      });
      global.fetch = fakeFetch as unknown as typeof fetch;

      const result = await scanLyricsAndContent(
        {
          title: 'Dark Alley Secrets',
          lyrics: 'Shadows in the dark, selling illicit contraband and violence in the city ruins.',
        },
        'mock-api-key'
      );

      expect(result.is_explicit).toBe(true);
      expect(result.family_friendly).toBe(false);
      expect(result.flags).toEqual(['explicit_content']);
      expect(result.allowed_channels).toEqual(['main', 'cyberpunk']);
      // Fallback tokens used when usageMetadata is omitted
      expect(result.tokens_used).toBe(50);
    });

    it('handles non-family general lyrics from Gemini 3.5 Flash scan', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ explicit: false, family_friendly: false }) }],
              },
            },
          ],
        }),
      });
      global.fetch = fakeFetch as unknown as typeof fetch;

      const result = await scanLyricsAndContent(
        {
          title: 'Melancholy Rain',
          lyrics: 'Walking alone under gray clouds remembering lost times and broken promises.',
        },
        'mock-api-key'
      );

      expect(result.is_explicit).toBe(false);
      expect(result.family_friendly).toBe(false);
      expect(result.flags).toEqual([]);
      expect(result.allowed_channels).toEqual(['main', 'cyberpunk', 'chillout']);
    });

    it('prevents conflicting family_friendly tag when explicit is true from Gemini', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ explicit: true, family_friendly: true }) }],
              },
            },
          ],
        }),
      });
      global.fetch = fakeFetch as unknown as typeof fetch;

      const result = await scanLyricsAndContent(
        {
          title: 'Contradictory Track',
          lyrics: 'Singing happy tunes with violent explicit adult themes.',
        },
        'mock-api-key'
      );

      // Must NOT be family friendly if explicit
      expect(result.is_explicit).toBe(true);
      expect(result.family_friendly).toBe(false);
      expect(result.flags).toEqual(['explicit_content']);
    });

    it('falls back to zero-token heuristic when no API key is provided', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const result = await scanLyricsAndContent(
        {
          title: 'Simple Clean Song',
          lyrics: 'A wonderful sunny day in the park with friends singing along.',
        },
        '' // Empty key override
      );

      expect(result.is_explicit).toBe(false);
      expect(result.family_friendly).toBe(true);
      expect(result.flags).toEqual(['clean_fallback']);
      expect(result.method).toBe('heuristic_zero_token');
      expect(result.tokens_used).toBe(0);

      process.env.GEMINI_API_KEY = originalKey;
    });

    it('falls back gracefully to safe defaults if Gemini API returns HTTP error or fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await scanLyricsAndContent(
        {
          title: 'Dreamy Horizon',
          lyrics: 'Floating through the golden clouds at sunrise, feeling the gentle breeze.',
        },
        'mock-api-key'
      );

      expect(result.is_explicit).toBe(false);
      expect(result.family_friendly).toBe(true);
      expect(result.flags).toEqual(['scan_fallback']);
      expect(result.method).toBe('heuristic_zero_token');
      expect(result.allowed_channels).toEqual(['main', 'cyberpunk', 'chillout', 'kids']);
      expect(result.tokens_used).toBe(0);
    });
  });
});
