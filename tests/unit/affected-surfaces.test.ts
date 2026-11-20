import { describe, it, expect } from 'vitest';
import {
  resolveAffectedSurfaces,
  type AffectedSurfaceResult,
} from '@/lib/testing/affected-surfaces';

describe('Issue #241 Affected Surfaces & Accessibility Scope Resolver', () => {
  it('returns all public routes when global styling or layout files change', () => {
    const globalTriggers = [
      'src/app/globals.css',
      'src/app/layout.tsx',
      'src/components/Navbar.tsx',
      'src/components/ThemeToggle.tsx',
      'src/lib/theme/color-scheme.ts',
      'tailwind.config.ts',
    ];

    for (const file of globalTriggers) {
      const result = resolveAffectedSurfaces([file]);
      expect(result.allRoutes).toBe(true);
      expect(result.routes).toContain('/');
      expect(result.routes).toContain('/top');
      expect(result.routes).toContain('/library');
      expect(result.routes).toContain('/status');
      expect(result.routes).toContain('/channels');
      expect(result.routes).toContain('/schedule');
      expect(result.routes).toContain('/privacy');
      expect(result.routes).toContain('/terms');
      expect(result.routes).toContain('/copyright');
    }
  });

  it('Issue #273: resolves footer, community section, and cookie banner mappings', () => {
    const footerResult = resolveAffectedSurfaces(['src/components/Footer.tsx']);
    expect(footerResult.allRoutes).toBe(true);
    expect(footerResult.selectors).toContain('footer');

    const communityResult = resolveAffectedSurfaces(['src/components/CommunitySection.tsx']);
    expect(communityResult.routes).toContain('/');
    expect(communityResult.selectors).toContain('#community');

    const cookieResult = resolveAffectedSurfaces(['src/components/CookieConsentBanner.tsx']);
    expect(cookieResult.allRoutes).toBe(true);
    expect(cookieResult.selectors).toContain('[role="region"][aria-label*="Cookie"]');
  });

  it('resolves home page routes and container selectors when section components change', () => {
    const result = resolveAffectedSurfaces([
      'src/components/FundingSection.tsx',
      'src/components/ContributeSection.tsx',
    ]);

    expect(result.allRoutes).toBe(false);
    expect(result.routes).toContain('/');
    expect(result.selectors).toContain('#funding');
    expect(result.selectors).toContain('#contribute');
  });

  it('resolves channels section when ChannelsGrid changes', () => {
    const result = resolveAffectedSurfaces(['src/components/ChannelsGrid.tsx']);

    expect(result.routes).toContain('/');
    expect(result.selectors).toContain('#channels');
  });

  it('resolves audio player when AudioPlayer changes', () => {
    const result = resolveAffectedSurfaces(['src/components/AudioPlayer.tsx']);

    expect(result.routes).toEqual(['/', '/top', '/library', '/status']);
    expect(result.selectors).toContain('[aria-label="Live radio player"]');
  });

  it('resolves specific routes and selectors for all interactive components and pages', () => {
    const scheduleResult = resolveAffectedSurfaces(['src/components/ScheduleView.tsx']);
    expect(scheduleResult.routes).toEqual(['/', '/status']);
    expect(scheduleResult.selectors).toEqual(['#schedule']);

    const upNextResult = resolveAffectedSurfaces(['src/components/UpNextSection.tsx']);
    expect(upNextResult.routes).toEqual(['/']);
    expect(upNextResult.selectors).toEqual(['#up-next']);

    const homeResult = resolveAffectedSurfaces(['src/app/page.tsx']);
    expect(homeResult.routes).toEqual(['/']);
    expect(homeResult.selectors).toEqual(['main']);

    const submitResult = resolveAffectedSurfaces(['src/app/submit/page.tsx']);
    expect(submitResult.routes).toEqual(['/submit']);
    expect(submitResult.selectors).toEqual(['main']);

    const faqResult = resolveAffectedSurfaces(['src/app/faq/page.tsx']);
    expect(faqResult.routes).toEqual(['/faq']);
    expect(faqResult.selectors).toEqual(['main']);

    const contactResult = resolveAffectedSurfaces(['src/app/contact/page.tsx']);
    expect(contactResult.routes).toEqual(['/contact']);
    expect(contactResult.selectors).toEqual(['main']);

    const dmcaResult = resolveAffectedSurfaces(['src/app/dmca/page.tsx']);
    expect(dmcaResult.routes).toEqual(['/dmca']);
    expect(dmcaResult.selectors).toEqual(['main']);
  });

  it('resolves specific routes when page routes change', () => {
    expect(resolveAffectedSurfaces(['src/app/top/page.tsx']).routes).toEqual(['/top']);
    expect(resolveAffectedSurfaces(['src/app/top/page.tsx']).selectors).toEqual(['main']);
    expect(resolveAffectedSurfaces(['src/app/library/page.tsx']).routes).toEqual(['/library']);
    expect(resolveAffectedSurfaces(['src/app/library/page.tsx']).selectors).toEqual(['main']);
    expect(resolveAffectedSurfaces(['src/app/status/page.tsx']).routes).toEqual(['/status']);
    expect(resolveAffectedSurfaces(['src/app/status/page.tsx']).selectors).toEqual(['main']);
    expect(resolveAffectedSurfaces(['src/app/about/page.tsx']).routes).toEqual(['/about']);
    expect(resolveAffectedSurfaces(['src/app/about/page.tsx']).selectors).toEqual(['main']);
    expect(resolveAffectedSurfaces(['src/app/channels/page.tsx']).routes).toEqual(['/channels']);
    expect(resolveAffectedSurfaces(['src/app/channels/page.tsx']).selectors).toEqual(['main']);
    expect(resolveAffectedSurfaces(['src/app/schedule/page.tsx']).routes).toEqual(['/schedule']);
    expect(resolveAffectedSurfaces(['src/app/schedule/page.tsx']).selectors).toEqual(['main']);
    expect(resolveAffectedSurfaces(['src/app/privacy/page.tsx']).routes).toEqual(['/privacy']);
    expect(resolveAffectedSurfaces(['src/app/privacy/page.tsx']).selectors).toEqual(['main']);
    expect(resolveAffectedSurfaces(['src/app/terms/page.tsx']).routes).toEqual(['/terms']);
    expect(resolveAffectedSurfaces(['src/app/terms/page.tsx']).selectors).toEqual(['main']);
    expect(resolveAffectedSurfaces(['src/app/copyright/page.tsx']).routes).toEqual(['/copyright']);
    expect(resolveAffectedSurfaces(['src/app/copyright/page.tsx']).selectors).toEqual(['main']);
  });

  it('falls back to core routes when changedFiles list is empty or unrelated', () => {
    const emptyResult = resolveAffectedSurfaces([]);
    expect(emptyResult.routes).toEqual(['/', '/top', '/library', '/status']);

    const docResult = resolveAffectedSurfaces(['README.md', 'docs/CONTRIBUTING.md']);
    expect(docResult.routes).toEqual([]);
    expect(docResult.selectors).toEqual([]);
  });
});
