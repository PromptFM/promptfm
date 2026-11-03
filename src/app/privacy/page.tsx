// src/app/privacy/page.tsx
// Comprehensive Privacy Policy, GDPR & CCPA Disclosures

import React from 'react';
import Link from 'next/link';
import { Lock, ShieldCheck, Eye, Database, Globe2, Cookie, ExternalLink, ShieldAlert } from 'lucide-react';
import { ADSENSE_PRIVACY_DISCLOSURE, COOKIE_CONSENT_POLICY } from '@/lib/legal/policies';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-zinc-800 pb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Lock className="w-3.5 h-3.5" />
            Data Protection & Privacy
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Effective Date: November 2, 2026 • Last Updated: November 3, 2026
          </p>
        </div>

        {/* Core Sections */}
        <div className="space-y-8 text-xs sm:text-sm text-zinc-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <Eye className="w-5 h-5 text-emerald-400" />
              1. Information We Collect
            </h2>
            <p>PromptFM collects minimal personal information necessary to deliver our broadcast service:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Uploader Submissions:</strong> Track titles, artist pseudonyms, generation
                tool metadata, lyrics, and audio files uploaded to our cloud storage.
              </li>
              <li>
                <strong className="text-white">Legal & DMCA Reports:</strong> Contact email addresses, claimant legal names,
                and evidence submitted through our DMCA or content moderation forms.
              </li>
              <li>
                <strong className="text-white">Listener Telemetry & Voting:</strong> Aggregated track upvote counters,
                radio channel preference tokens stored locally in your browser (`localStorage`), and transient stream
                connection logs.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <Database className="w-5 h-5 text-emerald-400" />
              2. How We Use Information
            </h2>
            <p>
              Collected data is used solely to maintain live broadcast rotation, power weekly community charts, prevent
              spam and vote flooding, process copyright/DMCA takedowns, and dispatch broadcast announcements to Discord
              and Telegram bridges. We do not sell or monetize personal listener data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <Globe2 className="w-5 h-5 text-emerald-400" />
              3. International Rights (GDPR & CCPA/CPRA)
            </h2>
            <p>
              Under the European General Data Protection Regulation (GDPR) and California Consumer Privacy Act (CCPA), you
              have the right to access, correct, export, or delete any personal information associated with your
              submissions or contact inquiries. To exercise these rights, email{' '}
              <a href="mailto:privacy@promptfm.live" className="text-emerald-400 underline">
                privacy@promptfm.live
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              4. Essential Cookies & Local Browser Storage
            </h2>
            <p>
              PromptFM uses browser <code className="text-emerald-400 font-mono">localStorage</code> and first-party cookies solely to maintain uninterrupted broadcast stream playback and enforce platform safety rules:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Playback State:</strong> Retains active audio volume (<code className="text-zinc-400 font-mono text-xs">player_volume</code>) and current radio channel (<code className="text-zinc-400 font-mono text-xs">active_channel</code>).
              </li>
              <li>
                <strong className="text-white">Statutory Age Verification:</strong> Stores explicit 18+ watershed acknowledgment (<code className="text-zinc-400 font-mono text-xs">promptfm_age_verified_18</code>) to protect minors from explicit AI lyrics.
              </li>
              <li>
                <strong className="text-white">Consent Preferences:</strong> Remembers your privacy choices (<code className="text-zinc-400 font-mono text-xs">promptfm_cookie_consent</code>) so you are not repeatedly prompted.
              </li>
              <li>
                <strong className="text-white">Fair Voting:</strong> Prevents automated voting abuse on community charts without requiring account creation.
              </li>
            </ul>
          </section>

          <section id="advertising" className="space-y-4 scroll-mt-20">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <Cookie className="w-5 h-5 text-emerald-400" />
              5. Google AdSense & Third-Party Advertising Disclosures
            </h2>
            <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-zinc-300">
              <p className="font-semibold text-emerald-300 mb-1">Google AdSense Publisher Notice (ca-pub-7299057534028491)</p>
              <p>{ADSENSE_PRIVACY_DISCLOSURE.summaryText}</p>
            </div>
            <p>
              To ensure full compliance with Google AdSense Publisher Policies, we disclose the following notices regarding third-party vendors and advertising cookies:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-white">Third-Party Vendors:</strong> {ADSENSE_PRIVACY_DISCLOSURE.thirdPartyVendorNotice}
              </li>
              <li>
                <strong className="text-white">Advertising Cookies:</strong> {ADSENSE_PRIVACY_DISCLOSURE.advertisingCookieNotice}
              </li>
              <li>
                <strong className="text-white">Authorized Digital Sellers:</strong> PromptFM publishes an IAB-compliant public <code className="text-emerald-400 font-mono">ads.txt</code> record accessible at{' '}
                <a href="/ads.txt" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline inline-flex items-center gap-0.5">
                  /ads.txt <ExternalLink className="w-3 h-3" />
                </a>.
              </li>
            </ul>

            <div className="mt-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
              <h3 className="font-semibold text-white text-sm">How to Opt Out of Personalized Advertising</h3>
              <p className="text-xs text-zinc-400">
                You may opt out of personalized advertising, manage your ad preferences, or withdraw consent at any time via the following official industry portals:
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <a
                  href={ADSENSE_PRIVACY_DISCLOSURE.optOutLinks.googleAdsSettings}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700 inline-flex items-center gap-1.5 font-medium transition-colors"
                >
                  <span>Google Ads Settings</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={ADSENSE_PRIVACY_DISCLOSURE.optOutLinks.aboutAds}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 inline-flex items-center gap-1.5 font-medium transition-colors"
                >
                  <span>AboutAds Opt-Out (US)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={ADSENSE_PRIVACY_DISCLOSURE.optOutLinks.yourOnlineChoices}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 inline-flex items-center gap-1.5 font-medium transition-colors"
                >
                  <span>Your Online Choices (EU/UK)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
              6. California Consumer Privacy Act (CCPA / CPRA Notice)
            </h2>
            <p>
              {ADSENSE_PRIVACY_DISCLOSURE.ccpaNotice}
            </p>
            <p className="text-zinc-400 text-xs">
              PromptFM does not exchange personal listener data for money. To opt-out of cross-context behavioral ad tracking, select <strong className="text-white">Essential Only</strong> in our Cookie Preferences banner or configure your browser to broadcast an automated Global Privacy Control (GPC) signal.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <Globe2 className="w-5 h-5 text-emerald-400" />
              7. European Economic Area (EEA) & Google EU User Consent
            </h2>
            <p>
              {ADSENSE_PRIVACY_DISCLOSURE.gdprNotice}
            </p>
            <p className="text-zinc-400 text-xs">
              You can adjust or revoke your consent preferences at any time by clicking <strong className="text-white">Cookies</strong> in the site footer.
            </p>
          </section>
        </div>

        {/* Footer links */}
        <div className="border-t border-zinc-800 pt-6 text-center text-xs text-zinc-500">
          Related legal resources:{' '}
          <Link href="/terms" className="text-emerald-400 hover:underline">
            Terms of Service
          </Link>{' '}
          •{' '}
          <Link href="/dmca" className="text-emerald-400 hover:underline">
            DMCA Policy & Designated Agent
          </Link>{' '}
          •{' '}
          <Link href="/copyright" className="text-emerald-400 hover:underline">
            Commercial AI Licensing & Anti-Cloning Rules
          </Link>
        </div>
      </div>
    </div>
  );
}

