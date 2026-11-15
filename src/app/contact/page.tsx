// src/app/contact/page.tsx
// Comprehensive Publisher Contact Hub, Department Directory, and Interactive Intake.

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MapPin, Clock, MessageSquare, Shield, HelpCircle, ArrowLeft, HeartHandshake } from 'lucide-react';
import ContactForm from '@/components/ContactForm';
import { STATION_CONTACTS } from '@/lib/contact/contact-info';
import { generateContactPageJsonLd } from '@/lib/seo/structured-data';

export const metadata: Metadata = {
  title: 'Contact PromptFM | Station Operations, Listener Support & DMCA Office',
  description:
    'Get in touch with PromptFM. Direct department routing for technical listener support, AI music submissions, Google AdSense inquiries, and statutory DMCA copyright notices.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact PromptFM — Station Operations & Support',
    description:
      'Direct department routing for technical listener support, AI music submissions, Google AdSense inquiries, and statutory DMCA copyright notices.',
    url: 'https://promptfm.live/contact',
  },
};

export default function ContactPage() {
  const jsonLd = generateContactPageJsonLd();

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-10 pb-36">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-5xl mx-auto space-y-10">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
        </div>

        {/* Editorial Header */}
        <header className="space-y-4 border-b border-zinc-800 pb-8 text-left">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
            <Mail className="w-3.5 h-3.5" />
            Publisher Contact Hub & Directory
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Contact PromptFM
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-3xl">
            Whether you have questions regarding our autonomous broadcast rotation, need technical assistance
            with web streaming, want to submit AI music for airplay curation, or need to reach our statutory
            DMCA compliance officer, we provide direct communication channels.
          </p>
        </header>

        {/* Two Column Layout: Directory & Intake Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
          {/* Department Directory (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-emerald-400" />
                Department Routing
              </h2>

              <div className="space-y-4 divide-y divide-zinc-800/80">
                {STATION_CONTACTS.map((dept) => (
                  <div key={dept.key} className="pt-4 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{dept.name}</span>
                    </div>
                    <p className="text-xs text-zinc-400">{dept.description}</p>
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <a
                        href={`mailto:${dept.email}`}
                        className="text-emerald-400 hover:text-emerald-300 font-mono transition-colors"
                      >
                        {dept.email}
                      </a>
                      <span className="text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dept.sla}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Physical & Legal Address */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-3">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Statutory Headquarters & Mail Intake
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                PromptFM Legal & Copyright Compliance<br />
                13101 Preston Rd, Suite 110<br />
                Dallas, TX 75240, USA
              </p>
              <div className="pt-2 text-xs">
                <Link
                  href="/dmca"
                  className="text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>View Designated DMCA Safe Harbor Agent</span>
                </Link>
              </div>
            </div>

            {/* Quick Link to FAQ */}
            <div className="rounded-2xl border border-zinc-800/60 bg-emerald-950/10 p-5 space-y-2">
              <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                Looking for Immediate Answers?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Check our Knowledge Base for immediate answers on Suno/Udio prompt formatting, commercial licensing,
                and how autonomous voting works.
              </p>
              <Link
                href="/faq"
                className="text-xs text-white hover:text-emerald-400 font-semibold inline-block pt-1 transition-colors"
              >
                Read Station FAQ &rarr;
              </Link>
            </div>
          </div>

          {/* Interactive Form (7 cols) */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-6">
              <div className="border-b border-zinc-800 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  Send an Inquiry
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Fill in the fields below. Messages are transmitted directly to the responsible station personnel.
                </p>
              </div>

              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
