import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Resend inbound mail Terraform (infra/terraform-resend)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const read = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');
  const main = read('infra/terraform-resend/main.tf');
  const versions = read('infra/terraform-resend/versions.tf');
  const run = read('infra/terraform-resend/run.sh');
  const pkg = JSON.parse(read('package.json'));
  const forwarding = JSON.parse(read('config/inbound-forwarding.json'));

  it('reads the addresses from the file the app uses, not a second list', () => {
    expect(main).toContain('config/inbound-forwarding.json');
    expect(Object.keys(forwarding.aliases).sort()).toEqual(['contact', 'dev', 'legal', 'report']);
  });

  it('adopts the existing webhook instead of creating a second one, for email.received only', () => {
    expect(main).toMatch(/import \{\s*to = resend_webhook\.inbound\s*id = "[0-9a-f-]{36}"/);
    expect(main).toContain('events   = ["email.received"]');
    expect(read('infra/terraform-resend/variables.tf')).toContain('https://promptfm.live/api/webhooks/resend');
  });

  it('cannot override the forwarders: the targets are never written by Terraform, and the webhook and secret cannot be destroyed', () => {
    expect(main).not.toContain('forward_to');
    expect(main).toContain('jsondecode(file(');
    expect(main.match(/prevent_destroy = true/g)?.length).toBe(2);
  });

  it('fails the plan when receiving is not enabled on the domain', () => {
    expect(main).toContain('postcondition');
    expect(main).toContain('capabilities.receiving == "enabled"');
  });

  it('keeps the signing secret in Secret Manager and the API key is read from there', () => {
    expect(main).toContain('google_secret_manager_secret_version" "webhook"');
    expect(main).toContain('resend_webhook.inbound.signing_secret');
    expect(versions).toContain('data "google_secret_manager_secret_version" "resend_api_key"');
    expect(versions).toContain('prefix = "terraform/resend-state"');
  });

  it('never contains a Resend key or webhook secret value', () => {
    for (const f of ['main.tf', 'versions.tf', 'variables.tf', 'outputs.tf', 'run.sh', 'README.md']) {
      const t = read(`infra/terraform-resend/${f}`);
      expect(t, f).not.toMatch(/re_[A-Za-z0-9]{20,}/);
      expect(t, f).not.toMatch(/whsec_[A-Za-z0-9]{20,}/);
    }
  });

  it('has npm run scripts for a local plan and apply that use the same script as CI', () => {
    expect(pkg.scripts['infra:resend:plan']).toBe('infra/terraform-resend/run.sh plan');
    expect(pkg.scripts['infra:resend:apply']).toBe('infra/terraform-resend/run.sh apply');
    expect(run.startsWith('#!/usr/bin/env bash')).toBe(true);
    expect(run).toContain('set -euo pipefail');
    expect(run).toContain('gcloud auth print-access-token');
    expect(fs.statSync(path.join(rootDir, 'infra/terraform-resend/run.sh')).mode & 0o111).toBeGreaterThan(0);
  });
});
