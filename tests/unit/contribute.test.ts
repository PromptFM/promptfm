// tests/unit/contribute.test.ts
// Unit tests for PromptFM Community Contribution Pillars & Links

import { describe, it, expect } from 'vitest';
import { getContributionMetadata, CONTRIBUTION_PILLARS } from '@/lib/community/contribute';

describe('Community Contribution Guidelines & Metadata', () => {
  it('provides 4 structured contribution pillars', () => {
    expect(CONTRIBUTION_PILLARS).toHaveLength(4);
    expect(CONTRIBUTION_PILLARS.map((p) => p.title)).toEqual([
      '1. Fork & Setup ($0 Cost)',
      '2. Strict TDD & Mutation Gates',
      '3. Core Team Reviews & CODEOWNERS',
      '4. Community Source-Available License',
    ]);
  });

  it('provides correct GitHub Organization repository URLs', () => {
    const meta = getContributionMetadata();
    expect(meta.repoUrl).toBe('https://github.com/PromptFM/promptfm');
    expect(meta.forkUrl).toBe('https://github.com/PromptFM/promptfm/fork');
    expect(meta.guidelinesUrl).toContain('CONTRIBUTING.md');
    expect(meta.issuesUrl).toBe('https://github.com/PromptFM/promptfm/issues');
  });

  it('enforces secret sharing security policy in metadata', () => {
    const meta = getContributionMetadata();
    expect(meta.secretSharingPolicy).toContain('Password Pusher');
  });
});
