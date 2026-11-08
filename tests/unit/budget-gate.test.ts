// tests/unit/budget-gate.test.ts
// Unit tests for PromptFM $0 Infra Budget Gate & Vercel Preview Protection Policy

import { describe, it, expect } from 'vitest';
import {
  shouldBuildVercelDeployment,
  isNonApplicationFile,
  isReleaseTag,
  isDocReleaseTag,
  getInfraBudgetPolicy,
  evaluateCIJobsForPR,
  type VercelBuildParams,
} from '@/lib/infra/budget-gate';

describe('Vercel Budget Gate ($0 Infra Policy)', () => {
  describe('shouldBuildVercelDeployment (Production Tag-Based Gating)', () => {
    it('skips production deployments on routine main merges without a release tag to save Active CPU', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'production',
        gitBranch: 'main',
        commitMessage: 'feat: new stream controller (#120)',
      });

      expect(decision.shouldBuild).toBe(false);
      expect(decision.exitCode).toBe(0);
      expect(decision.reason).toContain('Production auto-deploy from main disabled');
    });

    it('permits production deployments when triggered by promptfm/<version> release tags', () => {
      const tags = ['promptfm/v1.0.0', 'promptfm/0.1.0', 'promptfm/1.2.3', 'promptfm/v2.0.0-rc1'];

      for (const tag of tags) {
        const decision = shouldBuildVercelDeployment({
          vercelEnv: 'production',
          gitBranch: tag,
          gitTag: tag,
          commitMessage: `Release ${tag}`,
        });

        expect(decision.shouldBuild).toBe(true);
        expect(decision.exitCode).toBe(1);
        expect(decision.reason).toContain('Tagged production release permitted');
      }
    });

    it('permits production deployments when triggered by standard semver v* tags', () => {
      const tags = ['v1.0.0', 'v0.1.0', 'v2.1.0'];

      for (const tag of tags) {
        const decision = shouldBuildVercelDeployment({
          vercelEnv: 'production',
          gitTag: tag,
        });

        expect(decision.shouldBuild).toBe(true);
        expect(decision.exitCode).toBe(1);
        expect(decision.reason).toContain('Tagged production release permitted');
      }
    });

    it('skips vercel production deployments for gh-pages/<version> tags (docs deploy to GitHub Pages only)', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'production',
        gitTag: 'gh-pages/v1.0.0',
        commitMessage: 'docs: release gh-pages/v1.0.0',
      });

      expect(decision.shouldBuild).toBe(false);
      expect(decision.exitCode).toBe(0);
      expect(decision.reason).toContain('GitHub Pages doc release tags do not deploy to Vercel');
    });

    it('permits production deployment on main when enableMainProductionDeploys flag is explicitly true', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'production',
        gitBranch: 'main',
        enableMainProductionDeploys: true,
      });

      expect(decision.shouldBuild).toBe(true);
      expect(decision.exitCode).toBe(1);
      expect(decision.reason).toContain('Manual override');
    });

    it('permits production deployment on main when commit message has [deploy-prod] or [release]', () => {
      const messages = [
        'hotfix: emergency patch [deploy-prod]',
        'chore: publish update [release]',
      ];

      for (const msg of messages) {
        const decision = shouldBuildVercelDeployment({
          vercelEnv: 'production',
          gitBranch: 'main',
          commitMessage: msg,
        });

        expect(decision.shouldBuild).toBe(true);
        expect(decision.exitCode).toBe(1);
      }
    });
  });

  describe('isReleaseTag & isDocReleaseTag helpers', () => {
    it('correctly classifies PromptFM release tags and docs tags', () => {
      expect(isReleaseTag('promptfm/v1.0.0')).toBe(true);
      expect(isReleaseTag('promptfm/0.1.0')).toBe(true);
      expect(isReleaseTag('v1.0.0')).toBe(true);
      expect(isReleaseTag('v0.2.1-beta')).toBe(true);

      expect(isReleaseTag('main')).toBe(false);
      expect(isReleaseTag('feature/new-ui')).toBe(false);
      expect(isReleaseTag('gh-pages/v1.0.0')).toBe(false);
      expect(isReleaseTag('')).toBe(false);

      expect(isDocReleaseTag('gh-pages/v1.0.0')).toBe(true);
      expect(isDocReleaseTag('gh-pages/0.1.0')).toBe(true);
      expect(isDocReleaseTag('promptfm/v1.0.0')).toBe(false);
      expect(isDocReleaseTag('main')).toBe(false);
    });
  });

  describe('shouldBuildVercelDeployment (Preview Gating)', () => {

    it('skips preview builds when commit message contains [skip preview] or equivalent', () => {
      const cases = [
        'feat: test update [skip preview]',
        'fix: minor typo [skip vercel]',
        'chore: release draft [no-preview]',
        'docs: update guide [skip ci]',
      ];

      for (const msg of cases) {
        const decision = shouldBuildVercelDeployment({
          vercelEnv: 'preview',
          gitBranch: 'feature/stream-ui',
          commitMessage: msg,
        });

        expect(decision.shouldBuild).toBe(false);
        expect(decision.exitCode).toBe(0);
        expect(decision.reason).toContain('commit message tag');
      }
    });

    it('skips preview builds for automated Dependabot branches to save Active CPU', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'preview',
        gitBranch: 'dependabot/npm_and_yarn/next-16.4.5',
        commitMessage: 'bump next from 16.4.3 to 16.4.5',
      });

      expect(decision.shouldBuild).toBe(false);
      expect(decision.exitCode).toBe(0);
      expect(decision.reason).toContain('dependency bot');
    });

    it('skips preview builds for Renovate branches as well', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'preview',
        gitBranch: 'renovate/lucide-react-1.x',
        commitMessage: 'update lucide-react',
      });

      expect(decision.shouldBuild).toBe(false);
      expect(decision.exitCode).toBe(0);
      expect(decision.reason).toContain('dependency bot');
    });

    it('permits preview builds when explicitly requested via [preview] tag', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'preview',
        gitBranch: 'feature/mobile-drawer',
        commitMessage: 'feat: mobile drawer ui [preview]',
      });

      expect(decision.shouldBuild).toBe(true);
      expect(decision.exitCode).toBe(1);
      expect(decision.reason).toContain('Preview explicitly requested');
    });

    it('permits preview builds when forcePreview parameter is true', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'preview',
        gitBranch: 'feature/mobile-drawer',
        forcePreview: true,
      });

      expect(decision.shouldBuild).toBe(true);
      expect(decision.exitCode).toBe(1);
    });

    it('blocks preview builds from forked PRs unless maintainer-approved', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'preview',
        gitBranch: 'external-contributor-patch',
        pullRequestId: '109',
        isFork: true,
        isForkApproved: false,
      });

      expect(decision.shouldBuild).toBe(false);
      expect(decision.exitCode).toBe(0);
      expect(decision.reason).toContain('Forked PR preview requires maintainer authorization');
    });

    it('allows forked PR previews when maintainer has approved them and force preview is set', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'preview',
        gitBranch: 'external-contributor-patch',
        pullRequestId: '109',
        isFork: true,
        isForkApproved: true,
        forcePreview: true,
      });

      expect(decision.shouldBuild).toBe(true);
      expect(decision.exitCode).toBe(1);
    });

    it('skips preview deployments when changed files only contain markdown/docs/infra', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'preview',
        gitBranch: 'docs/update-admin-guide',
        changedFiles: [
          'README.md',
          'docs/admin-guide.md',
          'infra/terraform/main.tf',
          '.github/workflows/ci.yml',
        ],
      });

      expect(decision.shouldBuild).toBe(false);
      expect(decision.exitCode).toBe(0);
      expect(decision.reason).toContain('non-application');
    });

    it('does not skip preview deployments when application source code is modified', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'preview',
        gitBranch: 'feat/audio-buffering',
        changedFiles: [
          'docs/admin-guide.md',
          'src/components/AudioPlayer.tsx',
        ],
        forcePreview: true,
      });

      expect(decision.shouldBuild).toBe(true);
      expect(decision.exitCode).toBe(1);
    });

    it('defaults to skipping preview builds under $0 policy when auto previews are disabled', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'preview',
        gitBranch: 'feature/cool-thing',
        enableAutoPreviews: false,
      });

      expect(decision.shouldBuild).toBe(false);
      expect(decision.exitCode).toBe(0);
      expect(decision.reason).toContain('Automatic preview generation disabled under $0 budget policy');
    });

    it('permits preview builds when enableAutoPreviews is true and no skip tags exist', () => {
      const decision = shouldBuildVercelDeployment({
        vercelEnv: 'preview',
        gitBranch: 'feature/cool-thing',
        enableAutoPreviews: true,
      });

      expect(decision.shouldBuild).toBe(true);
      expect(decision.exitCode).toBe(1);
      expect(decision.reason).toContain('Preview build permitted');
    });
  });

  describe('isNonApplicationFile', () => {
    it('accurately identifies non-application files', () => {
      expect(isNonApplicationFile('README.md')).toBe(true);
      expect(isNonApplicationFile('ROADMAP.md')).toBe(true);
      expect(isNonApplicationFile('docs/index.html')).toBe(true);
      expect(isNonApplicationFile('infra/terraform/main.tf')).toBe(true);
      expect(isNonApplicationFile('.github/workflows/ci.yml')).toBe(true);
      expect(isNonApplicationFile('LICENSE')).toBe(true);
      expect(isNonApplicationFile('.gitleaksignore')).toBe(true);
      expect(isNonApplicationFile('.env.local.example')).toBe(true);
    });

    it('accurately identifies application source files', () => {
      expect(isNonApplicationFile('src/app/page.tsx')).toBe(false);
      expect(isNonApplicationFile('src/lib/dj/rotation.ts')).toBe(false);
      expect(isNonApplicationFile('src/components/AudioPlayer.tsx')).toBe(false);
      expect(isNonApplicationFile('package.json')).toBe(false);
      expect(isNonApplicationFile('vercel.json')).toBe(false);
    });
  });

  describe('getInfraBudgetPolicy', () => {
    it('returns $0 budget constraints and thresholds', () => {
      const policy = getInfraBudgetPolicy();
      expect(policy.monthlyCostTargetUsd).toBe(0);
      expect(policy.vercelActiveCpuWarningThresholdPercent).toBe(75);
      expect(policy.vercelMaxActiveCpuHoursHobby).toBe(4);
      expect(policy.forkPreviewsRequireApproval).toBe(true);
      expect(policy.autoPreviewsEnabledByDefault).toBe(false);
    });
  });

  describe('evaluateCIJobsForPR', () => {
    it('skips heavyweight jobs on pure doc PRs', () => {
      const jobs = evaluateCIJobsForPR({
        changedFiles: ['README.md', 'docs/admin-guide.md'],
        actor: 'contributor',
      });

      expect(jobs.lintAndTypecheck).toBe(true);
      expect(jobs.unitAndIntegrationTests).toBe(false);
      expect(jobs.playwrightE2E).toBe(false);
      expect(jobs.mutationTesting).toBe(false);
      expect(jobs.terraformValidate).toBe(false);
      expect(jobs.codeqlSecurityScan).toBe(false);
    });

    it('runs only targeted checks for Dependabot PRs without 30m mutation testing', () => {
      const jobs = evaluateCIJobsForPR({
        changedFiles: ['package.json', 'package-lock.json'],
        actor: 'dependabot[bot]',
      });

      expect(jobs.lintAndTypecheck).toBe(true);
      expect(jobs.unitAndIntegrationTests).toBe(true);
      expect(jobs.packageVulnerabilityScan).toBe(true);
      expect(jobs.playwrightE2E).toBe(false);
      expect(jobs.mutationTesting).toBe(false);
      expect(jobs.codeqlSecurityScan).toBe(false);
    });

    it('runs terraform validation only when infra files change', () => {
      const jobsInfra = evaluateCIJobsForPR({
        changedFiles: ['infra/terraform/main.tf'],
        actor: 'contributor',
      });
      expect(jobsInfra.terraformValidate).toBe(true);

      const jobsApp = evaluateCIJobsForPR({
        changedFiles: ['src/app/page.tsx'],
        actor: 'contributor',
      });
      expect(jobsApp.terraformValidate).toBe(false);
    });

    it('enables Playwright when UI components or routes change', () => {
      const jobs = evaluateCIJobsForPR({
        changedFiles: ['src/components/AudioPlayer.tsx'],
        actor: 'contributor',
      });
      expect(jobs.playwrightE2E).toBe(true);
      expect(jobs.mutationTesting).toBe(false);
    });

    it('enables mutation testing when core domain logic changes', () => {
      const jobs = evaluateCIJobsForPR({
        changedFiles: ['src/lib/dj/rotation.ts'],
        actor: 'contributor',
      });
      expect(jobs.mutationTesting).toBe(true);
      expect(jobs.playwrightE2E).toBe(false);
      expect(jobs.codeqlSecurityScan).toBe(true);
      expect(jobs.packageVulnerabilityScan).toBe(true);
    });

    it('ensures Dependabot skips Playwright, Mutation, and CodeQL even if UI or core files are touched', () => {
      const jobs = evaluateCIJobsForPR({
        changedFiles: ['src/components/AudioPlayer.tsx', 'src/lib/dj/rotation.ts'],
        actor: 'dependabot[bot]',
      });
      expect(jobs.playwrightE2E).toBe(false);
      expect(jobs.mutationTesting).toBe(false);
      expect(jobs.codeqlSecurityScan).toBe(false);
      expect(jobs.unitAndIntegrationTests).toBe(true);
    });

    it('handles empty changedFiles list safely', () => {
      const jobs = evaluateCIJobsForPR({
        changedFiles: [],
        actor: 'contributor',
      });
      expect(jobs.unitAndIntegrationTests).toBe(true);
      expect(jobs.playwrightE2E).toBe(false);
      expect(jobs.mutationTesting).toBe(false);
      expect(jobs.terraformValidate).toBe(false);
      expect(jobs.codeqlSecurityScan).toBe(true);
    });

    it('runs CI workflow when ci.yml itself is modified', () => {
      const jobs = evaluateCIJobsForPR({
        changedFiles: ['.github/workflows/ci.yml'],
        actor: 'contributor',
      });
      expect(jobs.terraformValidate).toBe(true);
    });
  });
});
