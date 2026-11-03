// tests/unit/adsense.test.ts
// Unit tests for Google AdSense configuration and ads.txt specification generator.

import { describe, it, expect } from 'vitest';
import {
  ADSENSE_CLIENT_ID,
  ADSENSE_PUBLISHER_ID,
  GOOGLE_TAG_CERT_AUTHORITY,
  generateAdsTxt,
  validateAdsTxtContent,
} from '@/lib/ads/adsense';

describe('Google AdSense & ads.txt Configuration', () => {
  it('exports valid AdSense client ID and publisher ID', () => {
    expect(ADSENSE_CLIENT_ID).toBe('ca-pub-7299057534028491');
    expect(ADSENSE_PUBLISHER_ID).toBe('pub-7299057534028491');
    expect(GOOGLE_TAG_CERT_AUTHORITY).toBe('f08c47fec0942fa0');
  });

  describe('generateAdsTxt', () => {
    it('generates compliant IAB ads.txt string with Google AdSense directive', () => {
      const content = generateAdsTxt();

      expect(content).toContain('google.com, pub-7299057534028491, DIRECT, f08c47fec0942fa0');
      expect(content).toContain('# PromptFM Authorized Digital Sellers (ads.txt)');
      expect(content).toContain('# Domain: promptfm.live');
      expect(content).toContain('# Contact: contact@promptfm.live');
      expect(content.endsWith('\n')).toBe(true);

      const splitLines = content.split('\n');
      expect(splitLines.length).toBeGreaterThanOrEqual(5);
      expect(splitLines[0]).toBe('# PromptFM Authorized Digital Sellers (ads.txt)');
      expect(splitLines[1]).toBe('# Domain: promptfm.live');
      expect(splitLines[2]).toBe('# Contact: contact@promptfm.live');
      expect(splitLines[3]).toBe('google.com, pub-7299057534028491, DIRECT, f08c47fec0942fa0');
    });

    it('allows passing custom extra entries and joins with newline', () => {
      const extra = ['example.com, pub-99999, DIRECT'];
      const content = generateAdsTxt(extra);

      expect(content).toContain('google.com, pub-7299057534028491, DIRECT, f08c47fec0942fa0');
      expect(content).toContain('example.com, pub-99999, DIRECT');
      expect(content.split('\n')).toContain('example.com, pub-99999, DIRECT');
    });
  });

  describe('validateAdsTxtContent', () => {
    it('validates a correct ads.txt content', () => {
      const valid = 'google.com, pub-7299057534028491, DIRECT, f08c47fec0942fa0\n';
      expect(validateAdsTxtContent(valid)).toBe(true);
    });

    it('rejects content missing the required Google AdSense publisher ID', () => {
      const invalid = 'google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n';
      expect(validateAdsTxtContent(invalid)).toBe(false);
    });

    it('rejects empty, null/undefined, or whitespace-only content', () => {
      expect(validateAdsTxtContent('')).toBe(false);
      expect(validateAdsTxtContent('   \n  ')).toBe(false);
      expect(validateAdsTxtContent('    ')).toBe(false);
      expect(validateAdsTxtContent(null as unknown as string)).toBe(false);
      expect(validateAdsTxtContent(undefined as unknown as string)).toBe(false);
    });
  });
});
