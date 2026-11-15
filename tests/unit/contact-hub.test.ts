// tests/unit/contact-hub.test.ts
// Unit tests for PromptFM Contact Hub and publisher trust metadata.

import { describe, it, expect } from 'vitest';
import {
  STATION_CONTACTS,
  validateContactFormPayload,
  type ContactFormPayload,
} from '@/lib/contact/contact-info';
import { generateContactPageJsonLd } from '@/lib/seo/structured-data';

describe('Contact Hub Service', () => {
  it('defines comprehensive publisher contact channels and departments', () => {
    expect(STATION_CONTACTS.length).toBe(5);

    const keys = STATION_CONTACTS.map((c) => c.key);
    expect(keys).toEqual(['general', 'support', 'submissions', 'legal', 'advertising']);

    // General
    const general = STATION_CONTACTS.find((c) => c.key === 'general');
    expect(general?.name).toBe('General & Listener Relations');
    expect(general?.email).toBe('contact@promptfm.live');
    expect(general?.description).toContain('General feedback');
    expect(general?.sla).toBe('Within 24 to 48 business hours');

    // Support
    const support = STATION_CONTACTS.find((c) => c.key === 'support');
    expect(support?.name).toBe('Technical Support & Stream Health');
    expect(support?.email).toBe('support@promptfm.live');
    expect(support?.description).toContain('Audio buffering');
    expect(support?.sla).toBe('Within 12 to 24 hours');

    // Submissions
    const submissions = STATION_CONTACTS.find((c) => c.key === 'submissions');
    expect(submissions?.name).toBe('Music Submissions & Editorial Curation');
    expect(submissions?.email).toBe('submissions@promptfm.live');
    expect(submissions?.description).toContain('Artist profiles');
    expect(submissions?.sla).toBe('Within 2 business days');

    // Legal
    const legal = STATION_CONTACTS.find((c) => c.key === 'legal');
    expect(legal?.name).toBe('DMCA & Statutory Copyright Office');
    expect(legal?.email).toBe('dmca@promptfm.live');
    expect(legal?.description).toContain('17 U.S.C. § 512');
    expect(legal?.sla).toBe('Expedited review within 24 hours');

    // Advertising
    const advertising = STATION_CONTACTS.find((c) => c.key === 'advertising');
    expect(advertising?.name).toBe('Sponsorships & Google AdSense Operations');
    expect(advertising?.email).toBe('advertising@promptfm.live');
    expect(advertising?.description).toContain('Ad placement');
    expect(advertising?.sla).toBe('Within 48 hours');
  });

  describe('validateContactFormPayload', () => {
    it('validates compliant contact form submissions correctly', () => {
      const validPayload: ContactFormPayload = {
        name: 'Alex Producer',
        email: 'alex@example.com',
        department: 'general',
        subject: 'Inquiry regarding Suno v3.5 track curation',
        message: 'Hello PromptFM team, how often does the station rotate new submissions into the evening prime time slot?',
      };

      const result = validateContactFormPayload(validPayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects subject that has fewer than 3 characters after trimming', () => {
      const result = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: '  ab  ',
        message: 'Hello PromptFM team, here is a long enough message.',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Subject must be at least 3 characters long.');
    });

    it('rejects message that has fewer than 10 characters after trimming', () => {
      const result = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: 'Inquiry',
        message: '   short   ',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message body must be at least 10 characters long.');
    });

    it('rejects name that is overly long only after whitespace trimming check', () => {
      const result = validateContactFormPayload({
        name: `   ${'A'.repeat(101)}   `,
        email: 'alex@example.com',
        department: 'general',
        subject: 'Inquiry',
        message: 'Hello PromptFM team, here is a long enough message.',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be 100 characters or fewer.');
    });

    it('rejects subject that is overly long after trimming', () => {
      const result = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: `  ${'S'.repeat(151)}  `,
        message: 'Hello PromptFM team, here is a long enough message.',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Subject must be 150 characters or fewer.');
    });

    it('rejects message that is overly long after trimming', () => {
      const result = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: 'Inquiry',
        message: `  ${'M'.repeat(5001)}  `,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message body must be 5000 characters or fewer.');
    });

    it('rejects overly long name (> 100 characters)', () => {
      const result = validateContactFormPayload({
        name: 'A'.repeat(101),
        email: 'alex@example.com',
        department: 'general',
        subject: 'Inquiry',
        message: 'Hello PromptFM team, here is a long enough message.',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name must be 100 characters or fewer.');
    });

    it('accepts name with exactly 100 characters', () => {
      const result = validateContactFormPayload({
        name: 'A'.repeat(100),
        email: 'alex@example.com',
        department: 'general',
        subject: 'Inquiry',
        message: 'Hello PromptFM team, here is a long enough message.',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects invalid email formats', () => {
      const result = validateContactFormPayload({
        name: 'Alex',
        email: 'invalid-email',
        department: 'general',
        subject: 'Inquiry',
        message: 'Hello PromptFM team, here is a long enough message.',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('A valid email address is required.');
    });

    it('rejects missing or too short subject (< 3 characters)', () => {
      const result = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: 'ab',
        message: 'Hello PromptFM team, here is a long enough message.',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Subject must be at least 3 characters long.');
    });

    it('rejects overly long subject (> 150 characters)', () => {
      const result = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: 'S'.repeat(151),
        message: 'Hello PromptFM team, here is a long enough message.',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Subject must be 150 characters or fewer.');
    });

    it('accepts subject with exactly 3 and 150 characters', () => {
      const res3 = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: '123',
        message: 'Hello PromptFM team, here is a long enough message.',
      });
      expect(res3.valid).toBe(true);

      const res150 = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: 'S'.repeat(150),
        message: 'Hello PromptFM team, here is a long enough message.',
      });
      expect(res150.valid).toBe(true);
    });

    it('rejects too short message (< 10 characters)', () => {
      const result = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: 'Inquiry',
        message: 'Too short',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message body must be at least 10 characters long.');
    });

    it('rejects overly long message (> 5000 characters)', () => {
      const result = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: 'Inquiry',
        message: 'M'.repeat(5001),
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message body must be 5000 characters or fewer.');
    });

    it('accepts message with exactly 10 and 5000 characters', () => {
      const res10 = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: 'Inquiry',
        message: '0123456789',
      });
      expect(res10.valid).toBe(true);

      const res5000 = validateContactFormPayload({
        name: 'Alex',
        email: 'alex@example.com',
        department: 'general',
        subject: 'Inquiry',
        message: 'M'.repeat(5000),
      });
      expect(res5000.valid).toBe(true);
    });
  });

  it('generates compliant Schema.org ContactPage JSON-LD structured data', () => {
    const jsonLd = generateContactPageJsonLd();
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('ContactPage');
    expect(jsonLd.name).toContain('Contact PromptFM');
    expect(jsonLd.url).toBe('https://promptfm.live/contact');
    expect(jsonLd.description).toContain('Official contact information');
    expect(jsonLd.mainEntity['@type']).toBe('Organization');
    expect(jsonLd.mainEntity.email).toBe('contact@promptfm.live');
    expect(jsonLd.mainEntity.contactPoint.length).toBe(5);

    const cpKeys = jsonLd.mainEntity.contactPoint.map((cp: { contactType: string }) => cp.contactType);
    expect(cpKeys).toContain('General & Listener Relations');
    expect(cpKeys).toContain('Technical Support & Stream Health');
    expect(cpKeys).toContain('Music Submissions & Editorial Curation');
    expect(cpKeys).toContain('DMCA & Statutory Copyright Office');
    expect(cpKeys).toContain('Sponsorships & Google AdSense Operations');

    expect(jsonLd.mainEntity.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '13101 Preston Rd, Suite 110',
      addressLocality: 'Dallas',
      addressRegion: 'TX',
      postalCode: '75240',
      addressCountry: 'US',
    });
  });
});
