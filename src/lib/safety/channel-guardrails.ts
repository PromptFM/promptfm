// src/lib/safety/channel-guardrails.ts
// PromptFM Channel Guardrails & Statutory 18+ Age Verification Engine
// Protects station liability under COPPA, Section 230, and jurisdictional age-of-majority laws.

export const DEFAULT_18_PLUS_LEGAL_DISCLAIMER =
  'LEGAL AGE CONFIRMATION & CONSENT: This channel broadcasts uncensored audio containing adult language, profanity, mature themes, and adult content 24 hours a day. By proceeding, you certify under penalty of law that you are at least 18 years of age (or the legal age of majority in your jurisdiction), understand the adult nature of the programming, and affirmatively consent to receiving explicit broadcast content. If you are under 18, please select a Family Safe channel.';

export interface ChannelGuardrails {
  min_age: number;
  requires_age_gate: boolean;
  allow_explicit_24_7: boolean;
  is_family_safe: boolean;
  age_gate_disclaimer: string;
}

export interface UserComplianceContext {
  isLoggedIn: boolean;
  userAge?: number | null;
  isAdultConfirmed?: boolean;
  hasAcceptedDisclaimer?: boolean;
}

/**
 * Automatically calculates and provisions compliance guardrails for a channel.
 * Sets 18+ age gate, disclaimers, and 24/7 explicit broadcast mode when adult settings are indicated.
 */
export function autoGenerateChannelGuardrails(params: {
  is18Plus?: boolean;
  minAge?: number;
  allowExplicit247?: boolean;
  customDisclaimer?: string;
}): ChannelGuardrails {
  const isAdult = Boolean(
    params.is18Plus ||
    (params.minAge !== undefined && params.minAge >= 18) ||
    params.allowExplicit247
  );

  const minAge = params.minAge !== undefined ? params.minAge : (isAdult ? 18 : 0);

  if (isAdult) {
    return {
      min_age: minAge,
      requires_age_gate: true,
      allow_explicit_24_7: true,
      is_family_safe: false,
      age_gate_disclaimer: params.customDisclaimer?.trim() || DEFAULT_18_PLUS_LEGAL_DISCLAIMER,
    };
  }

  return {
    min_age: 0,
    requires_age_gate: false,
    allow_explicit_24_7: false,
    is_family_safe: true,
    age_gate_disclaimer: '',
  };
}

/**
 * Evaluates whether a listener satisfies the statutory age criteria to access an age-gated channel.
 */
export function verifyUserAgeCompliance(
  guardrails: ChannelGuardrails,
  user: UserComplianceContext
): { allowed: boolean; requiresAction: boolean; disclaimer?: string } {
  // General all-ages channel
  if (!guardrails.requires_age_gate && guardrails.min_age === 0) {
    return { allowed: true, requiresAction: false };
  }

  // If user profile indicates an age strictly under min_age, immediately block access
  if (user.userAge !== undefined && user.userAge !== null && user.userAge < guardrails.min_age) {
    return { allowed: false, requiresAction: false, disclaimer: guardrails.age_gate_disclaimer };
  }

  // If authenticated user has confirmed adult status in their profile
  if (user.isAdultConfirmed) {
    return { allowed: true, requiresAction: false };
  }

  // If user profile indicates age >= min_age
  if (user.userAge !== undefined && user.userAge !== null && user.userAge >= guardrails.min_age) {
    return { allowed: true, requiresAction: false };
  }

  // If user affirmatively accepted the legal age gate confirmation in session
  if (user.hasAcceptedDisclaimer) {
    return { allowed: true, requiresAction: false };
  }

  // Needs action: Display statutory age verification modal / banner
  return {
    allowed: false,
    requiresAction: true,
    disclaimer: guardrails.age_gate_disclaimer || DEFAULT_18_PLUS_LEGAL_DISCLAIMER,
  };
}
