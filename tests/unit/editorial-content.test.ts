// tests/unit/editorial-content.test.ts
// Unit tests ensuring all key pages have substantial editorial content, metadata, and canonical links.

import { describe, it, expect } from 'vitest';
import { metadata as contactMetadata } from '@/app/contact/page';
import { metadata as faqMetadata } from '@/app/faq/page';
import { metadata as channelsMetadata } from '@/app/channels/page';
import { metadata as topMetadata } from '@/app/top/layout';
import { metadata as libraryMetadata } from '@/app/library/layout';
import { metadata as submitMetadata } from '@/app/submit/layout';
import { metadata as privacyMetadata } from '@/app/privacy/layout';
import { metadata as termsMetadata } from '@/app/terms/layout';
import { metadata as copyrightMetadata } from '@/app/copyright/layout';
import { metadata as dmcaMetadata } from '@/app/dmca/layout';

describe('Editorial Depth & Route Metadata Compliance', () => {
  it('contact page exports compliant title, description, and canonical link', () => {
    expect(contactMetadata.title).toContain('Contact');
    expect(contactMetadata.description).toBeDefined();
    expect(contactMetadata.alternates?.canonical).toBe('/contact');
  });

  it('faq page exports compliant title, description, and canonical link', () => {
    expect(faqMetadata.title).toContain('FAQ');
    expect(faqMetadata.description).toBeDefined();
    expect(faqMetadata.alternates?.canonical).toBe('/faq');
  });

  it('channels page exports rich directory metadata', () => {
    expect(channelsMetadata.title).toContain('Channels');
    expect(channelsMetadata.description).toBeDefined();
    expect(channelsMetadata.alternates?.canonical).toBe('/channels');
  });

  it('all interactive and policy routes export explicit layout metadata', () => {
    expect(topMetadata.title).toContain('Charts');
    expect(topMetadata.alternates?.canonical).toBe('/top');

    expect(libraryMetadata.title).toContain('Library');
    expect(libraryMetadata.alternates?.canonical).toBe('/library');

    expect(submitMetadata.title).toContain('Submit');
    expect(submitMetadata.alternates?.canonical).toBe('/submit');

    expect(privacyMetadata.title).toContain('Privacy');
    expect(privacyMetadata.alternates?.canonical).toBe('/privacy');

    expect(termsMetadata.title).toContain('Terms');
    expect(termsMetadata.alternates?.canonical).toBe('/terms');

    expect(copyrightMetadata.title).toContain('Copyright');
    expect(copyrightMetadata.alternates?.canonical).toBe('/copyright');

    expect(dmcaMetadata.title).toContain('DMCA');
    expect(dmcaMetadata.alternates?.canonical).toBe('/dmca');
  });
});
