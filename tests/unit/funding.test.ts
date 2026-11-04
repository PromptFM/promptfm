import { describe, it, expect } from 'vitest';
import { getDonationOptions, getFundingTiers, getAdFormatOptions } from '@/lib/community/funding';

describe('Community Funding, Donations & Radio Ads Helper', () => {
  it('returns valid community donation options including GitHub Sponsors and Ko-fi', () => {
    const options = getDonationOptions();
    expect(options.length).toBeGreaterThanOrEqual(2);
    
    const githubOption = options.find((opt) => opt.id === 'github');
    expect(githubOption).toBeDefined();
    expect(githubOption?.url).toContain('github.com/sponsors');
    expect(githubOption?.fee).toBe('0% platform fee');

    const kofiOption = options.find((opt) => opt.id === 'kofi');
    expect(kofiOption).toBeDefined();
    expect(kofiOption?.supportsApplePay).toBe(true);
  });

  it('provides structured funding tiers with perks', () => {
    const tiers = getFundingTiers();
    expect(tiers.length).toBeGreaterThanOrEqual(3);
    expect(tiers[0]?.amountMonthlyUsd).toBe(5);
    expect(tiers.some((t) => t.perks.includes('Discord Supporter Badge'))).toBe(true);
  });

  it('returns supported radio advertising models with format specs', () => {
    const adFormats = getAdFormatOptions();
    expect(adFormats.length).toBeGreaterThanOrEqual(2);
    
    const hostRead = adFormats.find((f) => f.id === 'ai-host-read');
    expect(hostRead).toBeDefined();
    expect(hostRead?.durationSeconds).toBe(20);
    expect(hostRead?.readByDjs).toBe(true);

    const produced = adFormats.find((f) => f.id === 'produced-spot');
    expect(produced).toBeDefined();
    expect(produced?.targetLoudness).toBe('-14 LUFS');
  });
});
