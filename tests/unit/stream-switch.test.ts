import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// One declared setting (infra/stream-host) says which host serves the stream. An infra tag at any commit
// converges everything to it: the other host is taken out of service first, so two streamers are never on air.
describe('Stream switch (GCP <-> Oracle)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const exists = (rel: string) => fs.existsSync(path.join(rootDir, rel));
  const read = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');

  describe('infra/stream-host', () => {
    it('declares exactly one host: oracle or gcp', () => {
      expect(['oracle', 'gcp']).toContain(read('infra/stream-host').trim());
    });
  });

  describe('infra/converge-stream.sh', () => {
    const sh = read('infra/converge-stream.sh');

    // Slice the body of one function so ordering is checked per host, not across the whole file.
    const fn = (name: string) => {
      const start = sh.indexOf(`${name}() {`);
      expect(start, `function ${name}`).toBeGreaterThan(-1);
      const end = sh.indexOf('\n}\n', start);
      return sh.slice(start, end);
    };
    const before = (body: string, a: string, b: string) => {
      const i = body.indexOf(a);
      const j = body.indexOf(b);
      expect(i, a).toBeGreaterThan(-1);
      expect(j, b).toBeGreaterThan(-1);
      expect(i).toBeLessThan(j);
    };

    it('is executable, stops on the first error and reads the host from infra/stream-host', () => {
      expect(sh.startsWith('#!/usr/bin/env bash')).toBe(true);
      expect(sh).toContain('set -euo pipefail');
      expect(sh).toContain('infra/stream-host');
      expect(fs.statSync(path.join(rootDir, 'infra/converge-stream.sh')).mode & 0o111).toBeGreaterThan(0);
    });

    it('accepts oracle|gcp to override the file, and quiesce|serve|all', () => {
      expect(sh).toMatch(/oracle\|gcp\)/);
      expect(sh).toMatch(/quiesce\|serve\|all\)/);
    });

    it('for gcp: puts Oracle in standby before GCP comes up', () => {
      const body = fn('quiesce');
      expect(body).toContain('radio-standby.liq');
      expect(body).toMatch(/gcp\)/);
    });

    it('for oracle: quiesce does nothing to GCP, because Terraform stops the VM in the next step', () => {
      const body = fn('quiesce');
      expect(body).toMatch(/oracle\)\s*[:;]|oracle\)\s*\n\s*:/);
    });

    it('for gcp: starts the existing containers (it never redeploys a second stack on the VM), then moves DNS, then verifies', () => {
      const body = fn('serve_gcp');
      expect(body).toContain('docker start promptfm-icecast promptfm-caddy promptfm-liquidsoap');
      expect(body).not.toContain('ansible-playbook');
      before(body, 'docker start', 'point_dns');
      before(body, 'point_dns', 'verify');
    });

    it('for oracle: checks GCP is stopped before Oracle goes on air, then moves DNS, then verifies', () => {
      const body = fn('serve_oracle');
      before(body, 'TERMINATED', 'radio.liq');
      before(body, 'radio.liq', 'point_dns');
      before(body, 'point_dns', 'verify');
    });

    it('reads every IP at run time (the GCP VM gets a new one after each start), never hardcodes one', () => {
      expect(sh).toContain('networkInterfaces[0].accessConfigs[0].natIP');
      expect(sh).toContain('terraform -chdir=infra/terraform-oci output -raw public_ip');
      expect(sh.replace(/0\.0\.0\.0\/0/g, '')).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    });

    it('drives the GCP VM and its public 80/443 rule through Terraform with one variable', () => {
      expect(sh).toContain('-var streamer_vm_running=');
      expect(sh).toContain('-target=google_compute_instance.streamer');
      expect(sh).toContain('-target=google_compute_firewall.allow_web');
    });

    it('writes the DNS change to a temporary copy of the zone file and removes it', () => {
      expect(sh).toContain('mktemp');
      expect(sh).toContain(`--state "$state"`);
      expect(sh).toContain('trap');
    });

    it('cleans up its temporary file with an EXIT trap, not a RETURN trap that fires later with the variable gone (set -u)', () => {
      expect(sh).not.toMatch(/trap [^\n]*RETURN/);
      expect(sh).toMatch(/trap [^\n]*EXIT/);
    });

    it('gets the Hostinger token from Secret Manager when the environment has none, and refuses to run without one', () => {
      expect(sh).toContain('promptfm-hostinger-api-token');
      expect(sh).toContain('gcloud secrets versions access latest');
      const body = fn('point_dns');
      expect(body).toContain('HOSTINGER_API_TOKEN');
      expect(body).toContain('exit 1');
      // without a token the dns command only validates a local file and exits 0, so the DNS record would not move
      before(body, 'exit 1', 'dns apply');
    });

    it('fails when the stream does not answer on the chosen host', () => {
      const body = fn('verify');
      expect(body).toContain('--resolve');
      expect(body).toContain('exit 1');
    });
  });

  describe('Terraform (infra/terraform)', () => {
    const main = read('infra/terraform/main.tf');
    const vars = read('infra/terraform/variables.tf');

    it('opens public 80/443 on GCP only while the GCP VM is meant to serve', () => {
      const block = main.split('resource "google_compute_firewall" "allow_web"')[1]?.split('\n}\n')[0] ?? '';
      expect(block).toMatch(/count\s*=\s*var\.streamer_vm_running\s*\?\s*1\s*:\s*0/);
    });

    it('has no leftover Cloudflare Tunnel switch', () => {
      expect(vars).not.toContain('cloudflare_tunnel_enabled');
      expect(main).not.toContain('cloudflare_tunnel_enabled');
    });
  });

  describe('workflows', () => {
    const apply = read('.github/workflows/apply-terraform.yml');
    const rollback = read('.github/workflows/rollback-infra.yml');

    it('apply: can run by tag, by hand for any ref, and as a reusable workflow', () => {
      expect(apply).toContain('workflow_dispatch:');
      expect(apply).toContain('workflow_call:');
      expect(apply).toContain("- 'promptfm-infra/*'");
      expect(apply).toMatch(/ref:\s*\$\{\{\s*inputs\.ref \|\| github\.ref\s*\}\}/);
    });

    it('apply: a tag whose commit is not on main is not applied automatically (snapshot tags are applied by hand)', () => {
      expect(apply).toContain('git merge-base --is-ancestor');
      expect(apply).toContain('origin/main');
      expect(apply).toContain("steps.guard.outputs.run == 'true'");
    });

    it('apply: ignores promptfm-infra/rollback-* tags and points to the rollback workflow instead', () => {
      expect(apply).toContain('promptfm-infra/rollback-*)');
      expect(apply).toContain('run the Rollback Infrastructure workflow');
    });

    it('apply: sets the GCP VM from infra/stream-host, quiesces before Terraform and serves after it', () => {
      expect(apply).toContain('TF_VAR_streamer_vm_running');
      const quiesce = apply.indexOf('infra/converge-stream.sh quiesce');
      const terraform = apply.indexOf('terraform -chdir=infra/terraform apply');
      const serve = apply.indexOf('infra/converge-stream.sh serve');
      expect(quiesce).toBeGreaterThan(-1);
      expect(quiesce).toBeLessThan(terraform);
      expect(terraform).toBeLessThan(serve);
    });

    it('apply: no longer redeploys the old GCP stack with Ansible over IAP, and does not apply a fixed DNS file', () => {
      expect(apply).not.toContain('npm run promptfm -- ansible');
      expect(apply).not.toContain('force_ansible');
      expect(apply).not.toContain('dns apply promptfm.live --state infra/dns');
    });

    it('apply: records a release tag only for a plain manual run, so applying an existing tag does not create another', () => {
      expect(apply).toMatch(/if:\s*github\.event_name == 'workflow_dispatch' && inputs\.ref == ''/);
    });

    it('apply: never uses secrets inside an if: expression', () => {
      expect(apply).not.toMatch(/if:.*\bsecrets\./);
      expect(rollback).not.toMatch(/if:.*\bsecrets\./);
    });

    it('rollback: reuses the apply workflow for the target ref instead of repeating its steps', () => {
      expect(rollback).toContain('uses: ./.github/workflows/apply-terraform.yml');
      expect(rollback).toMatch(/ref:\s*\$\{\{\s*inputs\.target_ref\s*\}\}/);
      expect(rollback).toContain('secrets: inherit');
      expect(rollback).toContain('npm run promptfm -- tag infra-rollback');
      expect(rollback).not.toContain('terraform -chdir');
    });
  });

  describe('nothing redundant is left behind', () => {
    it('the two one-way scripts are replaced by the single converge script', () => {
      expect(exists('infra/rollback-stream-to-gcp.sh')).toBe(false);
      expect(exists('infra/return-stream-to-oracle.sh')).toBe(false);
      expect(exists('infra/converge-stream.sh')).toBe(true);
    });
  });
});
