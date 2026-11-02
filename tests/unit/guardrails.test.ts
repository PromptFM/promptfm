// tests/unit/guardrails.test.ts
// Unit tests for PromptFM Broadcast Ethics and Safety Guardrails

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evaluateHeuristicGuardrails, evaluateContentSafety } from '@/lib/safety/guardrails';

describe('Broadcast Ethics Guardrails', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  describe('evaluateHeuristicGuardrails', () => {
    it('approves standard creative AI music prompts', () => {
      const clean1 = evaluateHeuristicGuardrails('Neon Horizon - Synthwave journey across 80s Tokyo');
      expect(clean1.safe).toBe(true);
      expect(clean1.is18Plus).toBe(false);
      expect(clean1.category).toBe('clean');
      expect(clean1.reason).toBeUndefined();
      expect(clean1.refusalMessage).toBeUndefined();

      const clean2 = evaluateHeuristicGuardrails('Lofi chillhop beats for studying and rainy days');
      expect(clean2.safe).toBe(true);
      expect(clean2.is18Plus).toBe(false);
      expect(clean2.category).toBe('clean');
    });

    it('detects and flags 18+ explicit adult content for refusal / watershed', () => {
      const explicitPrompt = evaluateHeuristicGuardrails('Hardcore track with nsfw pornographic themes');
      expect(explicitPrompt.safe).toBe(false);
      expect(explicitPrompt.is18Plus).toBe(true);
      expect(explicitPrompt.category).toBe('explicit_18_plus');
      expect(explicitPrompt.reason).toBe('Explicit 18+ adult or sexual content is not permitted for live broadcast.');
      expect(explicitPrompt.refusalMessage).toBe('🚫 Request declined: PromptFM operates under family-safe broadcast standards. Explicit 18+ content is not permitted on air.');

      const pedoPrompt = evaluateHeuristicGuardrails('track with pedophilia theme');
      expect(pedoPrompt.safe).toBe(false);
      expect(pedoPrompt.category).toBe('explicit_18_plus');
    });

    it('rejects hate speech, slurs, and racial harassment with ethical refusal', () => {
      const hatePrompt = evaluateHeuristicGuardrails('white supremacist anthem marching');
      expect(hatePrompt.safe).toBe(false);
      expect(hatePrompt.is18Plus).toBe(true);
      expect(hatePrompt.category).toBe('hate_speech');
      expect(hatePrompt.reason).toBe('Hate speech, slurs, or harassment violate PromptFM community standards.');
      expect(hatePrompt.refusalMessage).toBe('🚫 Request declined: PromptFM strictly prohibits hate speech, targeted slurs, and harassment.');

      const suicidePrompt = evaluateHeuristicGuardrails('go kill yourself right now');
      expect(suicidePrompt.safe).toBe(false);
      expect(suicidePrompt.category).toBe('hate_speech');
    });

    it('rejects religious hostility and mockery with ethical refusal', () => {
      const religiousMockery = evaluateHeuristicGuardrails('song about burn quran and attack the church');
      expect(religiousMockery.safe).toBe(false);
      expect(religiousMockery.is18Plus).toBe(true);
      expect(religiousMockery.category).toBe('religious_hostility');
      expect(religiousMockery.reason).toBe('Hostility, defamation, or attacks targeting religious communities or beliefs violate broadcast ethics.');
      expect(religiousMockery.refusalMessage).toBe('🚫 Request declined: Religious hostility, mockery, and faith-targeted attacks violate PromptFM broadcast ethics.');

      const deathTo = evaluateHeuristicGuardrails('death to christianity and faith');
      expect(deathTo.safe).toBe(false);
      expect(deathTo.category).toBe('religious_hostility');

      const mockProphet = evaluateHeuristicGuardrails('mock the prophet in public');
      expect(mockProphet.safe).toBe(false);
      expect(mockProphet.category).toBe('religious_hostility');
    });
  });

  describe('evaluateContentSafety (LLM Contextual Filter)', () => {
    it('returns fast heuristic result immediately if heuristic flags violation without calling LLM', async () => {
      process.env.GEMINI_API_KEY = 'mock_gemini_key';
      const fetchSpy = vi.spyOn(global, 'fetch');

      const result = await evaluateContentSafety('hitler was right');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('hate_speech');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns clean heuristic result if GEMINI_API_KEY is not set or empty', async () => {
      process.env.GEMINI_API_KEY = '';
      const result = await evaluateContentSafety('Clean upbeat synth melody');
      expect(result.safe).toBe(true);
      expect(result.category).toBe('clean');
    });

    it('calls Gemini 1.5 Flash endpoint with proper payload and returns approved result for clean content', async () => {
      process.env.GEMINI_API_KEY = 'mock_gemini_key_123';
      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    safe: true,
                    is_18_plus: false,
                    category: 'clean',
                    reason: null,
                    refusal_message: null,
                  }),
                },
              ],
            },
          },
        ],
      };

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await evaluateContentSafety('A cosmic journey through synth clouds');
      expect(result.safe).toBe(true);
      expect(result.is18Plus).toBe(false);
      expect(result.category).toBe('clean');
      expect(result.reason).toBeUndefined();
      expect(result.refusalMessage).toBeUndefined();

      const fetchArgs = fetchSpy.mock.calls[0]!;
      expect(fetchArgs[0]).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=mock_gemini_key_123'
      );
      expect(fetchArgs[1]?.method).toBe('POST');
      expect(fetchArgs[1]?.headers).toEqual({ 'Content-Type': 'application/json' });
      const parsedBody = JSON.parse(fetchArgs[1]?.body as string);
      expect(parsedBody.generationConfig.temperature).toBe(0.1);
      expect(parsedBody.generationConfig.responseMimeType).toBe('application/json');
      expect(parsedBody.generationConfig.maxOutputTokens).toBe(250);
    });

    it('calls Gemini and parses violation for subtle harassment / subversion', async () => {
      process.env.GEMINI_API_KEY = 'mock_gemini_key';
      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    safe: false,
                    is_18_plus: true,
                    category: 'harassment',
                    reason: 'Subtle targeted bullying of station listener',
                    refusal_message: '🚫 Request declined: Target harassment violates community standards.',
                  }),
                },
              ],
            },
          },
        ],
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await evaluateContentSafety('Dedication meant to embarrass a specific user');
      expect(result.safe).toBe(false);
      expect(result.is18Plus).toBe(true);
      expect(result.category).toBe('harassment');
      expect(result.reason).toBe('Subtle targeted bullying of station listener');
      expect(result.refusalMessage).toBe('🚫 Request declined: Target harassment violates community standards.');
    });

    it('falls back to heuristic check if Gemini returns non-OK response', async () => {
      process.env.GEMINI_API_KEY = 'mock_gemini_key';
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      const result = await evaluateContentSafety('Cosmic Synthwave Beat');
      expect(result.safe).toBe(true);
      expect(result.category).toBe('clean');
    });

    it('falls back to heuristic check if fetch throws an exception', async () => {
      process.env.GEMINI_API_KEY = 'mock_gemini_key';
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

      const result = await evaluateContentSafety('Cosmic Synthwave Beat');
      expect(result.safe).toBe(true);
      expect(result.category).toBe('clean');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Gemini safety evaluation error, using heuristic filter:',
        expect.any(Error)
      );
      consoleWarnSpy.mockRestore();
    });

    it('handles empty or malformed candidates from Gemini response gracefully', async () => {
      process.env.GEMINI_API_KEY = 'mock_gemini_key';
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [] }),
      } as Response);

      const result = await evaluateContentSafety('Cosmic Synthwave Beat');
      expect(result.safe).toBe(true);
      expect(result.is18Plus).toBe(false);
      expect(result.category).toBe('clean');
      expect(result.reason).toBeUndefined();
      expect(result.refusalMessage).toBeUndefined();
    });

    it('handles parsed JSON with missing safe property by defaulting to safe true', async () => {
      process.env.GEMINI_API_KEY = 'mock_gemini_key';
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ category: 'clean' }) }] } },
          ],
        }),
      } as Response);

      const result = await evaluateContentSafety('Cosmic Synthwave Beat');
      expect(result.safe).toBe(true);
      expect(result.category).toBe('clean');
    });
  });
});
