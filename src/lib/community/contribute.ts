// src/lib/community/contribute.ts
// Structured Contribution Guidelines, Pillars, and Repository Metadata

import { getCommunityLinks } from './links';

export interface ContributionPillar {
  title: string;
  description: string;
  codeSnippet?: string;
}

export const CONTRIBUTION_PILLARS: ContributionPillar[] = [
  {
    title: '1. Fork & Setup ($0 Cost)',
    description:
      'Fork PromptFM/promptfm on GitHub. Clone and run `npm run dev`. Built-in simulation modes let you develop and test full station features locally with zero paid cloud credentials.',
    codeSnippet: 'npm run dev',
  },
  {
    title: '2. Strict TDD & Mutation Gates',
    description:
      'Red → Green → Refactor. Write unit or integration tests in Vitest first, write minimal code to pass, and verify test mutation scores with Stryker (≥ 80% breaking threshold).',
    codeSnippet: 'npm run test:mutate',
  },
  {
    title: '3. Core Team Reviews & CODEOWNERS',
    description:
      'Open your PR linking an active GitHub issue (Fixes #...). Every pull request requires explicit review and approval from the PromptFM Core Team (@PromptFM/core).',
  },
  {
    title: '4. Community Source-Available License',
    description:
      'Governed by the PromptFM Community License. You are encouraged to inspect, fork, test, and contribute. Commercial reselling, code extraction, or launching competing public radio clones is strictly prohibited.',
  },
];

export interface ContributionMetadata {
  repoUrl: string;
  forkUrl: string;
  guidelinesUrl: string;
  issuesUrl: string;
  secretSharingPolicy: string;
}

export function getContributionMetadata(): ContributionMetadata {
  const links = getCommunityLinks();
  const repoUrl = links.github || 'https://github.com/PromptFM/promptfm';

  return {
    repoUrl,
    forkUrl: `${repoUrl}/fork`,
    guidelinesUrl: `${repoUrl}/blob/main/CONTRIBUTING.md`,
    issuesUrl: `${repoUrl}/issues`,
    secretSharingPolicy:
      'Never post API keys or tokens in PRs. If a feature needs new Vercel variables, share an ephemeral encrypted link via Password Pusher directly with @PromptFM/core.',
  };
}
