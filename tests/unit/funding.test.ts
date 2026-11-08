import { describe, it, expect } from 'vitest';
import { getDonationOptions, getFundingTiers, getAdFormatOptions } from '@/lib/community/funding';

describe('Community Funding, Donations & Radio Ads Helper', () => {
  it('returns valid community donation options including GitHub Sponsors and Ko-fi', () => {
    const options = getDonationOptions();
    expect(options.length).toBeGreaterThanOrEqual(2);
    
    const githubOption = options.find((opt) => opt.id === 'github');
    expect(githubOption).toBeDefined();
    expect(githubOption?.url).toBe('https://github.com/sponsors/promptfm/signup');
    expect(githubOption?.url).not.toContain('atrifan');
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

  it('validates crypto wallets configuration for Bitcoin and Ethereum', async () => {
    const { getCryptoDonationWallets } = await import('@/lib/community/funding');
    const wallets = getCryptoDonationWallets();

    expect(wallets.bitcoin.address).toBe('bc1qaplta50757v7c4vrk7vnry0vfd6c47rpmyvnj9');
    expect(wallets.bitcoin.network).toBe('Bitcoin Mainnet Only');
    expect(wallets.bitcoin.explorerUrl).toContain('mempool.space');

    expect(wallets.ethereum.address).toBe('0x9581F969727Ff987958d050C80662578C50F6A9f');
    expect(wallets.ethereum.network).toBe('Ethereum Mainnet Only (ERC-20 / ETH / USDC)');
    expect(wallets.ethereum.explorerUrl).toContain('etherscan.io');
  });

  it('validates funding allocation breakdown and mission statement', async () => {
    const { getFundingBreakdown, getFundingMissionStatement, getStripeDonationConfig } = await import('@/lib/community/funding');
    const breakdown = getFundingBreakdown();

    const royalties = breakdown.find((b) => b.category === 'commercial_licensing');
    const cloud = breakdown.find((b) => b.category === 'infrastructure');
    const ai = breakdown.find((b) => b.category === 'ai_compute');
    const dev = breakdown.find((b) => b.category === 'development');
    const coffee = breakdown.find((b) => b.category === 'coffee');

    expect(royalties?.percentage).toBe(35);
    expect(cloud?.percentage).toBe(25);
    expect(ai?.percentage).toBe(20);
    expect(dev?.percentage).toBe(15);
    expect(coffee?.percentage).toBe(5);

    const total = breakdown.reduce((sum, item) => sum + item.percentage, 0);
    expect(total).toBe(100);

    const mission = getFundingMissionStatement();
    expect(mission.statement).toContain('100% of community donations');
    expect(mission.pillars).toHaveLength(5);

    const stripe = getStripeDonationConfig();
    expect(stripe.enabled).toBe(true);
    expect(stripe.supportedMethods).toContain('apple_pay');
    expect(stripe.paymentLinkUrl).toContain('donate.stripe.com');
  });
});
