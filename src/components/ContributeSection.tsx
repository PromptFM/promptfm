// src/components/ContributeSection.tsx
// Community Development & Contributor Portal Section

import React from 'react';
import { GitFork, GitPullRequest, Code2, ShieldCheck, Terminal, ExternalLink, BookOpen, Lock } from 'lucide-react';
import { getContributionMetadata, CONTRIBUTION_PILLARS } from '@/lib/community/contribute';

export default function ContributeSection() {
  const meta = getContributionMetadata();

  const getPillarIcon = (idx: number) => {
    switch (idx) {
      case 0:
        return <GitFork className="w-4 h-4 text-emerald-400" />;
      case 1:
        return <Terminal className="w-4 h-4 text-emerald-400" />;
      case 2:
        return <GitPullRequest className="w-4 h-4 text-emerald-400" />;
      case 3:
      default:
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <section id="contribute" className="w-full max-w-4xl mx-auto px-4 mt-6 text-left space-y-6">
      <div className="bg-gradient-to-br from-zinc-900/95 via-zinc-900/70 to-zinc-950/95 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
        {/* Ambient neon backdrop */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="border-b border-zinc-800 pb-5">
          <div className="inline-flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            Open Community Development
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Drive the AI Radio Forward
          </h2>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            PromptFM is built out in the open by audio hackers, AI researchers, and community developers. 
            Whether you want to engineer new AI DJ personalities, refine audio DSP transitions, add station analytics, 
            or optimize our zero-cost cloud architecture—we invite you to build with us.
          </p>
        </div>

        {/* 4 Pillars of Contribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 text-xs sm:text-sm">
          {CONTRIBUTION_PILLARS.map((pillar, idx) => (
            <div
              key={pillar.title}
              className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                {getPillarIcon(idx)}
                {pillar.title}
              </div>
              <p className="text-zinc-400 leading-relaxed text-xs sm:text-[13px]">
                {pillar.description}
              </p>
              {pillar.codeSnippet && (
                <div className="pt-1">
                  <code className="bg-zinc-900/90 text-emerald-300 px-2 py-0.5 rounded font-mono text-[11px] border border-zinc-800">
                    {pillar.codeSnippet}
                  </code>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Secret Sharing & Security Callout */}
        <div className="mt-4 p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-300">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              <strong className="text-white">Secret Sharing Policy:</strong> Never post API keys in PRs. If introducing new Vercel variables, share an ephemeral link via Password Pusher directly with the Core Team.
            </span>
          </div>
          <a
            href={`${meta.repoUrl}/blob/main/CONTRIBUTING.md#%EF%B8%8F-5-security--secret-sharing-policy`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 font-bold whitespace-nowrap flex items-center gap-1 text-xs"
          >
            Security Guide <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex flex-wrap items-center gap-3">
          <a
            href={meta.forkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-5 py-2.5 rounded-xl transition-colors text-xs sm:text-sm shadow-md shadow-emerald-500/20"
          >
            <GitFork className="w-4 h-4" />
            Fork on GitHub
          </a>
          <a
            href={meta.guidelinesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-xs sm:text-sm bg-zinc-900/60"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            Contribution Guidelines
          </a>
          <a
            href={meta.issuesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white px-4 py-2.5 rounded-xl transition-colors text-xs sm:text-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Browse Good First Issues
          </a>
        </div>
      </div>
    </section>
  );
}
