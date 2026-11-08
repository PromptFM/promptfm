import { describe, it, expect } from 'vitest';
import { generateBadgeSvg, BUILTIN_LOGOS } from '@/lib/badges/badge-generator';

describe('Badge Generator (src/lib/badges/badge-generator.ts)', () => {
  it('generates a valid SVG badge with standard dimensions and structure', () => {
    const svg = generateBadgeSvg({
      label: 'Production',
      message: 'promptfm.live',
      color: '#10b981',
    });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('height="28"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="PRODUCTION: PROMPTFM.LIVE"');
    expect(svg).toContain('fill="#555"');
    expect(svg).toContain('fill="#10b981"');
    expect(svg).toContain('PRODUCTION');
    expect(svg).toContain('PROMPTFM.LIVE');
  });

  it('escapes special XML characters in label and message', () => {
    const svg = generateBadgeSvg({
      label: "CI & CD <Gate> 'Fast'",
      message: 'Tests "Passing" > 99%',
      color: '#4285F4',
    });

    expect(svg).toContain('CI &amp; CD &lt;GATE&gt; &apos;FAST&apos;');
    expect(svg).toContain('TESTS &quot;PASSING&quot; &gt; 99%');
    expect(svg).not.toContain('<Gate>');
  });

  it('embeds known builtin logos (vercel, googlecloud, vitest)', () => {
    expect(BUILTIN_LOGOS.vercel).toBeTruthy();
    expect(BUILTIN_LOGOS.googlecloud).toBeTruthy();
    expect(BUILTIN_LOGOS.vitest).toBeTruthy();

    const vercelBadge = generateBadgeSvg({
      label: 'Deployed on',
      message: 'Vercel',
      color: '#000000',
      logo: 'vercel',
    });
    expect(vercelBadge).toContain('<image');
    expect(vercelBadge).toContain('href="data:image/svg+xml;base64,');

    const gcpBadge = generateBadgeSvg({
      label: 'Logs',
      message: 'Cloud Logging',
      color: '#E37400',
      logo: 'googlecloud',
    });
    expect(gcpBadge).toContain('<image');

    const vitestBadge = generateBadgeSvg({
      label: 'Tests',
      message: '1519 Passing',
      color: '#2ea44f',
      logo: 'vitest',
    });
    expect(vitestBadge).toContain('<image');
  });

  it('supports custom base64 or raw SVG data URIs for logos', () => {
    const customLogo = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    const svg = generateBadgeSvg({
      label: 'Custom',
      message: 'Badge',
      color: '#333333',
      logo: customLogo,
    });
    expect(svg).toContain(`href="${customLogo}"`);
  });

  it('renders correctly without a logo', () => {
    const svg = generateBadgeSvg({
      label: 'License',
      message: 'Community Source-Available',
      color: '#8a2be2',
    });
    expect(svg).not.toContain('<image');
    expect(svg).toContain('fill="#8a2be2"');
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain('transform="scale(.1)"');
    expect(svg).toContain('y="175"');
  });

  it('handles lowercase, uppercase, and unknown logo keys cleanly', () => {
    const upperLogo = generateBadgeSvg({
      label: 'Deploy',
      message: 'Done',
      color: '#000',
      logo: 'VERCEL',
    });
    expect(upperLogo).toContain('<image');

    const unknownLogo = generateBadgeSvg({
      label: 'Custom',
      message: 'Icon',
      color: '#000',
      logo: 'unknown-vendor-id',
    });
    expect(unknownLogo).toContain('href="unknown-vendor-id"');
  });

  it('calculates dynamic width based on text length and logo presence', () => {
    const shortBadge = generateBadgeSvg({
      label: 'A',
      message: 'B',
      color: '#000',
    });

    const longBadge = generateBadgeSvg({
      label: 'A Very Long Label Name',
      message: 'An Extremely Detailed Message Value',
      color: '#000',
      logo: 'vercel',
    });

    // Long badge should have a larger total SVG width than short badge
    const extractWidth = (svg: string) => {
      const match = svg.match(/width="([0-9.]+)"/);
      return match && match[1] ? parseFloat(match[1]) : 0;
    };

    expect(extractWidth(longBadge)).toBeGreaterThan(extractWidth(shortBadge));
  });

  it('handles custom labelColor if provided', () => {
    const svg = generateBadgeSvg({
      label: 'Custom Label Color',
      message: 'Test',
      color: '#10b981',
      labelColor: '#222222',
    });
    expect(svg).toContain('fill="#222222"');
  });
});
