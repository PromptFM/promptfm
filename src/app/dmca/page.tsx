'use client';

// src/app/dmca/page.tsx
// Statutory DMCA Policy, Designated Agent Information & Interactive Takedown Intake Form

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Scale,
  ShieldAlert,
  Mail,
  MapPin,
  Phone,
  FileCheck2,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  DMCA_DESIGNATED_AGENT,
  DMCA_STATUTORY_REQUIREMENTS,
  REPEAT_INFRINGER_POLICY,
  COUNTER_NOTICE_REQUIREMENTS,
  type DmcaNoticePayload,
} from '@/lib/legal/policies';

export default function DmcaPage() {
  const [formData, setFormData] = useState<DmcaNoticePayload>({
    copyrightOwner: '',
    claimantName: '',
    claimantEmail: '',
    workDescription: '',
    infringingIdentifier: '',
    goodFaithStatement: false,
    perjuryStatement: false,
    signature: '',
    details: '',
  });

  const [loading, setLoading] = useState(false);
  const [successTicket, setSuccessTicket] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/dmca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(
          data.errors && data.errors.length > 0
            ? data.errors.join(' • ')
            : data.error || 'Failed to submit DMCA notice.'
        );
      } else {
        setSuccessTicket(data.ticketId);
      }
    } catch {
      setErrorMessage('Network connection error while submitting notice. Please email dmca@promptfm.live directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-zinc-800 pb-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Scale className="w-3.5 h-3.5" />
            17 U.S.C. § 512 Safe Harbor Compliance
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            DMCA Copyright Policy & Takedown Form
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-3xl">
            PromptFM operates in strict compliance with Title II of the Digital Millennium Copyright Act
            (17 U.S.C. § 512) and international intellectual property safe harbors. As an autonomous
            broadcaster of user-prompted AI compositions, we maintain an expedited takedown procedure and a
            mandatory repeat infringer termination policy.
          </p>
        </div>

        {/* Designated Agent Disclosures Box */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            Designated Copyright Agent Information
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300">
            Pursuant to 17 U.S.C. § 512(c)(2), notices of claimed copyright infringement must be sent to the
            PromptFM Designated Copyright Agent:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm pt-2">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Agent & Organization
              </span>
              <p className="font-semibold text-white">{DMCA_DESIGNATED_AGENT.name}</p>
              <p className="text-zinc-400">{DMCA_DESIGNATED_AGENT.organization}</p>
              <p className="text-emerald-400 font-mono text-xs">{DMCA_DESIGNATED_AGENT.statute}</p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Contact Coordinates
              </span>
              <div className="flex items-center gap-2 text-zinc-300">
                <Mail className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <a href={`mailto:${DMCA_DESIGNATED_AGENT.email}`} className="text-emerald-400 hover:underline">
                  {DMCA_DESIGNATED_AGENT.email}
                </a>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Phone className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>{DMCA_DESIGNATED_AGENT.phone}</span>
              </div>
              <div className="flex items-start gap-2 text-zinc-300">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="leading-snug text-xs">{DMCA_DESIGNATED_AGENT.address}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6-Point Statutory Requirements Checklist */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-400" />
            Statutory 6-Point Notice Requirements
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            To be legally effective under 17 U.S.C. § 512(c)(3), your notification must contain all six of the
            following statutory elements:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DMCA_STATUTORY_REQUIREMENTS.map((req, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-300"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px] mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{req}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Notice Submission Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" />
              Submit Formal DMCA Takedown Notice
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Complete this form to submit a verified notification directly to our legal compliance queue.
            </p>
          </div>

          {successTicket ? (
            <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-6 space-y-3 text-center animate-in fade-in">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">DMCA Takedown Notice Received</h3>
              <p className="text-xs text-emerald-200">
                Your notice has been assigned Tracking Ticket{' '}
                <code className="px-2 py-0.5 rounded bg-zinc-900 border border-emerald-500/40 font-mono text-emerald-400">
                  {successTicket}
                </code>
              </p>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Pursuant to statutory safe harbor guidelines, our compliance officers process complete notices within
                24 hours. The claimed track has been flagged for immediate inspection.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="copyrightOwner" className="block text-xs font-semibold text-zinc-300 mb-1">
                    Copyright Owner Name / Company <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="copyrightOwner"
                    name="copyrightOwner"
                    required
                    value={formData.copyrightOwner}
                    onChange={handleChange}
                    placeholder="e.g. Acme Music Publishing Ltd."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="claimantName" className="block text-xs font-semibold text-zinc-300 mb-1">
                    Full Legal Name of Authorized Agent <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="claimantName"
                    name="claimantName"
                    required
                    value={formData.claimantName}
                    onChange={handleChange}
                    placeholder="e.g. Jane Doe, Esq."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="claimantEmail" className="block text-xs font-semibold text-zinc-300 mb-1">
                    Claimant Contact Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    id="claimantEmail"
                    name="claimantEmail"
                    required
                    value={formData.claimantEmail}
                    onChange={handleChange}
                    placeholder="legal@rightsholder.com"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="infringingIdentifier" className="block text-xs font-semibold text-zinc-300 mb-1">
                    Infringing Track ID or URL <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="infringingIdentifier"
                    name="infringingIdentifier"
                    required
                    value={formData.infringingIdentifier}
                    onChange={handleChange}
                    placeholder="e.g. trk_123 or https://promptfm.live/track/..."
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="workDescription" className="block text-xs font-semibold text-zinc-300 mb-1">
                  Description of Copyrighted Work Claimed to be Infringed <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="workDescription"
                  name="workDescription"
                  rows={2}
                  required
                  value={formData.workDescription}
                  onChange={handleChange}
                  placeholder="Identify the original recording, album, ISRC, composition, or protected master stems..."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="details" className="block text-xs font-semibold text-zinc-300 mb-1">
                  Additional Evidence / Timestamp / Specific Channel (Optional)
                </label>
                <textarea
                  id="details"
                  name="details"
                  rows={2}
                  value={formData.details || ''}
                  onChange={handleChange}
                  placeholder="Specify airplay time, sampled vocal phrases, or direct stem comparison..."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="goodFaithStatement"
                    required
                    checked={formData.goodFaithStatement}
                    onChange={handleChange}
                    className="mt-0.5 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-400 bg-zinc-950"
                  />
                  <span className="text-xs text-zinc-300 leading-relaxed">
                    <strong>Good Faith Declaration (17 U.S.C. § 512(c)(3)(A)(v)):</strong> I have a good faith belief
                    that use of the copyrighted material described above is not authorized by the copyright owner, its
                    agent, or the law.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="perjuryStatement"
                    required
                    checked={formData.perjuryStatement}
                    onChange={handleChange}
                    className="mt-0.5 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-400 bg-zinc-950"
                  />
                  <span className="text-xs text-zinc-300 leading-relaxed">
                    <strong>Penalty of Perjury Declaration (17 U.S.C. § 512(c)(3)(A)(vi)):</strong> The information in
                    this notification is accurate, and under penalty of perjury, I am the owner or an agent authorized
                    to act on behalf of the owner of an exclusive right that is allegedly infringed.
                  </span>
                </label>
              </div>

              <div>
                <label htmlFor="signature" className="block text-xs font-semibold text-zinc-300 mb-1">
                  Electronic Signature (Type Full Legal Name) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="signature"
                  name="signature"
                  required
                  value={formData.signature}
                  onChange={handleChange}
                  placeholder="/s/ Jane Doe"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Verified DMCA Notice
              </button>
            </form>
          )}
        </div>

        {/* Counter-Notification & Repeat Infringer Policy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-800">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400" />
              Counter-Notification Procedure (17 U.S.C. § 512(g))
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              If your track was removed pursuant to a DMCA notice and you believe this was due to mistake or
              misidentification (e.g. you hold valid commercial rights from Suno/Udio/Stable Audio), you may submit a
              formal Counter-Notification to{' '}
              <a href="mailto:dmca@promptfm.live" className="text-emerald-400 underline">
                dmca@promptfm.live
              </a>
              .
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Upon receipt of a valid counter-notice, PromptFM will provide a copy to the complaining party. Unless the
              copyright owner files a court action seeking an injunction within{' '}
              <strong className="text-zinc-200">
                {COUNTER_NOTICE_REQUIREMENTS.minWaitBusinessDays} to {COUNTER_NOTICE_REQUIREMENTS.maxWaitBusinessDays}{' '}
                business days
              </strong>
              , the removed track will be restored to broadcast rotation.
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Repeat Infringer Policy (17 U.S.C. § 512(i))
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              PromptFM maintains an uncompromising policy regarding intellectual property violations. Accounts, submitters,
              IP ranges, or community identifiers that receive{' '}
              <strong className="text-amber-300">{REPEAT_INFRINGER_POLICY.maxStrikes} verified DMCA takedown notices</strong>{' '}
              are subject to immediate and {REPEAT_INFRINGER_POLICY.action}.
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Uploaders may appeal strikes within {REPEAT_INFRINGER_POLICY.appealWindowDays} days by submitting proof of
              active commercial generative licenses or explicit authorization.
            </p>
          </div>
        </div>

        {/* Links to terms */}
        <div className="text-center text-xs text-zinc-500 pt-6">
          Related legal documentation:{' '}
          <Link href="/terms" className="text-emerald-400 hover:underline">
            Terms of Service
          </Link>{' '}
          •{' '}
          <Link href="/copyright" className="text-emerald-400 hover:underline">
            Commercial AI Licensing & Voice Clone Ban
          </Link>{' '}
          •{' '}
          <Link href="/privacy" className="text-emerald-400 hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
