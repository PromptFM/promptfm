// tests/unit/legal-policies.test.ts
// Unit tests for PromptFM Copyright Protection, DMCA Safe Harbor,
// Commercial AI Rights, and Indemnification Policies.

import { describe, it, expect } from 'vitest';
import {
  DMCA_DESIGNATED_AGENT,
  DMCA_STATUTORY_REQUIREMENTS,
  REPEAT_INFRINGER_POLICY,
  COUNTER_NOTICE_REQUIREMENTS,
  INDEMNIFICATION_TERMS,
  AI_MUSIC_DISCLAIMER,
  COMMERCIAL_AI_LICENSE_WARRANTY,
  validateDmcaNoticePayload,
  validateCounterNoticePayload,
  type DmcaNoticePayload,
  type CounterNoticePayload,
} from '@/lib/legal/policies';

describe('PromptFM Legal & Copyright Protection Policies', () => {
  describe('DMCA Designated Agent Information (17 U.S.C. § 512(c)(2))', () => {
    it('contains all statutory contact details for the designated copyright agent', () => {
      expect(DMCA_DESIGNATED_AGENT.name).toBe('PromptFM Copyright Compliance Officer');
      expect(DMCA_DESIGNATED_AGENT.organization).toBe('PromptFM Audio Network');
      expect(DMCA_DESIGNATED_AGENT.title).toBe('Designated DMCA Agent');
      expect(DMCA_DESIGNATED_AGENT.email).toBe('dmca@promptfm.live');
      expect(DMCA_DESIGNATED_AGENT.address).toBe(
        'PromptFM Legal Compliance, 13101 Preston Rd, Suite 110, Dallas, TX 75240, USA'
      );
      expect(DMCA_DESIGNATED_AGENT.phone).toBe('+1 (800) 555-0199');
      expect(DMCA_DESIGNATED_AGENT.statute).toBe('17 U.S.C. § 512(c)');
    });
  });

  describe('Statutory 6-Point DMCA Notice Specification (17 U.S.C. § 512(c)(3))', () => {
    it('defines all 6 mandatory statutory requirements', () => {
      expect(DMCA_STATUTORY_REQUIREMENTS).toHaveLength(6);
      expect(DMCA_STATUTORY_REQUIREMENTS[0]).toContain('signature');
      expect(DMCA_STATUTORY_REQUIREMENTS[1]).toContain('copyrighted work');
      expect(DMCA_STATUTORY_REQUIREMENTS[2]).toContain('infringing material');
      expect(DMCA_STATUTORY_REQUIREMENTS[3]).toContain('contact information');
      expect(DMCA_STATUTORY_REQUIREMENTS[4]).toContain('good faith belief');
      expect(DMCA_STATUTORY_REQUIREMENTS[5]).toContain('penalty of perjury');
    });
  });

  describe('Repeat Infringer Policy (17 U.S.C. § 512(i))', () => {
    it('specifies explicit strike limit and permanent ban policy', () => {
      expect(REPEAT_INFRINGER_POLICY.maxStrikes).toBe(2);
      expect(REPEAT_INFRINGER_POLICY.action).toContain('permanent termination');
      expect(REPEAT_INFRINGER_POLICY.appealWindowDays).toBe(14);
    });
  });

  describe('Counter-Notification Specification (17 U.S.C. § 512(g))', () => {
    it('outlines 10-14 business day put-back timeline', () => {
      expect(COUNTER_NOTICE_REQUIREMENTS.minWaitBusinessDays).toBe(10);
      expect(COUNTER_NOTICE_REQUIREMENTS.maxWaitBusinessDays).toBe(14);
      expect(COUNTER_NOTICE_REQUIREMENTS.courtActionRequired).toBe(true);
    });
  });

  describe('Binding Indemnification & Commercial AI Warranties', () => {
    it('contains clear, enforceable indemnification and hold harmless clause', () => {
      expect(INDEMNIFICATION_TERMS).toContain('indemnify, defend, and hold harmless');
      expect(INDEMNIFICATION_TERMS).toContain('PromptFM');
      expect(INDEMNIFICATION_TERMS).toContain('copyright infringement');
    });

    it('requires commercial tier subscription warranty for generative tools', () => {
      expect(COMMERCIAL_AI_LICENSE_WARRANTY.supportedTools).toEqual([
        'Suno',
        'Udio',
        'Stable Audio',
        'Custom/Open-Weights',
      ]);
      expect(COMMERCIAL_AI_LICENSE_WARRANTY.requiresCommercialTier).toBe(true);
      expect(COMMERCIAL_AI_LICENSE_WARRANTY.prohibitsUnauthorizedClones).toBe(true);
    });

    it('defines standard public disclaimer text', () => {
      expect(AI_MUSIC_DISCLAIMER).toContain('100% user-prompted, AI-generated');
      expect(AI_MUSIC_DISCLAIMER).toContain('17 U.S.C. § 512');
    });
  });

  describe('validateDmcaNoticePayload', () => {
    const validNotice: DmcaNoticePayload = {
      copyrightOwner: 'Universal Synthwave Ltd',
      claimantName: 'Jane Counsel, Esq.',
      claimantEmail: 'legal@universalsynth.com',
      workDescription: 'Original sound recording "Neon Horizon 1984"',
      infringingIdentifier: 'https://promptfm.live/track/trk_123',
      goodFaithStatement: true,
      perjuryStatement: true,
      signature: 'Jane Counsel',
    };

    it('validates a complete, legally compliant DMCA notice', () => {
      const result = validateDmcaNoticePayload(validNotice);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects a notice missing mandatory statutory declarations', () => {
      const invalid = { ...validNotice, goodFaithStatement: false, signature: '' };
      const result = validateDmcaNoticePayload(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Good faith statement is legally required under 17 U.S.C. § 512(c)(3)(A)(v)');
      expect(result.errors).toContain('Physical or electronic signature is legally required');
    });

    it('rejects an invalid email address or missing copyright owner', () => {
      const invalid = { ...validNotice, claimantEmail: 'not-an-email', copyrightOwner: ' ' };
      const result = validateDmcaNoticePayload(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('A valid claimant contact email address is required');
      expect(result.errors).toContain('Identification of the copyright owner or work is required');
    });

    it('rejects whitespace-only fields in DMCA notice', () => {
      const whitespaceOnly: DmcaNoticePayload = {
        copyrightOwner: '   ',
        claimantName: '   ',
        claimantEmail: '   ',
        workDescription: '   ',
        infringingIdentifier: '   ',
        goodFaithStatement: true,
        perjuryStatement: true,
        signature: '   ',
      };
      const result = validateDmcaNoticePayload(whitespaceOnly);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Identification of the copyright owner or work is required');
      expect(result.errors).toContain('Full legal name of claimant or authorized representative is required');
      expect(result.errors).toContain('A valid claimant contact email address is required');
      expect(result.errors).toContain('Description of the copyrighted work is required');
      expect(result.errors).toContain('Identification of the claimed infringing track or URL is required');
      expect(result.errors).toContain('Physical or electronic signature is legally required');
    });

    it('rejects missing or empty claimant name and work description', () => {
      const invalid = { ...validNotice, claimantName: '', workDescription: '' };
      const result = validateDmcaNoticePayload(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Full legal name of claimant or authorized representative is required');
      expect(result.errors).toContain('Description of the copyrighted work is required');
    });

    it('rejects missing infringing work identifier', () => {
      const invalid = { ...validNotice, infringingIdentifier: '' };
      const result = validateDmcaNoticePayload(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Identification of the claimed infringing track or URL is required');
    });

    it('rejects missing perjury statement', () => {
      const invalid = { ...validNotice, perjuryStatement: false };
      const result = validateDmcaNoticePayload(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Penalty of perjury statement is legally required under 17 U.S.C. § 512(c)(3)(A)(vi)');
    });
  });

  describe('validateCounterNoticePayload', () => {
    const validCounter: CounterNoticePayload = {
      uploaderName: 'Alex Producer',
      uploaderEmail: 'alex@example.com',
      uploaderAddress: '123 Audio Way, Austin, TX 78701',
      trackIdentifier: 'trk_123',
      mistakeStatement: true,
      jurisdictionConsent: true,
      signature: 'Alex Producer',
    };

    it('validates a complete counter-notice', () => {
      const result = validateCounterNoticePayload(validCounter);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects counter-notice without federal jurisdiction consent', () => {
      const invalid = { ...validCounter, jurisdictionConsent: false };
      const result = validateCounterNoticePayload(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Federal court jurisdiction consent is mandatory under 17 U.S.C. § 512(g)(3)(D)');
    });

    it('rejects counter-notice without mistake/misidentification statement', () => {
      const invalid = { ...validCounter, mistakeStatement: false };
      const result = validateCounterNoticePayload(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Good faith statement of mistake or misidentification is mandatory under 17 U.S.C. § 512(g)(3)(C)');
    });

    it('rejects counter-notice with missing uploader name or signature', () => {
      const invalid = { ...validCounter, uploaderName: '', signature: ' ' };
      const result = validateCounterNoticePayload(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Uploader full name is required');
      expect(result.errors).toContain('Physical or electronic signature is required');
    });

    it('rejects counter-notice with invalid email or missing address', () => {
      const invalid = { ...validCounter, uploaderEmail: 'bad-email', uploaderAddress: '  ' };
      const result = validateCounterNoticePayload(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid contact email is required');
      expect(result.errors).toContain('Physical postal address is required');
    });

    it('rejects counter-notice with missing track identifier', () => {
      const invalid = { ...validCounter, trackIdentifier: '' };
      const result = validateCounterNoticePayload(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Track ID or URL of removed material is required');
    });

    it('rejects whitespace-only fields in counter notice', () => {
      const whitespaceOnly: CounterNoticePayload = {
        uploaderName: '   ',
        uploaderEmail: '   ',
        uploaderAddress: '   ',
        trackIdentifier: '   ',
        mistakeStatement: true,
        jurisdictionConsent: true,
        signature: '   ',
      };
      const result = validateCounterNoticePayload(whitespaceOnly);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Uploader full name is required');
      expect(result.errors).toContain('Valid contact email is required');
      expect(result.errors).toContain('Physical postal address is required');
      expect(result.errors).toContain('Track ID or URL of removed material is required');
      expect(result.errors).toContain('Physical or electronic signature is required');
    });
  });
});
