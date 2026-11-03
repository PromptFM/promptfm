// tests/unit/channel-guardrails.test.ts
// Unit tests for PromptFM Channel Guardrails & Automated 18+ Age Gate Protection

import { describe, it, expect } from 'vitest';
import {
  autoGenerateChannelGuardrails,
  DEFAULT_18_PLUS_LEGAL_DISCLAIMER,
  verifyUserAgeCompliance,
  type ChannelGuardrails,
} from '@/lib/safety/channel-guardrails';
import { getAllChannels, getChannelBySlug, isValidChannelSlug } from '@/lib/radio/channels';
import { isContentAllowedForAirplay } from '@/lib/dj/roster';

describe('Channel Guardrails & 18+ Age Gate Protection', () => {
  describe('autoGenerateChannelGuardrails', () => {
    it('automatically generates 18+ age gate and disclaimer when is18Plus is true', () => {
      const guardrails = autoGenerateChannelGuardrails({ is18Plus: true });

      expect(guardrails.min_age).toBe(18);
      expect(guardrails.requires_age_gate).toBe(true);
      expect(guardrails.allow_explicit_24_7).toBe(true);
      expect(guardrails.is_family_safe).toBe(false);
      expect(guardrails.age_gate_disclaimer).toBe(DEFAULT_18_PLUS_LEGAL_DISCLAIMER);
      expect(guardrails.age_gate_disclaimer).toContain('18 years of age');
      expect(guardrails.age_gate_disclaimer).toContain('adult content');
    });

    it('respects custom legal disclaimer when provided for 18+ channel', () => {
      const customText = 'Custom adult station disclaimer: Listeners must be 21+ in this state.';
      const guardrails = autoGenerateChannelGuardrails({
        is18Plus: true,
        customDisclaimer: customText,
      });

      expect(guardrails.min_age).toBe(18);
      expect(guardrails.age_gate_disclaimer).toBe(customText);
    });

    it('automatically configures all-ages family safe channel when is18Plus is false', () => {
      const guardrails = autoGenerateChannelGuardrails({ is18Plus: false });

      expect(guardrails.min_age).toBe(0);
      expect(guardrails.requires_age_gate).toBe(false);
      expect(guardrails.allow_explicit_24_7).toBe(false);
      expect(guardrails.is_family_safe).toBe(true);
      expect(guardrails.age_gate_disclaimer).toBe('');
    });

    it('automatically triggers 18+ settings if minAge is set to 18 or higher', () => {
      const guardrails = autoGenerateChannelGuardrails({ minAge: 21 });

      expect(guardrails.min_age).toBe(21);
      expect(guardrails.requires_age_gate).toBe(true);
      expect(guardrails.allow_explicit_24_7).toBe(true);
      expect(guardrails.is_family_safe).toBe(false);
    });

    it('triggers 18+ guardrails when allowExplicit247 is explicitly true', () => {
      const guardrails = autoGenerateChannelGuardrails({ allowExplicit247: true });

      expect(guardrails.min_age).toBe(18);
      expect(guardrails.requires_age_gate).toBe(true);
      expect(guardrails.allow_explicit_24_7).toBe(true);
      expect(guardrails.is_family_safe).toBe(false);
    });

    it('handles minAge under 18 without explicit adult flags', () => {
      const guardrails = autoGenerateChannelGuardrails({ minAge: 12 });

      expect(guardrails.min_age).toBe(0);
      expect(guardrails.requires_age_gate).toBe(false);
      expect(guardrails.allow_explicit_24_7).toBe(false);
      expect(guardrails.is_family_safe).toBe(true);
    });
  });

  describe('verifyUserAgeCompliance', () => {
    const ageRestrictedChannel: ChannelGuardrails = {
      min_age: 18,
      requires_age_gate: true,
      allow_explicit_24_7: true,
      is_family_safe: false,
      age_gate_disclaimer: DEFAULT_18_PLUS_LEGAL_DISCLAIMER,
    };

    const generalChannel: ChannelGuardrails = {
      min_age: 0,
      requires_age_gate: false,
      allow_explicit_24_7: false,
      is_family_safe: true,
      age_gate_disclaimer: '',
    };

    it('always permits access to general channels without age gate', () => {
      const res = verifyUserAgeCompliance(generalChannel, {
        isLoggedIn: false,
        hasAcceptedDisclaimer: false,
      });
      expect(res.allowed).toBe(true);
      expect(res.requiresAction).toBe(false);
    });

    it('blocks unverified user from age-restricted channel', () => {
      const res = verifyUserAgeCompliance(ageRestrictedChannel, {
        isLoggedIn: false,
        hasAcceptedDisclaimer: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.requiresAction).toBe(true);
      expect(res.disclaimer).toBe(DEFAULT_18_PLUS_LEGAL_DISCLAIMER);
    });

    it('permits user who accepted the legal age gate disclaimer', () => {
      const res = verifyUserAgeCompliance(ageRestrictedChannel, {
        isLoggedIn: false,
        hasAcceptedDisclaimer: true,
      });
      expect(res.allowed).toBe(true);
      expect(res.requiresAction).toBe(false);
    });

    it('permits signed-in user with confirmed adult status or age >= 18', () => {
      const resWithAge = verifyUserAgeCompliance(ageRestrictedChannel, {
        isLoggedIn: true,
        userAge: 24,
        hasAcceptedDisclaimer: false,
      });
      expect(resWithAge.allowed).toBe(true);
      expect(resWithAge.requiresAction).toBe(false);

      // Exact boundary at min_age (18)
      const resExactBoundary = verifyUserAgeCompliance(ageRestrictedChannel, {
        isLoggedIn: true,
        userAge: 18,
        hasAcceptedDisclaimer: false,
      });
      expect(resExactBoundary.allowed).toBe(true);
      expect(resExactBoundary.requiresAction).toBe(false);

      const resWithFlag = verifyUserAgeCompliance(ageRestrictedChannel, {
        isLoggedIn: true,
        isAdultConfirmed: true,
        hasAcceptedDisclaimer: false,
      });
      expect(resWithFlag.allowed).toBe(true);
      expect(resWithFlag.requiresAction).toBe(false);
    });

    it('blocks signed-in user if explicit age is under 18', () => {
      const res = verifyUserAgeCompliance(ageRestrictedChannel, {
        isLoggedIn: true,
        userAge: 16,
        hasAcceptedDisclaimer: true, // Age takes precedence if known
      });
      expect(res.allowed).toBe(false);
      expect(res.requiresAction).toBe(false);
      expect(res.disclaimer).toBe(DEFAULT_18_PLUS_LEGAL_DISCLAIMER);
    });

    it('falls back to default statutory disclaimer when age-gated channel has empty disclaimer', () => {
      const emptyDisclaimerChannel: ChannelGuardrails = {
        min_age: 18,
        requires_age_gate: true,
        allow_explicit_24_7: true,
        is_family_safe: false,
        age_gate_disclaimer: '',
      };

      const res = verifyUserAgeCompliance(emptyDisclaimerChannel, {
        isLoggedIn: false,
        userAge: null,
        hasAcceptedDisclaimer: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.requiresAction).toBe(true);
      expect(res.disclaimer).toBe(DEFAULT_18_PLUS_LEGAL_DISCLAIMER);
    });

    it('correctly requires action when user has userAge null or undefined', () => {
      const resNull = verifyUserAgeCompliance(ageRestrictedChannel, {
        isLoggedIn: true,
        userAge: null,
        hasAcceptedDisclaimer: false,
      });
      expect(resNull.allowed).toBe(false);
      expect(resNull.requiresAction).toBe(true);

      const resUndefined = verifyUserAgeCompliance(ageRestrictedChannel, {
        isLoggedIn: true,
        userAge: undefined,
        hasAcceptedDisclaimer: false,
      });
      expect(resUndefined.allowed).toBe(false);
      expect(resUndefined.requiresAction).toBe(true);
    });
  });

  describe('Official After Dark 18+ Channel', () => {
    it('includes afterdark in official channels list with 18+ configuration', () => {
      const channels = getAllChannels();
      const afterdark = channels.find((c) => c.slug === 'afterdark');

      expect(afterdark).toBeDefined();
      expect(afterdark?.isFamilySafe).toBe(false);
      expect(afterdark?.minAge).toBe(18);
      expect(afterdark?.requiresAgeGate).toBe(true);
      expect(afterdark?.allowExplicitAllDay).toBe(true);
      expect(afterdark?.ageGateDisclaimer).toContain('18 years of age');
      expect(isValidChannelSlug('afterdark')).toBe(true);
    });

    it('resolves afterdark by slug', () => {
      const channel = getChannelBySlug('afterdark');
      expect(channel.slug).toBe('afterdark');
      expect(channel.name).toContain('18+');
    });
  });

  describe('Airplay rotation on afterdark 24/7 explicit channel', () => {
    const middayDate = new Date('2026-11-03T13:00:00Z'); // 13:00 UTC (Daytime, outside late night watershed)

    it('permits explicit tracks all day long (24/7) on afterdark channel', () => {
      // On main channel, daytime explicit is blocked
      expect(isContentAllowedForAirplay(true, 'main', middayDate)).toBe(false);

      // On afterdark channel, daytime explicit is PERMITTED!
      expect(isContentAllowedForAirplay(true, 'afterdark', middayDate)).toBe(true);
    });
  });
});
