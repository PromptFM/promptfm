import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Oracle Cloud streamer module (infra/terraform-oci)', () => {
  const root = path.resolve(__dirname, '../..');
  const read = (rel: string): string => {
    const p = path.join(root, rel);
    expect(fs.existsSync(p), `${rel} should exist`).toBe(true);
    return fs.readFileSync(p, 'utf-8');
  };

  describe('credentials', () => {
    it('reads the Oracle API credentials from one GCP Secret Manager secret, not from files or tfvars', () => {
      const versions = read('infra/terraform-oci/versions.tf');
      expect(versions).toContain('data "google_secret_manager_secret_version" "oci"');
      expect(versions).toContain('jsondecode(data.google_secret_manager_secret_version.oci.secret_data)');
      expect(versions).not.toContain('config_file_profile');
      expect(read('infra/terraform-oci/variables.tf')).toContain('default     = "promptfm-oci-credentials"');
    });

    it('keeps state in the free GCS bucket under its own prefix', () => {
      const versions = read('infra/terraform-oci/versions.tf');
      expect(versions).toContain('backend "gcs"');
      expect(versions).toContain('prefix = "terraform/oci-state"');
    });
  });

  describe('Always Free guardrails', () => {
    const variables = read('infra/terraform-oci/variables.tf');
    const main = read('infra/terraform-oci/main.tf');

    it('only allows the two Always Free shapes: Ampere A1 Flex and the AMD E2.1 Micro', () => {
      const shapes = new Set([...main.matchAll(/VM\.Standard\.[A-Za-z0-9.]+/g)].map((m) => m[0]));
      expect([...shapes].sort()).toEqual(['VM.Standard.A1.Flex', 'VM.Standard.E2.1.Micro']);
      expect(variables).toContain('contains(["A1", "micro"], var.shape)');
    });

    it('pins the micro shape to the one availability domain where Oracle allows it', () => {
      expect(variables).toMatch(/micro_availability_domain_index"[\s\S]*?default\s*=\s*1/);
      expect(main).toContain('local.is_micro ? var.micro_availability_domain_index');
    });

    it('adds swap on the 1 GB micro shape', () => {
      expect(main).toContain('swap_gb = local.is_micro ? 2 : 0');
      expect(read('infra/terraform-oci/cloud-init.yaml')).toContain('fallocate -l ${swap_gb}G /swapfile');
    });

    it('defaults to the deployed shape, so a plain CI plan cannot try to replace the live VM', () => {
      expect(variables).toMatch(/variable "shape"[\s\S]*?default\s*=\s*"micro"/);
      expect(read('infra/terraform-oci/retry-apply.sh')).toContain('-var "shape=A1"');
    });

    it('refuses to replace a live streamer when switching shapes', () => {
      expect(main).toContain('prevent_destroy = true');
    });

    it('caps OCPUs at 2, memory at 12 GB and boot volume at 200 GB (1,500 OCPU-hours / 9,000 GB-hours a month)', () => {
      expect(variables).toContain('var.ocpus >= 1 && var.ocpus <= 2');
      expect(variables).toContain('var.memory_gb >= 1 && var.memory_gb <= 12');
      expect(variables).toContain('var.boot_volume_gb >= 50 && var.boot_volume_gb <= 200');
    });

    it('tries other availability domains when Oracle has no free Arm capacity', () => {
      expect(variables).toContain('variable "availability_domain_index"');
      expect(main).toContain('availability_domains[local.ad_index]');
      expect(main).toContain('local.is_micro ? var.micro_availability_domain_index : var.availability_domain_index');
    });

    it('refuses to plan outside the home region', () => {
      expect(main).toContain('is_home_region');
      expect(main).toContain('precondition');
    });

    it('reserves the public IP so DNS never has to change on restart', () => {
      expect(main).toContain('lifetime       = "RESERVED"');
    });
  });

  describe('$0 policy', () => {
    const main = read('infra/terraform-oci/main.tf');

    it('blocks everything except the Always Free Arm allowance and 200 GB of storage with a quota policy', () => {
      expect(main).toContain('resource "oci_limits_quota" "free_only"');
      expect(main).toContain('"zero compute-core quotas in tenancy"');
      expect(main).toContain('standard-a1-core-regional-count to 2 in tenancy');
      expect(main).toContain('standard-a1-memory-regional-count to 12 in tenancy');
      expect(main).toContain('standard-e2-micro-core-count to 2 in tenancy');
      expect(main).toContain('"zero block-storage quotas in tenancy"');
      expect(main).toContain('total-storage-gb to 200 in tenancy');
    });

    it('applies the quota policy independently of the VM, so the cap exists even while the VM cannot launch', () => {
      const block = main.split('resource "oci_limits_quota" "free_only"')[1]?.split('\n}\n')[0] ?? '';
      expect(block).not.toContain('depends_on');
    });

    it('sends a $1 budget alert and a daily outbound-traffic alarm to the secret-held email', () => {
      const versions = read('infra/terraform-oci/versions.tf');
      expect(versions).toContain('budget_alert_email');
      expect(main).toContain('resource "oci_budget_budget" "streamer"');
      expect(main).toContain('amount         = 1');
      expect(main).toContain('VnicToNetworkBytes[1d]');
      expect(read('infra/terraform-oci/variables.tf')).toMatch(/egress_alarm_gb_per_day"[\s\S]*?default\s*=\s*300/);
    });
  });

  describe('network exposure', () => {
    const main = read('infra/terraform-oci/main.tf');
    const ports = [...main.matchAll(/min = (\d+)/g)].map((m) => Number(m[1]));

    it('opens only SSH, HTTP and HTTPS to the internet', () => {
      expect(ports.sort((a, b) => a - b)).toEqual([22, 80, 443]);
    });

    it('does not open Icecast (8000) publicly', () => {
      expect(ports).not.toContain(8000);
    });
  });

  describe('works the same on a laptop and in CI', () => {
    const main = read('infra/terraform-oci/main.tf');
    const versions = read('infra/terraform-oci/versions.tf');

    it('never reads a file from the home directory without checking it exists (CI runners have no ~/.ssh)', () => {
      const reads = [...main.matchAll(/file\(pathexpand\(var\.ssh_pub_key_path\)\)/g)];
      expect(reads.length).toBeGreaterThan(0);
      expect(main).toContain('fileexists(pathexpand(var.ssh_pub_key_path))');
      expect(main).not.toMatch(/ssh_authorized_keys\s*=\s*file\(/);
    });

    it('takes the SSH public key from the credentials secret, with the local key as an extra', () => {
      expect(main).toContain('local.oci.ssh_public_key');
      expect(main).toContain('ssh_authorized_keys');
      expect(main).toMatch(/length\(local\.ssh_keys\)\s*>\s*0/);
    });

    it('ignores later SSH key edits, because OCI only applies them at first boot', () => {
      expect(main).toContain('metadata["ssh_authorized_keys"]');
    });

    it('documents every key of the credentials secret', () => {
      expect(versions).toContain('ssh_public_key');
      expect(versions).toContain('ssh_private_key');
    });

    it('has one deploy script for laptop and CI that gets the key from Secret Manager and the host from Terraform state', () => {
      const sh = read('infra/ansible/deploy-oci.sh');
      expect(sh).toContain('gcloud secrets versions access latest');
      expect(sh).toContain('promptfm-oci-credentials');
      expect(sh).toContain('ssh_private_key');
      expect(sh).toContain('terraform -chdir=../terraform-oci output -raw public_ip');
      expect(sh).toContain('playbook-oci.yml');
      expect(sh).toContain('env -u ANSIBLE_VAULT_PASSWORD_FILE ansible-playbook');
      expect(sh).toContain('trap');
      expect(sh).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    });

    it('has a manual deploy workflow that is on air unless standby is ticked', () => {
      const wf = read('.github/workflows/deploy-streamer-oci.yml');
      expect(wf).toContain('workflow_dispatch:');
      expect(wf).not.toMatch(/^\s*push:/m);
      expect(wf).not.toMatch(/^\s*schedule:/m);
      expect(wf).toMatch(/standby:\s*\n\s+description:[^\n]*\n\s+type: boolean\n\s+default: false/);
      expect(wf).toContain('infra/ansible/deploy-oci.sh');
      expect(wf).toContain('liquidsoap_script=radio-standby.liq');
      expect(wf).toMatch(/^ {2}deploy-streamer-oci:\n {4}name: deploy-streamer-oci$/m);
      expect(wf).not.toMatch(/if:.*\bsecrets\./);
    });

    it('uses the docker compose v2 plugin, because docker-compose v1 fails recreating containers with ContainerConfig errors', () => {
      const tasks = read('infra/ansible/roles/streamer/tasks/main.yml');
      expect(tasks).toContain('docker-compose-v2');
      expect(tasks).toContain('docker compose up -d');
      expect(tasks).not.toMatch(/command: docker-compose /);
    });

    it('restarts Icecast and Liquidsoap when their config changes, because they do not reload it', () => {
      const tasks = read('infra/ansible/roles/streamer/tasks/main.yml');
      expect(tasks).toContain('docker compose restart icecast');
      expect(tasks).toContain('docker compose restart liquidsoap');
      expect(tasks).toMatch(/icecast_conf is changed/);
    });
  });

  describe('automation', () => {
    it('has a manual-only apply workflow that plans by default', () => {
      const wf = read('.github/workflows/apply-terraform-oci.yml');
      expect(wf).toContain('workflow_dispatch:');
      expect(wf).not.toMatch(/^\s*push:/m);
      expect(wf).not.toMatch(/^\s*schedule:/m);
      expect(wf).toContain('terraform -chdir=infra/terraform-oci plan');
      expect(wf).toMatch(/apply:\s*\n\s+description:[^\n]*\n\s+type: boolean\n\s+default: false/);
      expect(wf).toContain('terraform -chdir=infra/terraform-oci apply -auto-approve');
      expect(wf).not.toMatch(/if:.*\bsecrets\./);
    });

    it('names the apply job the same as its id', () => {
      expect(read('.github/workflows/apply-terraform-oci.yml')).toMatch(
        /^ {2}apply-terraform-oci:\n {4}name: apply-terraform-oci$/m
      );
    });

    it('lints and validates the module in CI', () => {
      const ci = read('.github/workflows/ci.yml');
      expect(ci).toContain('terraform fmt -check -recursive infra/terraform-oci');
      expect(ci).toContain('terraform -chdir=infra/terraform-oci init -backend=false');
      expect(ci).toContain('terraform -chdir=infra/terraform-oci validate');
    });

    it('lets the rotation workflow rotate and audit the credentials secret', () => {
      const rotate = read('.github/workflows/rotate-secrets.yml');
      expect(rotate.match(/promptfm-oci-credentials/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it('has a retry script for Out of host capacity that refreshes the token before init', () => {
      const script = read('infra/terraform-oci/retry-apply.sh');
      expect(script).toContain('Out of host capacity');
      expect(script.indexOf('refresh_token\nterraform init')).toBeGreaterThan(-1);
      expect(script).toContain('availability_domain_index=$ad');
      expect(script).toContain('-var shape=micro');
    });

    it('gets weekly provider updates', () => {
      expect(read('.github/dependabot.yml')).toContain('directory: "/infra/terraform-oci"');
    });
  });
});
