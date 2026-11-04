'use client';

// src/components/FundingSection.tsx
// Community Funding, Transparent Budget Allocation & Multi-Rail Donations

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  CreditCard,
  Coffee,
  Music2,
  Cpu,
  Code2,
  Radio,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  DollarSign,
  Coins,
  Sparkles,
} from 'lucide-react';
import {
  getFundingBreakdown,
  getCryptoDonationWallets,
  getStripeDonationConfig,
  getDonationOptions,
  getFundingMissionStatement,
  FundingCategory,
} from '@/lib/community/funding';

export default function FundingSection() {
  const [copiedWallet, setCopiedWallet] = useState<'btc' | 'eth' | null>(null);

  const mission = getFundingMissionStatement();
  const breakdown = getFundingBreakdown();
  const cryptoWallets = getCryptoDonationWallets();
  const stripe = getStripeDonationConfig();
  const donationOptions = getDonationOptions();

  const handleCopy = async (type: 'btc' | 'eth', address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedWallet(type);
      setTimeout(() => setCopiedWallet(null), 2500);
    } catch {
      // Fallback
    }
  };

  const getPillarIcon = (category: FundingCategory) => {
    switch (category) {
      case 'commercial_licensing':
        return <Music2 className="w-4 h-4 text-amber-400" />;
      case 'infrastructure':
        return <Radio className="w-4 h-4 text-sky-400" />;
      case 'ai_compute':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      case 'development':
        return <Code2 className="w-4 h-4 text-emerald-400" />;
      case 'coffee':
      default:
        return <Coffee className="w-4 h-4 text-rose-400" />;
    }
  };

  const getPillarColorBar = (category: FundingCategory) => {
    switch (category) {
      case 'commercial_licensing':
        return 'bg-amber-400';
      case 'infrastructure':
        return 'bg-sky-400';
      case 'ai_compute':
        return 'bg-purple-400';
      case 'development':
        return 'bg-emerald-400';
      case 'coffee':
      default:
        return 'bg-rose-400';
    }
  };

  return (
    <section id="funding" className="w-full max-w-4xl mx-auto px-4 mt-6 text-left space-y-6">
      <div className="bg-gradient-to-br from-zinc-900/95 via-zinc-900/80 to-zinc-950/95 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden space-y-8">
        {/* Ambient neon backdrop */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="border-b border-zinc-800 pb-6 space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <Heart className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />
            Community Funding & Budget Transparency
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
            Support PromptFM & Music Licensing
          </h2>

          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-3xl">
            {mission.statement}
          </p>

          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            {mission.breakdownSummary}
          </p>
        </div>

        {/* Budget Allocation Breakdown (Where Funds & Ads Go) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Where Does Every Dollar Go? (100% Transparent Allocation)
            </h3>
            <span className="text-xs text-zinc-400 font-mono">
              Statutory Royalties + Infrastructure + AI Credits
            </span>
          </div>

          {/* Proportional Progress Bar */}
          <div className="w-full h-3 rounded-full overflow-hidden bg-zinc-800 flex shadow-inner">
            {breakdown.map((item) => (
              <div
                key={item.category}
                style={{ width: `${item.percentage}%` }}
                className={`${getPillarColorBar(item.category)} h-full transition-all`}
                title={`${item.title} (${item.percentage}%)`}
              />
            ))}
          </div>

          {/* Allocation Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
            {breakdown.map((item) => (
              <div
                key={item.category}
                className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-2 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-white">
                    {getPillarIcon(item.category)}
                    <span>{item.title}</span>
                  </div>
                  <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-zinc-800/90 text-white border border-zinc-700">
                    {item.percentage}%
                  </span>
                </div>
                <p className="text-zinc-400 leading-relaxed text-xs">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Direct 1-Click Payment Rails */}
        <div className="space-y-4 pt-2 border-t border-zinc-800/80">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Direct 1-Click Contribution Rails
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Zero-friction, instant tipping and recurring sponsorship rails. Choose your preferred platform:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Stripe */}
            <a
              href={stripe.paymentLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 hover:border-emerald-500 hover:bg-zinc-900 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Stripe Checkout
                  </span>
                  <span className="text-xs text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Direct card, Apple Pay, Google Pay, and 1-click debit checkout.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                <span>Apple Pay / Cards</span>
                <span className="text-emerald-400 font-semibold">Instant ⚡</span>
              </div>
            </a>

            {/* PayPal */}
            <a
              href="https://paypal.me/promptfm"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 hover:border-sky-500 hover:bg-zinc-900 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                    PayPal.Me Tip
                  </span>
                  <span className="text-xs text-sky-400 group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Quick contribution via your PayPal balance, linked bank account, or debit card.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                <span>paypal.me/promptfm</span>
                <span className="text-sky-400 font-semibold">1-Click</span>
              </div>
            </a>

            {/* Ko-fi */}
            <a
              href="https://ko-fi.com/promptfm"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 hover:border-amber-500 hover:bg-zinc-900 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                    Ko-fi / Coffee
                  </span>
                  <span className="text-xs text-amber-400 group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Tip coffee and track support via Apple Pay, Google Pay, and credit card.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                <span>ko-fi.com/promptfm</span>
                <span className="text-amber-400 font-semibold">Tip Jar ☕</span>
              </div>
            </a>

            {/* GitHub Sponsors */}
            <a
              href="https://github.com/sponsors/PromptFM"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 hover:border-purple-500 hover:bg-zinc-900 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                    GitHub Sponsors
                  </span>
                  <span className="text-xs text-purple-400 group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  0% platform fee developer patronage billed directly with your GitHub invoice.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                <span>0% Platform Fee</span>
                <span className="text-purple-400 font-semibold">Monthly / One-time</span>
              </div>
            </a>
          </div>
        </div>

        {/* Direct Crypto Rails (Bitcoin & Ethereum) */}
        <div className="space-y-4 pt-2 border-t border-zinc-800/80">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              Direct On-Chain Crypto Donations (Bitcoin & Ethereum)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Send sovereign contributions directly on-chain without intermediaries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bitcoin */}
            <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-400">Bitcoin (BTC)</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    Bitcoin Mainnet Only
                  </span>
                </div>
                <a
                  href={cryptoWallets.bitcoin.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  Mempool <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <code className="text-xs font-mono text-zinc-200 break-all select-all block">
                    {cryptoWallets.bitcoin.address}
                  </code>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy('btc', cryptoWallets.bitcoin.address)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:text-white transition-colors"
                >
                  {copiedWallet === 'btc' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy BTC Address</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Ethereum */}
            <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-indigo-400">Ethereum (ETH / USDC)</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    Ethereum Mainnet Only
                  </span>
                </div>
                <a
                  href={cryptoWallets.ethereum.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  Etherscan <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <code className="text-xs font-mono text-zinc-200 break-all select-all block">
                    {cryptoWallets.ethereum.address}
                  </code>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy('eth', cryptoWallets.ethereum.address)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:text-white transition-colors"
                >
                  {copiedWallet === 'eth' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy ETH Address</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry & Transparency Link Footer */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-400 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              Real-time operational health, streaming latency, and financial telemetry are public.
            </span>
          </div>

          <Link
            href="/status"
            className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 whitespace-nowrap hover:underline"
          >
            <span>Live System Status & Telemetry</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
