// tests/unit/release-workflow.test.ts
// Verifies that .github/workflows/release.yml correctly coordinates release tags,
// GitHub Deployment objects, and Vercel production deployment triggers.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Release & Vercel Production Gate Workflow (.github/workflows/release.yml)', () => {
  const workflowPath = path.resolve(__dirname, '../../.github/workflows/release.yml');

  it('validates release.yml exists and has proper tag and dispatch triggers', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('workflow_dispatch:');
    expect(content).toContain('promptfm/*');
    expect(content).toContain('v*.*.*');
  });

  it('ensures release tag is pushed to git BEFORE triggering Vercel build / deploy hook', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    const pushTagIndex = content.indexOf('git push origin');
    const vercelDeployIndex = content.indexOf('Verify / Trigger Vercel Production Build');

    expect(pushTagIndex).toBeGreaterThan(-1);
    expect(vercelDeployIndex).toBeGreaterThan(-1);
    expect(pushTagIndex).toBeLessThan(vercelDeployIndex);
  });

  it('ensures GitHub Deployment action attaches the release tag rather than raw commit SHA', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('uses: chrnorm/deployment-action@v2');
    // Must use ref: ${{ steps.meta.outputs.tag }} so GitHub Deployments displays the release tag badge
    expect(content).toMatch(/ref:\s*\${{\s*steps\.meta\.outputs\.tag\s*}}/);
  });

  it('avoids duplicate un-marked deployment by omitting job-level environment when using deployment-action', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    // A job-level "environment: production" creates an automatic GitHub deployment tied to branch name.
    // Combining it with chrnorm/deployment-action creates two deployments for the same run,
    // leaving one un-marked / not Active.
    const jobLevelEnvRegex = /jobs:\s*\n\s*release:\s*\n(?:[^\n]*\n)*?\s*environment:\s*\n\s*name:\s*production/;
    expect(jobLevelEnvRegex.test(content)).toBe(false);
  });

  it('supports VERCEL_TOKEN for CLI direct production deploys alongside VERCEL_DEPLOY_HOOK', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('VERCEL_TOKEN');
    expect(content).toContain('VERCEL_DEPLOY_HOOK');
    expect(content).toContain('npx vercel --prod');
  });
});
