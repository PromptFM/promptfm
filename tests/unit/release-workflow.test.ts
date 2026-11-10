// tests/unit/release-workflow.test.ts
// Verifies that .github/workflows/release.yml correctly coordinates release tags,
// GitHub Deployment objects, and the OCI production deployment path.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Release workflow (.github/workflows/release.yml)', () => {
  const workflowPath = path.resolve(__dirname, '../../.github/workflows/release.yml');

  it('validates release.yml exists and has proper tag and dispatch triggers', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('workflow_dispatch:');
    expect(content).toContain('promptfm/*');
    expect(content).toContain('v*.*.*');
  });

  it('hands production deploys to the OCI web workflow instead of Vercel', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('deploy-web-oci');
    expect(content).toContain('free_tier_gate');
    expect(content).not.toContain('npx vercel --prod');
    expect(content).not.toContain('VERCEL_DEPLOY_HOOK');
  });

  it('builds an OCI multi-arch image that explicitly includes linux/arm64', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('docker buildx');
    expect(content).toMatch(/linux\/amd64,linux\/arm64|linux\/arm64,linux\/amd64/);
  });

  it('probes a candidate release before cutover and records retained release metadata for rollback', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');

    expect(content).toContain('/api/healthz');
    expect(content).toMatch(/cutover/i);
    expect(content).toMatch(/retained[_ -]release|previous[_ -]release/i);
  });
});
