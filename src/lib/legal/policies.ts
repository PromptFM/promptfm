// src/lib/legal/policies.ts
// PromptFM Comprehensive Legal Framework, Copyright Shield & DMCA Safe Harbor Policies
// Complies with 17 U.S.C. § 512, European Digital Services Act (DSA), and international safe harbors.

export interface DesignatedAgentInfo {
  name: string;
  organization: string;
  title: string;
  email: string;
  address: string;
  phone: string;
  statute: string;
}

export const DMCA_DESIGNATED_AGENT: DesignatedAgentInfo = {
  name: 'PromptFM Copyright Compliance Officer',
  organization: 'PromptFM Audio Network',
  title: 'Designated DMCA Agent',
  email: 'dmca@promptfm.live',
  address: 'PromptFM Legal Compliance, 13101 Preston Rd, Suite 110, Dallas, TX 75240, USA',
  phone: '+1 (800) 555-0199',
  statute: '17 U.S.C. § 512(c)',
};

export const DMCA_STATUTORY_REQUIREMENTS: readonly string[] = [
  'A physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.',
  'Identification of the copyrighted work claimed to have been infringed, or a representative list of works.',
  'Identification of the infringing material to be removed or disabled, with exact URL, Track ID, or airplay reference.',
  'Sufficient contact information for the complaining party (name, physical address, telephone number, and email).',
  'A statement that the complaining party has a good faith belief that use of the material is not authorized by the copyright owner, agent, or the law.',
  'A statement that the information in the notification is accurate, and under penalty of perjury, that the complaining party is authorized to act on behalf of the owner.',
];

export interface RepeatInfringerPolicy {
  maxStrikes: number;
  action: string;
  appealWindowDays: number;
}

export const REPEAT_INFRINGER_POLICY: RepeatInfringerPolicy = {
  maxStrikes: 2,
  action: 'permanent termination of account, IP blacklist, and immediate ban from broadcasting or uploading',
  appealWindowDays: 14,
};

export interface CounterNoticeRequirements {
  minWaitBusinessDays: number;
  maxWaitBusinessDays: number;
  courtActionRequired: boolean;
}

export const COUNTER_NOTICE_REQUIREMENTS: CounterNoticeRequirements = {
  minWaitBusinessDays: 10,
  maxWaitBusinessDays: 14,
  courtActionRequired: true,
};

export const INDEMNIFICATION_TERMS: string =
  'Uploader agrees to indemnify, defend, and hold harmless PromptFM, its operators, foundation providers, officers, agents, and community moderators from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys fees) arising out of or related to: (a) any track, prompt, lyrics, cover art, or metadata submitted; (b) any claim of copyright infringement, trademark dilution, or violation of publicity rights; and (c) any violation of these terms.';

export interface CommercialAiLicenseWarranty {
  supportedTools: readonly string[];
  requiresCommercialTier: boolean;
  prohibitsUnauthorizedClones: boolean;
}

export const COMMERCIAL_AI_LICENSE_WARRANTY: CommercialAiLicenseWarranty = {
  supportedTools: ['Suno', 'Udio', 'Stable Audio', 'Custom/Open-Weights'],
  requiresCommercialTier: true,
  prohibitsUnauthorizedClones: true,
};

export const AI_MUSIC_DISCLAIMER: string =
  'PromptFM is an autonomous internet radio platform streaming 100% user-prompted, AI-generated compositions. PromptFM does not train foundation AI models and claims no ownership over third-party musical compositions. All AI audio is streamed under commercial broadcast grants from submitters in compliance with 17 U.S.C. § 512.';

export interface DmcaNoticePayload {
  copyrightOwner: string;
  claimantName: string;
  claimantEmail: string;
  workDescription: string;
  infringingIdentifier: string;
  goodFaithStatement: boolean;
  perjuryStatement: boolean;
  signature: string;
  details?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a submitted DMCA takedown notice against 17 U.S.C. § 512(c)(3) requirements.
 */
export function validateDmcaNoticePayload(payload: DmcaNoticePayload): ValidationResult {
  const errors: string[] = [];

  if (!payload.copyrightOwner || !payload.copyrightOwner.trim()) {
    errors.push('Identification of the copyright owner or work is required');
  }

  if (!payload.claimantName || !payload.claimantName.trim()) {
    errors.push('Full legal name of claimant or authorized representative is required');
  }

  if (!payload.claimantEmail || !EMAIL_REGEX.test(payload.claimantEmail.trim())) {
    errors.push('A valid claimant contact email address is required');
  }

  if (!payload.workDescription || !payload.workDescription.trim()) {
    errors.push('Description of the copyrighted work is required');
  }

  if (!payload.infringingIdentifier || !payload.infringingIdentifier.trim()) {
    errors.push('Identification of the claimed infringing track or URL is required');
  }

  if (!payload.goodFaithStatement) {
    errors.push('Good faith statement is legally required under 17 U.S.C. § 512(c)(3)(A)(v)');
  }

  if (!payload.perjuryStatement) {
    errors.push('Penalty of perjury statement is legally required under 17 U.S.C. § 512(c)(3)(A)(vi)');
  }

  if (!payload.signature || !payload.signature.trim()) {
    errors.push('Physical or electronic signature is legally required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface CounterNoticePayload {
  uploaderName: string;
  uploaderEmail: string;
  uploaderAddress: string;
  trackIdentifier: string;
  mistakeStatement: boolean;
  jurisdictionConsent: boolean;
  signature: string;
  details?: string;
}

/**
 * Validates a DMCA counter-notice against 17 U.S.C. § 512(g)(3) requirements.
 */
export function validateCounterNoticePayload(payload: CounterNoticePayload): ValidationResult {
  const errors: string[] = [];

  if (!payload.uploaderName || !payload.uploaderName.trim()) {
    errors.push('Uploader full name is required');
  }

  if (!payload.uploaderEmail || !EMAIL_REGEX.test(payload.uploaderEmail.trim())) {
    errors.push('Valid contact email is required');
  }

  if (!payload.uploaderAddress || !payload.uploaderAddress.trim()) {
    errors.push('Physical postal address is required');
  }

  if (!payload.trackIdentifier || !payload.trackIdentifier.trim()) {
    errors.push('Track ID or URL of removed material is required');
  }

  if (!payload.mistakeStatement) {
    errors.push(
      'Good faith statement of mistake or misidentification is mandatory under 17 U.S.C. § 512(g)(3)(C)'
    );
  }

  if (!payload.jurisdictionConsent) {
    errors.push('Federal court jurisdiction consent is mandatory under 17 U.S.C. § 512(g)(3)(D)');
  }

  if (!payload.signature || !payload.signature.trim()) {
    errors.push('Physical or electronic signature is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ── Google AdSense & Cookie Compliance Specifications ─────────────────────────

export type CookieConsentChoice = 'accepted' | 'essential_only' | 'unset';

export interface AdSensePrivacyDisclosure {
  publisherClientId: string;
  thirdPartyVendorNotice: string;
  advertisingCookieNotice: string;
  optOutLinks: {
    googleAdsSettings: string;
    aboutAds: string;
    yourOnlineChoices: string;
  };
  ccpaNotice: string;
  gdprNotice: string;
  summaryText: string;
}

export const ADSENSE_PRIVACY_DISCLOSURE: AdSensePrivacyDisclosure = {
  publisherClientId: 'ca-pub-7299057534028491',
  thirdPartyVendorNotice:
    'Third party vendors, including Google, use cookies to serve ads based on a user\'s prior visits to your website or other websites.',
  advertisingCookieNotice:
    'Google\'s use of advertising cookies enables it and its partners to serve ads to your users based on their visit to your sites and/or other sites on the Internet.',
  optOutLinks: {
    googleAdsSettings: 'https://www.google.com/settings/ads',
    aboutAds: 'https://www.aboutads.info/choices/',
    yourOnlineChoices: 'https://www.youronlinechoices.com',
  },
  ccpaNotice:
    'Under the California Consumer Privacy Act (CCPA/CPRA), California residents have the right to opt-out of the "sale" or "sharing" of personal information for cross-context behavioral advertising (Do Not Sell or Share My Personal Information). We honor Global Privacy Control (GPC) signals and provide cookie preferences to restrict non-essential tracking.',
  gdprNotice:
    'For users in the European Economic Area (EEA), United Kingdom, and Switzerland, PromptFM adheres to the Google EU User Consent Policy. We obtain affirmative consent prior to setting non-essential advertising cookies or processing personal data for personalized advertising.',
  summaryText:
    'PromptFM partners with Google AdSense (publisher account ca-pub-7299057534028491) to serve advertisements that fund 24/7 autonomous broadcast operations and infrastructure. Cookies and local identifiers may be used to serve personalized and non-personalized advertisements.',
};

export interface CookieCategory {
  name: string;
  description: string;
  examples: readonly string[];
}

export interface CookieConsentPolicy {
  storageKey: string;
  categories: {
    essential: CookieCategory;
    advertising: CookieCategory;
  };
}

export const COOKIE_CONSENT_POLICY: CookieConsentPolicy = {
  storageKey: 'promptfm_cookie_consent',
  categories: {
    essential: {
      name: 'Strictly Necessary & Functional',
      description: 'Required for core radio stream playback, channel switching, volume, and statutory age gating.',
      examples: ['active_channel', 'player_volume', 'promptfm_age_verified_18', 'promptfm_cookie_consent'],
    },
    advertising: {
      name: 'Advertising & Measurement',
      description: 'Used by Google AdSense and ad partners to frequency-cap ads, measure ad performance, and serve relevant promotions.',
      examples: ['__gads', '__gpi', 'IDE', 'test_cookie'],
    },
  },
};

export function resolveCookieConsent(val: unknown): CookieConsentChoice {
  if (val === 'accepted' || val === 'essential_only') {
    return val;
  }
  return 'unset';
}

export function allowsPersonalizedAds(choice: CookieConsentChoice): boolean {
  return choice === 'accepted';
}



