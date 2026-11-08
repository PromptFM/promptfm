// src/lib/community/funding.ts
// Configuration, helper structures, and models for community funding, donations, and radio ads

export interface DonationOption {
  id: string;
  name: string;
  description: string;
  url: string;
  fee: string;
  supportsApplePay: boolean;
  recommendedAudience: 'developers' | 'listeners' | 'sponsors' | 'crypto_enthusiasts';
}

export interface FundingTier {
  id: string;
  name: string;
  amountMonthlyUsd: number;
  perks: string[];
}

export interface AdFormatOption {
  id: string;
  name: string;
  description: string;
  durationSeconds: number;
  readByDjs: boolean;
  targetLoudness?: string;
  specs: string;
}

export type FundingCategory =
  | 'infrastructure'
  | 'ai_compute'
  | 'commercial_licensing'
  | 'development'
  | 'coffee';

export interface FundingAllocationItem {
  category: FundingCategory;
  title: string;
  description: string;
  percentage: number;
}

export interface FundingPillarSummary {
  key: FundingCategory;
  title: string;
  shortTitle: string;
  percentage: number;
  description: string;
  accentColor: string;
}

export interface FundingMissionStatement {
  statement: string;
  breakdownSummary: string;
  pillars: FundingPillarSummary[];
}

export interface CryptoWalletItem {
  currency: 'BTC' | 'ETH';
  network: string;
  address: string;
  qrScheme: string;
  explorerUrl: string;
}

export interface CryptoDonationWallets {
  bitcoin: CryptoWalletItem;
  ethereum: CryptoWalletItem;
}

export interface StripeDonationConfig {
  enabled: boolean;
  paymentLinkUrl: string;
  supportedMethods: string[];
}

export function getFundingBreakdown(): FundingAllocationItem[] {
  return [
    {
      category: 'commercial_licensing',
      title: 'Radio & Music Royalties (Licensing)',
      description:
        'Performance rights organization royalties (ASCAP, BMI, SESAC, SoundExchange) to legally stream licensed commercial tracks alongside AI-generated music.',
      percentage: 35,
    },
    {
      category: 'infrastructure',
      title: 'Cloud & Stream Bandwidth',
      description:
        'Continuous 24/7 audio streaming servers (Icecast), GCP Cloud Run instances, MinIO/GCS audio object storage, and Vercel edge delivery.',
      percentage: 25,
    },
    {
      category: 'ai_compute',
      title: 'Generative AI & Voice Credits',
      description:
        'Gemini 1.5/2.0 API prompt tokens for real-time DJ banter scripting, weather/news synthesizers, and neural TTS voice generation credits.',
      percentage: 20,
    },
    {
      category: 'development',
      title: 'Continuous Engineering & Development Time',
      description:
        'Full-time development of audio pipelines, interactive listener bots, Discord & Telegram bridges, station schedule management, and web applications.',
      percentage: 15,
    },
    {
      category: 'coffee',
      title: 'Coffee & Fuel for Maintainers',
      description:
        'Espresso and tea powering late-night bug triage, production monitoring, and community support.',
      percentage: 5,
    },
  ];
}

export function getCryptoDonationWallets(): CryptoDonationWallets {
  const btcAddress =
    process.env.DONATION_BTC_ADDRESS || 'bc1qaplta50757v7c4vrk7vnry0vfd6c47rpmyvnj9';
  const ethAddress =
    process.env.DONATION_ETH_ADDRESS || '0x9581F969727Ff987958d050C80662578C50F6A9f';

  return {
    bitcoin: {
      currency: 'BTC',
      network: 'Bitcoin Mainnet Only',
      address: btcAddress,
      qrScheme: `bitcoin:${btcAddress}?label=PromptFM%20Radio`,
      explorerUrl: `https://mempool.space/address/${btcAddress}`,
    },
    ethereum: {
      currency: 'ETH',
      network: 'Ethereum Mainnet Only (ERC-20 / ETH / USDC)',
      address: ethAddress,
      qrScheme: `ethereum:${ethAddress}`,
      explorerUrl: `https://etherscan.io/address/${ethAddress}`,
    },
  };
}

export function getStripeDonationConfig(): StripeDonationConfig {
  const paymentLink =
    process.env.STRIPE_DONATION_URL || 'https://donate.stripe.com/6oUaEYdUpa9zgEA2H3cQU00';
  return {
    enabled: true,
    paymentLinkUrl: paymentLink,
    supportedMethods: ['card', 'apple_pay', 'google_pay', 'link'],
  };
}

export function getDonationOptions(): DonationOption[] {
  const stripe = getStripeDonationConfig();
  const crypto = getCryptoDonationWallets();

  return [
    {
      id: 'stripe',
      name: 'Stripe Direct (Card / Apple Pay / Google Pay)',
      description: 'Zero-friction direct card checkout with Apple Pay and Google Pay support.',
      url: stripe.paymentLinkUrl,
      fee: 'Standard credit card processing (~2.9% + 30¢)',
      supportsApplePay: true,
      recommendedAudience: 'listeners',
    },
    {
      id: 'github',
      name: 'GitHub Sponsors',
      description: 'Zero platform fees for open source development and hosting costs.',
      url: 'https://github.com/sponsors/promptfm/signup',
      fee: '0% platform fee',
      supportsApplePay: false,
      recommendedAudience: 'developers',
    },
    {
      id: 'kofi',
      name: 'Ko-fi / Buy Me a Coffee',
      description: 'Instant 1-click tips via Apple Pay, Google Pay, Card, and PayPal.',
      url: 'https://ko-fi.com/promptfm',
      fee: '0% on standard donations',
      supportsApplePay: true,
      recommendedAudience: 'listeners',
    },
    {
      id: 'paypal',
      name: 'PayPal.Me Direct Tip',
      description: 'Quick 1-click contribution via your PayPal balance or bank account.',
      url: process.env.PAYPAL_DONATION_URL || 'https://paypal.me/promptfm',
      fee: 'Standard PayPal processing',
      supportsApplePay: false,
      recommendedAudience: 'listeners',
    },
    {
      id: 'bitcoin',
      name: 'Bitcoin (BTC)',
      description: `Direct on-chain Bitcoin contribution to ${crypto.bitcoin.address.slice(0, 8)}...`,
      url: crypto.bitcoin.explorerUrl,
      fee: 'Network miner fee only',
      supportsApplePay: false,
      recommendedAudience: 'crypto_enthusiasts',
    },
    {
      id: 'ethereum',
      name: 'Ethereum (ETH / USDC)',
      description: `Direct ERC-20 & ETH contribution to ${crypto.ethereum.address.slice(0, 8)}...`,
      url: crypto.ethereum.explorerUrl,
      fee: 'Network gas fee only',
      supportsApplePay: false,
      recommendedAudience: 'crypto_enthusiasts',
    },
    {
      id: 'sponsorship',
      name: 'Direct Station Sponsor',
      description: 'On-air audio host-reads and web banner placement during high-traffic shows.',
      url: 'mailto:sponsor@promptfm.live',
      fee: 'Direct wire / invoice',
      supportsApplePay: false,
      recommendedAudience: 'sponsors',
    },
  ];
}

export function getFundingTiers(): FundingTier[] {
  return [
    {
      id: 'coffee',
      name: 'Prompt Supporter',
      amountMonthlyUsd: 5,
      perks: ['Discord Supporter Badge', 'Exclusive prompt engineering tips', 'Access to supporter-only chat'],
    },
    {
      id: 'dj-fan',
      name: 'Resident DJ Patron',
      amountMonthlyUsd: 15,
      perks: [
        'Discord Supporter Badge',
        'Priority queue for submitted music tracks',
        'Personal DJ shoutout on live radio once a month',
      ],
    },
    {
      id: 'station-sponsor',
      name: 'Station Sponsor',
      amountMonthlyUsd: 100,
      perks: [
        'On-air AI host-read sponsorship credit (2x daily)',
        'Clickable logo placement on promptfm.live',
        'Listed in GitHub README and /about credits',
      ],
    },
  ];
}

export function getAdFormatOptions(): AdFormatOption[] {
  return [
    {
      id: 'ai-host-read',
      name: 'Generative AI DJ Host-Read',
      description: 'Native spoken endorsement voiced on-air by the scheduled AI DJ persona during station rotation.',
      durationSeconds: 20,
      readByDjs: true,
      specs: 'Dynamic script generated by Gemini Flash, voiced by Google Neural Audio, broadcast at :20/:40.',
    },
    {
      id: 'produced-spot',
      name: 'Produced Commercial Audio Spot',
      description: 'Pre-recorded 15s to 30s studio-grade audio commercial played during commercial breaks.',
      durationSeconds: 30,
      readByDjs: false,
      targetLoudness: '-14 LUFS',
      specs: 'MP3 44.1kHz / 192kbps, normalized to -14 LUFS (EBU R128) stored on Cloudflare R2.',
    },
  ];
}

export function getFundingMissionStatement(): FundingMissionStatement {
  const breakdown = getFundingBreakdown();
  const colorMap: Record<FundingCategory, string> = {
    commercial_licensing: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    infrastructure: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    ai_compute: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    development: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    coffee: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  };

  const shortTitles: Record<FundingCategory, string> = {
    commercial_licensing: 'Music Licensing & Royalties',
    infrastructure: 'Streaming & Infrastructure',
    ai_compute: 'AI & Neural Voice Credits',
    development: 'Development & Engineering',
    coffee: 'Maintainer Fuel & Coffee',
  };

  const pillars: FundingPillarSummary[] = breakdown.map((item) => ({
    key: item.category,
    title: item.title,
    shortTitle: shortTitles[item.category],
    percentage: item.percentage,
    description: item.description,
    accentColor: colorMap[item.category],
  }));

  return {
    statement:
      '100% of community donations, sponsorships, and advertising revenues go directly towards keeping PromptFM live, legally licensed, and free worldwide without audio subscription paywalls.',
    breakdownSummary:
      'Funds are transparently allocated across 5 operational pillars: statutory music royalties, 24/7 streaming servers, Gemini AI tokens, continuous open-source engineering, and maintainer coffee.',
    pillars,
  };
}

