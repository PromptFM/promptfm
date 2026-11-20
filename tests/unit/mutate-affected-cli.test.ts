import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('scripts/mutate-affected.ts CLI Execution Suite', () => {
  it('detects affected hunk mutation ranges and related test files against a changed commit', () => {
    const output = execSync('npx jiti scripts/mutate-affected.ts --base HEAD~1', {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    });

    expect(output).toContain('[Stryker:Targeted] Comparing changed files against base ref: HEAD~1');
    expect(output).toContain('target mutation range(s)');
    expect(output).toContain('--testFiles');
  });

  it('exits cleanly with 0 when comparing against an unchanged base ref', () => {
    const output = execSync('npx jiti scripts/mutate-affected.ts --base HEAD', {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    });

    expect(output).toContain('[Stryker:Targeted] Comparing changed files against base ref: HEAD');
    // If working copy has uncommitted changes, it evaluates ranges; otherwise it skips cleanly. Both exit 0.
    const isCleanSkip = output.includes('Skipping Stryker mutation run');
    const isTargetedRun = output.includes('target mutation range(s)');
    expect(isCleanSkip || isTargetedRun).toBe(true);
  });
});
