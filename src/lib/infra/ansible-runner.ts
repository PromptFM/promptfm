// src/lib/infra/ansible-runner.ts
// Decision engine & zero-cost IAP orchestrator for Ansible execution in PromptFM.

import { execSync } from 'child_process';

export const DEFAULT_GCP_PROJECT_ID = 'promptfm-radio-1793623670';
export const DEFAULT_INSTANCE_NAME = 'promptfm-streamer';
export const DEFAULT_ZONE = 'us-central1-a';
export const DEFAULT_PLAYBOOK_PATH = 'infra/ansible/playbook.yml';
export const DEFAULT_INVENTORY_PATH = 'infra/ansible/inventory.ini';

export interface ShouldRunAnsibleOptions {
  changedFiles?: string[];
  terraformOutput?: string;
  forceAnsible?: boolean;
  skipAnsible?: boolean;
  isStreamHealthy?: boolean;
}

export interface AnsibleDecision {
  shouldRun: boolean;
  reason: string;
}

export interface IapSshOptions {
  instanceName?: string;
  zone?: string;
  project?: string;
  command?: string;
}

export interface AnsibleIapOptions {
  playbookPath?: string;
  inventoryPath?: string;
  instanceName?: string;
  zone?: string;
  project?: string;
  extraVars?: Record<string, string>;
  checkOnly?: boolean;
}

export interface DetectChangedFilesOptions {
  baseRef?: string;
  headRef?: string;
  execGit?: (cmd: string) => string;
}

/**
 * Determines whether Ansible playbook execution is necessary based on:
 * 1. Explicit skip or force overrides
 * 2. Changes to infra/ansible files
 * 3. Terraform modifications to the streamer VM
 * 4. Stream service health status
 */
export function shouldRunAnsible(options: ShouldRunAnsibleOptions): AnsibleDecision {
  if (options.skipAnsible) {
    return {
      shouldRun: false,
      reason: 'Explicitly skipped via skip_ansible option',
    };
  }

  if (options.forceAnsible) {
    return {
      shouldRun: true,
      reason: 'Forced execution via force_ansible option',
    };
  }

  if (options.changedFiles && options.changedFiles.length > 0) {
    const hasAnsibleChanges = options.changedFiles.some((f) =>
      /^infra\/ansible\//.test(f.trim())
    );
    if (hasAnsibleChanges) {
      return {
        shouldRun: true,
        reason: 'Changes detected in infra/ansible configuration files',
      };
    }
  }

  if (options.terraformOutput) {
    const vmPattern = /google_compute_instance\.streamer:(?:\s+Creating\.\.\.|\s+Still creating|\s+Creation complete|\s+Modifying\.\.\.|\s+Modifications complete)/i;
    if (vmPattern.test(options.terraformOutput)) {
      return {
        shouldRun: true,
        reason: 'Terraform provisioned or modified the streamer VM instance',
      };
    }
  }

  if (options.isStreamHealthy === false) {
    return {
      shouldRun: true,
      reason: 'Streamer service is marked unhealthy or uninitialized',
    };
  }

  return {
    shouldRun: false,
    reason: 'No Ansible file changes or VM modifications detected; stream is healthy',
  };
}

/**
 * Builds the gcloud compute ssh command to connect to the streamer VM through IAP ($0.00).
 */
export function buildIapSshCommand(options?: IapSshOptions): string {
  const instance = options?.instanceName || DEFAULT_INSTANCE_NAME;
  const zone = options?.zone || DEFAULT_ZONE;
  const project = options?.project || DEFAULT_GCP_PROJECT_ID;

  let cmd = `gcloud compute ssh ${instance} --zone=${zone} --project=${project} --tunnel-through-iap --quiet`;

  if (options?.command) {
    cmd += ` --command="${options.command}"`;
  }

  return cmd;
}

/**
 * Builds the ansible-playbook command with IAP proxy tunneling arguments ($0.00 egress).
 */
export function buildAnsibleIapCommand(options?: AnsibleIapOptions): string {
  const playbook = options?.playbookPath || DEFAULT_PLAYBOOK_PATH;
  const inventory = options?.inventoryPath || DEFAULT_INVENTORY_PATH;
  const instance = options?.instanceName || DEFAULT_INSTANCE_NAME;
  const zone = options?.zone || DEFAULT_ZONE;
  const project = options?.project || DEFAULT_GCP_PROJECT_ID;

  const proxyCmd = `gcloud compute start-iap-tunnel ${instance} %p --listen-on-stdin --project=${project} --zone=${zone}`;
  const sshArgs = `--ssh-common-args='-o ProxyCommand="${proxyCmd}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'`;

  let cmd = `ansible-playbook -i ${inventory} ${playbook} ${sshArgs}`;

  if (options?.checkOnly) {
    cmd += ' --check --diff';
  }

  if (options?.extraVars) {
    for (const [key, value] of Object.entries(options.extraVars)) {
      cmd += ` -e "${key}=${value}"`;
    }
  }

  return cmd;
}

/**
 * Detects changed files under infra/ansible/ between git refs.
 */
export function detectChangedAnsibleFiles(options?: DetectChangedFilesOptions): string[] {
  const execFn =
    options?.execGit ||
    ((cmd: string) =>
      execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }));

  try {
    const base = options?.baseRef || 'HEAD~1';
    const head = options?.headRef || 'HEAD';
    const output = execFn(`git diff --name-only ${base} ${head}`);
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^infra\/ansible\//.test(line));
  } catch {
    return [];
  }
}
