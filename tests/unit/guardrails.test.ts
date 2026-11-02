// tests/unit/guardrails.test.ts
// Unit tests for the Broadcast Ethics and Safety Guardrails

import { describe, it, expect } from 'vitest';
import { evaluateHeuristicGuardrails } from '@/lib/safety/guardrails';

describe('Broadcast Ethics Guardrails (Heuristics)', () => {
  it('approves standard creative AI music prompts', () => {
    const clean1 = evaluateHeuristicGuardrails('Neon Horizon - Synthwave journey across 80s Tokyo');
    expect(clean1.safe).toBe(true);
    expect(clean1.is18Plus).toBe(false);
    expect(clean1.category).toBe('clean');

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
    expect(explicitPrompt.refusalMessage).toContain('18+');
  });

  it('rejects hate speech, slurs, and racial harassment with ethical refusal', () => {
    const hatePrompt = evaluateHeuristicGuardrails('white supremacist anthem marching');
    expect(hatePrompt.safe).toBe(false);
    expect(hatePrompt.category).toBe('hate_speech');
    expect(hatePrompt.refusalMessage).toContain('strictly prohibits hate speech');
  });

  it('rejects religious hostility and mockery with ethical refusal', () => {
    const religiousMockery = evaluateHeuristicGuardrails('song about burn quran and attack the church');
    expect(religiousMockery.safe).toBe(false);
    expect(religiousMockery.category).toBe('religious_hostility');
    expect(religiousMockery.refusalMessage).toContain('Religious hostility');
  });
});
