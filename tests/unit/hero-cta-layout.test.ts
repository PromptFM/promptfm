// tests/unit/hero-cta-layout.test.ts
// TDD Unit Test Suite for Issue #125: Fix homepage hero CTA overlap on web/desktop.
//
// Requirements:
// 1. Separate Primary CTA ('Tune In Main Stage') from the secondary action group.
// 2. Primary CTA has its own dedicated container, preventing wrapping collisions.
// 3. Secondary actions group ('Weekly Charts', 'Support Station', 'Contribute', 'Submit')
//    is housed in a dedicated, accessible container (e.g. data-testid="hero-secondary-cta-group").
// 4. Stable spacing (gap-3 or larger) between primary and secondary groups.
// 5. Accessible touch target sizing (min-h-[44px]), keyboard focus rings, and proper ARIA labels.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import HomePage from '@/app/page';

describe('Issue #125: Homepage Hero CTA Layout & Accessibility (TDD)', () => {
  it('reproduces Issue #125: hero CTA cluster must separate primary CTA from secondary action group in dedicated containers', () => {
    const html = renderToString(React.createElement(HomePage));

    // The hero cluster must have an identifiable container
    expect(html).toContain('id="hero-ctas"');

    // Primary CTA container must exist and contain the Main Stage tune-in button
    expect(html).toContain('data-testid="hero-primary-cta"');
    expect(html).toMatch(/data-testid="hero-primary-cta"[\s\S]*?Tune In Main Stage/);

    // Secondary action group container must exist and have accessible label
    expect(html).toContain('data-testid="hero-secondary-cta-group"');
    expect(html).toContain('aria-label="Secondary station actions"');

    // Secondary action group must contain the 4 secondary buttons
    expect(html).toMatch(/data-testid="hero-secondary-cta-group"[\s\S]*?Weekly Charts/);
    expect(html).toMatch(/data-testid="hero-secondary-cta-group"[\s\S]*?Support Station/);
    expect(html).toMatch(/data-testid="hero-secondary-cta-group"[\s\S]*?Contribute/);
    expect(html).toMatch(/data-testid="hero-secondary-cta-group"[\s\S]*?Submit/);
  });

  it('ensures primary CTA has prominent hierarchy, full touch target sizing, and high contrast styling', () => {
    const html = renderToString(React.createElement(HomePage));

    // Must be styled with emerald background and prominent font
    expect(html).toContain('bg-emerald-500');
    expect(html).toContain('hover:bg-emerald-400');
    expect(html).toContain('min-h-[44px]');
    expect(html).toContain('focus:ring-2');
  });

  it('ensures secondary actions have accessible touch targets, clear borders, and focus rings', () => {
    const html = renderToString(React.createElement(HomePage));

    // All secondary buttons should have accessible min-h-[44px]
    const secondaryMatches = html.match(/min-h-\[44px\]/g);
    // At least 5 buttons (1 primary + 4 secondary) should have min-h-[44px]
    expect(secondaryMatches).not.toBeNull();
    expect(secondaryMatches!.length).toBeGreaterThanOrEqual(5);

    // Focus visible outline for keyboard users
    expect(html).toContain('focus:outline-none');
    expect(html).toContain('focus:ring-emerald-400');
  });

  it('guarantees stable spacing between primary CTA and secondary action group', () => {
    const html = renderToString(React.createElement(HomePage));

    // Hero CTA wrapper must use flex-col with stable gap
    expect(html).toMatch(/id="hero-ctas"[^>]*class="[^"]*flex flex-col[^"]*gap-[3-5][^"]*"/);

    // Secondary group must use flex-wrap with gap-2.5 or gap-3
    expect(html).toMatch(/data-testid="hero-secondary-cta-group"[^>]*class="[^"]*sm:flex sm:flex-wrap[^"]*gap-2\.5 sm:gap-3/);
  });

  it('renders all feature pills with correct icons and labels (kills mutants)', () => {
    const html = renderToString(React.createElement(HomePage));

    // Extract the specific feature pills container
    const pillsMatch = html.match(/data-testid="hero-feature-pills"[\s\S]*?<\/div>\s*<\/div>/);
    expect(pillsMatch).not.toBeNull();
    const pillsHtml = pillsMatch![0];

    expect(pillsHtml).toContain('Main Stage · 24/7 AI Radio');
    expect(pillsHtml).toContain('Open Community Development');
    expect(pillsHtml).toContain('Suno · Udio · Stable Audio');
    expect(pillsHtml).toContain('Direct R2 Upload');

    // Verify all 4 pill spans are rendered
    const pillMatches = pillsHtml.match(/class="flex items-center gap-1\.5 bg-zinc-900 border border-zinc-800 px-3 py-1\.5 rounded-full"/g);
    expect(pillMatches).not.toBeNull();
    expect(pillMatches!.length).toBe(4);
  });
});
