// tests/unit/budget-cli.test.ts
// Unit tests for PromptFM Budget CLI commands

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getInfraBudgetPolicy,
  shouldBuildVercelDeployment,
  evaluateCIJobsForPR,
} from '@/lib/infra/budget-gate';

describe('PromptFM Budget CLI & Policy Interface', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('provides structured $0 budget policy values for CLI formatting', () => {
    const policy = getInfraBudgetPolicy();
    expect(policy.monthlyCostTargetUsd).toBe(0);
    expect(policy.vercelActiveCpuWarningThresholdPercent).toBe(75);
    expect(policy.vercelMaxActiveCpuHoursHobby).toBe(4);
    expect(policy.forkPreviewsRequireApproval).toBe(true);
    expect(policy.autoPreviewsEnabledByDefault).toBe(false);
    expect(policy.protectedPreviewAccess).toBe(true);
  });

  it('evaluates gate decisions properly for CLI gate command', () => {
    const blockedDecision = shouldBuildVercelDeployment({
      vercelEnv: 'preview',
      gitBranch: 'dependabot/npm/foo',
      commitMessage: 'bump dep',
    });
    expect(blockedDecision.shouldBuild).toBe(false);
    expect(blockedDecision.exitCode).toBe(0);

    const allowedDecision = shouldBuildVercelDeployment({
      vercelEnv: 'preview',
      gitBranch: 'feat/test',
      commitMessage: 'feat: add feature [preview]',
    });
    expect(allowedDecision.shouldBuild).toBe(true);
    expect(allowedDecision.exitCode).toBe(1);
  });

  it('evaluates CI job matrix properly for CLI ci command', () => {
    const jobs = evaluateCIJobsForPR({
      actor: 'dependabot[bot]',
      changedFiles: ['package.json'],
    });

    expect(jobs.lintAndTypecheck).toBe(true);
    expect(jobs.unitAndIntegrationTests).toBe(true);
    expect(jobs.playwrightE2E).toBe(false);
    expect(jobs.mutationTesting).toBe(false);
    expect(jobs.packageVulnerabilityScan).toBe(true);
  });
});

