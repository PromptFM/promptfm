import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Safeguards around moving the live stream from the GCP VM to the Oracle host.
describe('Stream cutover safeguards', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const read = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');

  describe('infra tag workflow (apply-terraform.yml)', () => {
    const wf = read('.github/workflows/apply-terraform.yml');

    it('skips Ansible by default, because the GCP VM is retired and a redeploy would start a second Liquidsoap', () => {
      expect(wf).toMatch(/SKIP_FLAG="--skip"\n\s+if \[ "\$\{\{ github\.event\.inputs\.force_ansible \}\}" = "true" \]; then\n\s+SKIP_FLAG=""/);
    });

    it('still lets a manual run force Ansible', () => {
      expect(wf).toContain('FORCE_FLAG="--force"');
      expect(wf).toContain('force_ansible:');
    });
  });

  describe('rollback script (infra/rollback-stream-to-gcp.sh)', () => {
    const sh = read('infra/rollback-stream-to-gcp.sh');
    const at = (needle: string) => {
      const i = sh.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };

    it('puts Oracle in standby before it brings GCP up, and changes DNS last, so only one streamer is on air', () => {
      const standby = at('radio-standby.liq');
      const start = at('gcloud compute instances start');
      const containers = at('docker start promptfm-icecast promptfm-caddy promptfm-liquidsoap');
      const dns = at('dns apply');
      expect(standby).toBeLessThan(start);
      expect(start).toBeLessThan(containers);
      expect(containers).toBeLessThan(dns);
    });

    it('reads the new GCP IP after the restart instead of assuming the old one', () => {
      expect(sh).toContain('networkInterfaces[0].accessConfigs[0].natIP');
      expect(sh.replace(/0\.0\.0\.0\/0/g, '')).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    });

    it('recreates the public 80/443 rule if it was removed', () => {
      expect(sh).toContain('firewall-rules create allow-http-https');
      expect(sh).toContain('--allow=tcp:80,tcp:443');
    });

    it('writes the DNS change to a temporary copy and applies the whole zone from it', () => {
      expect(sh).toContain('mktemp');
      expect(sh).toContain('--state "$STATE"');
    });

    it('is executable and stops on the first error', () => {
      expect(sh.startsWith('#!/usr/bin/env bash')).toBe(true);
      expect(sh).toContain('set -euo pipefail');
      expect(fs.statSync(path.join(rootDir, 'infra/rollback-stream-to-gcp.sh')).mode & 0o111).toBeGreaterThan(0);
    });
  });

  describe('GCP VM (infra/terraform)', () => {
    it('keeps the retired GCP streamer VM stopped unless streamer_vm_running is set', () => {
      const main = read('infra/terraform/main.tf');
      const vars = read('infra/terraform/variables.tf');
      expect(main).toContain('desired_status            = var.streamer_vm_running ? "RUNNING" : "TERMINATED"');
      expect(vars).toMatch(/variable "streamer_vm_running"[\s\S]*?default\s*=\s*false/);
    });

    it('the rollback script mentions flipping the Terraform switch back', () => {
      expect(read('infra/rollback-stream-to-gcp.sh')).toContain('Update infra/dns/');
    });
  });
});
