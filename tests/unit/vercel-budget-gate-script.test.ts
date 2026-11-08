// tests/unit/vercel-budget-gate-script.test.ts
// Verifies that scripts/vercel-budget-gate.js correctly gates production builds to tags only

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const scriptPath = path.resolve(__dirname, '../../scripts/vercel-budget-gate.js');

function runGate(env: Record<string, string>): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`node "${scriptPath}"`, {
      env: {
        ...process.env,
        ...env,
      },
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // In Vercel ignoreCommand: exit 0 means skipped/cancelled
    return { status: 0, stdout, stderr: '' };
  } catch (err: any) {
    // In Vercel ignoreCommand: exit 1 means proceed with build
    return {
      status: err.status ?? 1,
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || '',
    };
  }
}

describe('scripts/vercel-budget-gate.js CLI Execution', () => {
  it('exits with 0 (cancel build) on routine main merges in production', () => {
    // Provide a dummy SHA to ensure testing untagged commits on main regardless of local/remote git tags
    const result = runGate({
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'main',
      VERCEL_GIT_COMMIT_SHA: '0000000000000000000000000000000000000000',
      VERCEL_GIT_COMMIT_MESSAGE: 'Merge pull request #120 from PromptFM/issue43',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Production auto-deploy from main disabled');
  });

  it('exits with 1 (proceed build) on promptfm/<version> tags in production', () => {
    const result = runGate({
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'promptfm/v1.0.0',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Tagged production release permitted');
  });

  it('exits with 1 (proceed build) on v* tags in production', () => {
    const result = runGate({
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'v0.5.0',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Tagged production release permitted');
  });

  it('exits with 0 (cancel build) on gh-pages/<version> tags in production', () => {
    const result = runGate({
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'gh-pages/v1.0.0',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('GitHub Pages doc release tags do not deploy to Vercel');
  });

  it('exits with 1 when [deploy-prod] is in the commit message', () => {
    const result = runGate({
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'main',
      VERCEL_GIT_COMMIT_MESSAGE: 'urgent hotfix [deploy-prod]',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('Proceeding');
  });
});
