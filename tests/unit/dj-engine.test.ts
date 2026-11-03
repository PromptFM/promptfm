// tests/unit/dj-engine.test.ts
// Unit tests for PromptFM AI DJ Engine and Gemini Voice Synthesis.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pcmToWav, generateDJScript, synthesizeDJVoice, fetchLiveHeadlines } from '@/lib/dj/engine';

describe('AI DJ Engine & Voice Synthesis', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  describe('pcmToWav helper', () => {
    it('creates a valid 44-byte RIFF WAVE header for linear PCM audio', () => {
      const dummyPcm = Buffer.alloc(4800, 0x10); // 100ms of 24kHz 16-bit mono
      const wav = pcmToWav(dummyPcm, 24000, 1);

      expect(wav.length).toBe(44 + dummyPcm.length);
      expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
      expect(wav.subarray(12, 16).toString('ascii')).toBe('fmt ');
      expect(wav.readUInt32LE(16)).toBe(16); // SubChunk1Size (PCM)
      expect(wav.readUInt16LE(20)).toBe(1); // AudioFormat 1 = PCM
      expect(wav.readUInt16LE(22)).toBe(1); // Mono = 1 channel
      expect(wav.readUInt32LE(24)).toBe(24000); // 24kHz SampleRate
      expect(wav.readUInt32LE(28)).toBe(48000); // ByteRate = 24000 * 1 * 2
      expect(wav.readUInt16LE(32)).toBe(2); // BlockAlign
      expect(wav.readUInt16LE(34)).toBe(16); // BitsPerSample
      expect(wav.subarray(36, 40).toString('ascii')).toBe('data');
      expect(wav.readUInt32LE(40)).toBe(dummyPcm.length);
    });
  });

  describe('fetchLiveHeadlines', () => {
    it('parses RSS titles and filters out invalid feeds', async () => {
      const mockXml = `
        <rss><channel>
          <item><title><![CDATA[Exciting Breakthrough in Open AI Audio Synthesis Models]]></title></item>
          <item><title>New Studio Release Beats Expectations</title></item>
          <item><title>Short</title></item>
        </channel></rss>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockXml,
      });

      const headlines = await fetchLiveHeadlines(['https://example.com/rss']);
      expect(headlines.length).toBe(2);
      expect(headlines[0]).toBe('Exciting Breakthrough in Open AI Audio Synthesis Models');
      expect(headlines[1]).toBe('New Studio Release Beats Expectations');
    });

    it('handles network errors gracefully in feed fetch', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const headlines = await fetchLiveHeadlines(['https://invalid.url']);
      expect(headlines).toEqual([]);
    });
  });

  describe('generateDJScript', () => {
    it('throws error when GEMINI_API_KEY is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      await expect(
        generateDJScript({ type: 'announcement', topicOrText: 'Hello' })
      ).rejects.toThrow('Missing GEMINI_API_KEY environment variable.');
    });

    it('generates ad, news, track_intro, and announcement scripts with appropriate prompts', async () => {
      process.env.GEMINI_API_KEY = 'valid-key';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Script line' }] } }],
        }),
      });
      global.fetch = mockFetch;

      const adScript = await generateDJScript({ type: 'ad', topicOrText: 'Cool sponsor' });
      expect(adScript).toBe('Script line');

      const newsScript = await generateDJScript({
        type: 'news',
        headlines: ['Head 1', 'Head 2'],
        topicOrText: 'Synth models',
      });
      expect(newsScript).toBe('Script line');

      const defaultNews = await generateDJScript({ type: 'news' });
      expect(defaultNews).toBe('Script line');

      const introScript = await generateDJScript({
        type: 'track_intro',
        trackTitle: 'Cyber Beat',
        artistName: 'Neon Wave',
        toolUsed: 'Suno',
      });
      expect(introScript).toBe('Script line');

      const announceScript = await generateDJScript({
        type: 'announcement',
        topicOrText: 'Special stream event',
      });
      expect(announceScript).toBe('Script line');
    });

    it('throws error when Gemini API response is not ok', async () => {
      process.env.GEMINI_API_KEY = 'valid-key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Quota exceeded',
      });

      await expect(
        generateDJScript({ type: 'announcement', topicOrText: 'test' })
      ).rejects.toThrow('Gemini API error: Quota exceeded');
    });
  });

  describe('synthesizeDJVoice', () => {
    it('throws error when neither GEMINI_API_KEY nor GOOGLE_TTS_API_KEY is present', async () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_TTS_API_KEY;
      await expect(synthesizeDJVoice('test')).rejects.toThrow(
        'Missing GEMINI_API_KEY or GOOGLE_TTS_API_KEY.'
      );
    });

    it('synthesizes audio using Gemini TTS model with valid key', async () => {
      process.env.GEMINI_API_KEY = 'valid-key';
      const dummyPcmBase64 = Buffer.alloc(100, 0x05).toString('base64');
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'audio/L16;codec=pcm;rate=24000',
                      data: dummyPcmBase64,
                    },
                  },
                ],
              },
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      const audioBuffer = await synthesizeDJVoice('Hello listeners');
      expect(audioBuffer.length).toBe(44 + 100);
      expect(audioBuffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
    });

    it('falls through to Google Cloud Text-to-Speech when Gemini TTS endpoint fails', async () => {
      process.env.GEMINI_API_KEY = 'valid-key';
      process.env.GOOGLE_TTS_API_KEY = 'tts-key';

      const mockFetch = vi
        .fn()
        // 1st call: Gemini TTS fails
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Gemini TTS unavailable',
        })
        // 2nd call: Google Cloud TTS succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            audioContent: Buffer.from('gcp-audio-mp3').toString('base64'),
          }),
        });
      global.fetch = mockFetch;

      const audioBuffer = await synthesizeDJVoice('Fallback test', {
        name: 'en-US-Journey-D',
        languageCode: 'en-US',
        ssmlGender: 'MALE',
        speakingRate: 1.1,
        pitch: -1.0,
      });
      expect(audioBuffer.toString('utf-8')).toBe('gcp-audio-mp3');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const gcpBody = JSON.parse(mockFetch.mock.calls[1]![1].body);
      expect(gcpBody.voice.name).toBe('en-US-Journey-D');
      expect(gcpBody.audioConfig.speakingRate).toBe(1.1);
      expect(gcpBody.audioConfig.pitch).toBe(-1.0);
    });

    it('throws error when Google Cloud TTS fails and Gemini TTS is unavailable', async () => {
      delete process.env.GEMINI_API_KEY;
      process.env.GOOGLE_TTS_API_KEY = 'tts-key';
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'TTS rate limit exceeded',
      });

      await expect(synthesizeDJVoice('Test')).rejects.toThrow(
        'Google TTS API error: TTS rate limit exceeded'
      );
    });
  });
});
