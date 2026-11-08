// src/app/status/page.tsx
// Public real-time service health, uptime telemetry, and transparent funding breakdown

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { checkSystemHealth } from '@/lib/status/health-checker';
import {
  getFundingBreakdown,
  getCryptoDonationWallets,
  getStripeDonationConfig,
  getDonationOptions,
} from '@/lib/community/funding';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'System Status & Operational Health',
  description:
    'Real-time uptime, latency, and service availability for PromptFM audio streaming, AI DJ roster, and database infrastructure.',
};

export default async function StatusPage() {
  const health = await checkSystemHealth();
  const breakdown = getFundingBreakdown();
  const cryptoWallets = getCryptoDonationWallets();
  const stripe = getStripeDonationConfig();
  const donationOptions = getDonationOptions();

  const isHealthy = health.status === 'all_operational';
  const isDegraded = health.status === 'degraded_performance';

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-12 md:py-20 font-sans">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-sm font-semibold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
              >
                ← Back to Radio
              </Link>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-2 text-white">
              Prompt<span className="text-emerald-400">FM</span> System Status
            </h1>
            <p className="text-sm md:text-base text-neutral-400 mt-1">
              Live operational telemetry, service latencies, and 30-day uptime monitoring.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 font-mono">
              Updated: {new Date(health.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </header>

        {/* Global Operational Banner */}
        <section
          className={`p-6 rounded-2xl border flex items-center justify-between flex-wrap gap-4 ${
            isHealthy
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : isDegraded
              ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
              : 'bg-red-950/40 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="relative flex h-4 w-4">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-red-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-4 w-4 ${
                  isHealthy ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-red-500'
                }`}
              />
            </span>
            <div>
              <h2 className="text-lg md:text-xl font-bold">
                {isHealthy
                  ? 'All Systems Fully Operational'
                  : isDegraded
                  ? 'Experiencing Degraded Performance'
                  : 'Major Service Outage Detected'}
              </h2>
              <p className="text-xs md:text-sm text-neutral-400">
                Continuous 24/7 radio broadcast with automated real-time health checks.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black font-mono tracking-tight text-white">
              {health.uptimePercentage}%
            </span>
            <span className="block text-xs uppercase tracking-wider text-neutral-400">
              Uptime (30d)
            </span>
          </div>
        </section>

        {/* Service Probes Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Core Component Probes
            </h3>
            <span className="text-xs text-neutral-500 font-mono">Response Latencies (ms)</span>
          </div>

          <div className="divide-y divide-neutral-900 rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm overflow-hidden">
            {health.services.map((service) => {
              const serviceHealthy = service.status === 'operational';
              const serviceDegraded = service.status === 'degraded';

              return (
                <div
                  key={service.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-900/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          serviceHealthy
                            ? 'bg-emerald-500'
                            : serviceDegraded
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <span className="text-base font-semibold text-neutral-100">
                        {service.name}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 pl-5.5">{service.description}</p>
                    {service.error && (
                      <p className="text-xs text-red-400 pl-5.5 font-mono">
                        Error: {service.error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-auto pl-5.5 md:pl-0">
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-neutral-800/80 text-neutral-300">
                      {service.latencyMs} ms
                    </span>
                    <span
                      className={`text-xs uppercase font-bold tracking-wider px-2.5 py-1 rounded ${
                        serviceHealthy
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : serviceDegraded
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {service.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Transparent Funding & Sponsoring Breakdown */}
        <section className="space-y-6 pt-6 border-t border-neutral-800">
          <div>
            <h3 className="text-2xl font-bold text-white">Transparent Community Funding</h3>
            <p className="text-sm text-neutral-400 mt-1">
              PromptFM is an independent project. 100% of community contributions and sponsorships go
              directly into keeping the music playing legally, covering compute, and maintaining the codebase.
            </p>
          </div>

          {/* Allocation Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {breakdown.map((item) => (
              <div
                key={item.category}
                className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/30 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {item.percentage}%
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          {/* Multi-Rail Contribution Options */}
          <div className="p-6 rounded-2xl border border-neutral-800 bg-neutral-900/50 space-y-6">
            <h4 className="text-base font-bold text-white">Support PromptFM (Donation Rails)</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stripe */}
              <a
                href={stripe.paymentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-xl border border-neutral-700 bg-neutral-800 hover:border-emerald-500 hover:bg-neutral-800/80 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Stripe Checkout</span>
                  <span className="text-xs text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Card, Apple Pay, Google Pay, and instant 1-click debit.
                </p>
              </a>

              {/* Ko-fi */}
              <a
                href="https://ko-fi.com/promptfm"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-xl border border-neutral-700 bg-neutral-800 hover:border-amber-500 hover:bg-neutral-800/80 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Ko-fi / Coffee</span>
                  <span className="text-xs text-amber-400 group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Instant tip jar via Apple Pay, PayPal, and credit card.
                </p>
              </a>

              {/* PayPal.Me */}
              <a
                href="https://paypal.me/promptfm"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-xl border border-neutral-700 bg-neutral-800 hover:border-blue-500 hover:bg-neutral-800/80 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">PayPal.Me</span>
                  <span className="text-xs text-blue-400 group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Direct transfer or tip via your PayPal account.
                </p>
              </a>

              {/* GitHub Sponsors */}
              <a
                href="https://github.com/sponsors/promptfm/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-xl border border-neutral-700 bg-neutral-800 hover:border-purple-500 hover:bg-neutral-800/80 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">GitHub Sponsors</span>
                  <span className="text-xs text-purple-400 group-hover:translate-x-0.5 transition-transform">
                    →
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  0% platform fee developer patronage billed via GitHub.
                </p>
              </a>
            </div>

            {/* Crypto Wallets */}
            <div className="pt-4 border-t border-neutral-800 space-y-3">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Direct Crypto Addresses (Bitcoin & Ethereum)
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg bg-neutral-950/70 border border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-400">Bitcoin (BTC)</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">
                        Bitcoin Mainnet Only
                      </span>
                    </div>
                    <a
                      href={cryptoWallets.bitcoin.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-neutral-500 hover:text-neutral-300"
                    >
                      View on Mempool ↗
                    </a>
                  </div>
                  <code className="block text-[11px] font-mono text-neutral-300 break-all select-all">
                    {cryptoWallets.bitcoin.address}
                  </code>
                </div>

                <div className="p-3.5 rounded-lg bg-neutral-950/70 border border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-400">Ethereum (ETH / USDC)</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300">
                        Ethereum Mainnet Only
                      </span>
                    </div>
                    <a
                      href={cryptoWallets.ethereum.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-neutral-500 hover:text-neutral-300"
                    >
                      View on Etherscan ↗
                    </a>
                  </div>
                  <code className="block text-[11px] font-mono text-neutral-300 break-all select-all">
                    {cryptoWallets.ethereum.address}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-neutral-500 pt-8 border-t border-neutral-900 space-y-2">
          <p>
            PromptFM Open Status • Probed continuously via Edge Network •{' '}
            <a
              href="https://github.com/PromptFM/promptfm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:underline"
            >
              GitHub Repository
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

