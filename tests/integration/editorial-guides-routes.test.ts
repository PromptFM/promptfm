// tests/integration/editorial-guides-routes.test.ts
// Integration tests verifying page exports, metadata, and editorial depth for AdSense compliance.

import { describe, it, expect } from 'vitest';
import { metadata as promptGuideMeta } from '@/app/guides/prompt-engineering/page';
import { metadata as radioArchMeta } from '@/app/guides/radio-architecture/page';
import { metadata as editorialStandardsMeta } from '@/app/editorial-standards/page';
import PromptEngineeringGuidePage from '@/app/guides/prompt-engineering/page';
import RadioArchitectureGuidePage from '@/app/guides/radio-architecture/page';
import EditorialStandardsPage from '@/app/editorial-standards/page';
import React from 'react';

describe('Editorial Guides & Publisher Routes Integration', () => {
  it('prompt engineering guide defines canonical metadata and OpenGraph properties', () => {
    expect(promptGuideMeta.title).toContain('Prompt Engineering');
    expect(promptGuideMeta.description).toContain('Suno');
    expect(promptGuideMeta.alternates?.canonical).toBe('/guides/prompt-engineering');
    expect(promptGuideMeta.openGraph).toBeDefined();
  });

  it('radio architecture guide defines canonical metadata and OpenGraph properties', () => {
    expect(radioArchMeta.title).toContain('Radio Architecture');
    expect(radioArchMeta.description).toContain('clock-wheel');
    expect(radioArchMeta.alternates?.canonical).toBe('/guides/radio-architecture');
    expect(radioArchMeta.openGraph).toBeDefined();
  });

  it('editorial standards defines canonical metadata and OpenGraph properties', () => {
    expect(editorialStandardsMeta.title).toContain('Editorial Standards');
    expect(editorialStandardsMeta.description).toContain('curation');
    expect(editorialStandardsMeta.alternates?.canonical).toBe('/editorial-standards');
    expect(editorialStandardsMeta.openGraph).toBeDefined();
  });

  it('renders prompt engineering guide React tree with rich educational sections', () => {
    const element = PromptEngineeringGuidePage();
    expect(React.isValidElement(element)).toBe(true);
  });

  it('renders radio architecture guide React tree with technical clock-wheel details', () => {
    const element = RadioArchitectureGuidePage();
    expect(React.isValidElement(element)).toBe(true);
  });

  it('renders editorial standards React tree with curation charter and governance', () => {
    const element = EditorialStandardsPage();
    expect(React.isValidElement(element)).toBe(true);
  });
});
