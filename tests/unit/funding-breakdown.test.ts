import { describe, it, expect } from 'vitest';
import {
  getFundingBreakdown,
  getCryptoDonationWallets,
  getStripeDonationConfig,
  getDonationOptions,
} from '@/lib/community/funding';

describe('Community Funding & Multi-Rail Donations', () => {
  describe('getFundingBreakdown', () => {
    it('provides transparent allocation explaining infra, AI credits, radio license, dev time, and coffee', () => {
      const breakdown = getFundingBreakdown();

      expect(breakdown).toHaveLength(5);

      const categories = breakdown.map((item) => item.category);
      expect(categories).toContain('infrastructure');
      expect(categories).toContain('ai_compute');
      expect(categories).toContain('commercial_licensing');
      expect(categories).toContain('development');
      expect(categories).toContain('coffee');

      // Verify percentages total 100%
      const totalPercentage = breakdown.reduce((acc, item) => acc + item.percentage, 0);
      expect(totalPercentage).toBe(100);

      // Verify commercial licensing specifically explains music performance royalties
      const licensing = breakdown.find((item) => item.category === 'commercial_licensing');
      expect(licensing?.title).toContain('Radio & Music Royalties');
      expect(licensing?.description).toMatch(/ASCAP|BMI|SoundExchange|commercial/i);

      // Verify AI compute explains LLM & Voice generation credits
      const ai = breakdown.find((item) => item.category === 'ai_compute');
      expect(ai?.description).toMatch(/Gemini|TTS|voice|tokens/i);
    });
  });

  describe('getCryptoDonationWallets', () => {
    it('returns Bitcoin and Ethereum donation wallet configurations with URI formats', () => {
      const wallets = getCryptoDonationWallets();

      expect(wallets.bitcoin).toBeDefined();
      expect(wallets.bitcoin.currency).toBe('BTC');
      expect(wallets.bitcoin.network).toContain('Bitcoin Mainnet');
      expect(wallets.bitcoin.address).toBe('bc1qaplta50757v7c4vrk7vnry0vfd6c47rpmyvnj9');
      expect(wallets.bitcoin.qrScheme).toMatch(/^bitcoin:/);
      expect(wallets.bitcoin.explorerUrl).toMatch(/blockchain\.com|mempool\.space/);

      expect(wallets.ethereum).toBeDefined();
      expect(wallets.ethereum.currency).toBe('ETH');
      expect(wallets.ethereum.network).toContain('Ethereum Mainnet');
      expect(wallets.ethereum.address).toBe('0x9581F969727Ff987958d050C80662578C50F6A9f');
      expect(wallets.ethereum.qrScheme).toMatch(/^ethereum:/);
      expect(wallets.ethereum.explorerUrl).toMatch(/etherscan\.io/);
    });
  });

  describe('getStripeDonationConfig', () => {
    it('provides Stripe direct payment and subscription checkout settings', () => {
      const stripeConfig = getStripeDonationConfig();

      expect(stripeConfig.enabled).toBe(true);
      expect(stripeConfig.paymentLinkUrl).toMatch(/stripe\.com/);
      expect(stripeConfig.supportedMethods).toContain('card');
      expect(stripeConfig.supportedMethods).toContain('apple_pay');
      expect(stripeConfig.supportedMethods).toContain('google_pay');
    });
  });

  describe('getDonationOptions integration', () => {
    it('includes Stripe, PayPal, Bitcoin, and Ethereum alongside GitHub Sponsors and Ko-fi', () => {
      const options = getDonationOptions();
      const ids = options.map((opt) => opt.id);

      expect(ids).toContain('stripe');
      expect(ids).toContain('paypal');
      expect(ids).toContain('bitcoin');
      expect(ids).toContain('ethereum');
      expect(ids).toContain('github');
      expect(ids).toContain('kofi');
    });
  });
});

