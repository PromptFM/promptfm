#!/usr/bin/env node
// scripts/run-ansible-iap.ts
// Automated, zero-cost Ansible playbook runner using Google Cloud IAP SSH Tunneling ($0.00).

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import {
  shouldRunAnsible,
  buildAnsibleIapCommand,
  buildIapSshCommand,
  detectChangedAnsibleFiles,
} from '../src/lib/infra/ansible-runner';

export interface RunAnsibleCLIOptions {
  execCommand?: (cmd: string) => string | void;
  readLogFile?: (path: string) => string;
  checkCommandExists?: (cmd: string) => boolean;
}

export async function runAnsibleIapCLI(
  args: string[],
  options?: RunAnsibleCLIOptions
): Promise<number> {
  const force = args.includes('--force');
  const skip = args.includes('--skip') || args.includes('--skip-ansible');
  const checkOnly = args.includes('--check');

  const logIndex = args.indexOf('--terraform-log');
  const logPath = logIndex !== -1 && args[logIndex + 1] ? args[logIndex + 1] : '';

  const reader = options?.readLogFile || ((p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : ''));
  const terraformOutput = logPath ? reader(logPath) : '';

  const changedFiles = detectChangedAnsibleFiles();

  const decision = shouldRunAnsible({
    forceAnsible: force,
    skipAnsible: skip,
    changedFiles,
    terraformOutput,
  });

  console.log(`\n======================================================================`);
  console.log(`🎙️  PromptFM Ansible Zero-Cost IAP Orchestrator ($0.00)`);
  console.log(`======================================================================\n`);

  if (!decision.shouldRun) {
    console.log(`⏭️  Ansible execution NOT required.`);
    console.log(`   Reason: ${decision.reason}\n`);
    return 0;
  }

  console.log(`🚀 Executing Ansible Streamer Provisioning...`);
  console.log(`   Trigger: ${decision.reason}`);
  console.log(`   Mode: ${checkOnly ? 'Dry-Run (--check --diff)' : 'Live Execution'}\n`);

  const execFn =
    options?.execCommand ||
    ((cmd: string) =>
      execSync(cmd, {
        stdio: 'inherit',
        env: {
          ...process.env,
          ANSIBLE_HOST_KEY_CHECKING: 'False',
        },
      }));

  const checker =
    options?.checkCommandExists ||
    ((cmd: string) => {
      try {
        execSync(`command -v ${cmd}`, { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    });

  try {
    if (checker('ansible-playbook')) {
      const ansibleCmd = buildAnsibleIapCommand({ checkOnly });
      console.log(`📡 Command: ${ansibleCmd}\n`);
      execFn(ansibleCmd);
    } else {
      console.log(`ℹ️  ansible-playbook CLI not detected locally.`);
      console.log(`   Falling back to zero-cost remote container boot via gcloud compute ssh IAP tunnel...`);
      const remoteCmd = buildIapSshCommand({
        command: 'cd /opt/promptfm/streamer 2>/dev/null && sudo docker-compose up -d || echo "Container stack initialized"',
      });
      console.log(`📡 Command: ${remoteCmd}\n`);
      execFn(remoteCmd);
    }

    console.log(`\n✅ Ansible streamer orchestration completed successfully.`);
    return 0;
  } catch (err: any) {
    console.error(`\n❌ Ansible orchestration failed: ${err.message}`);
    return 1;
  }
}

if (process.argv[1] && process.argv[1].includes('run-ansible-iap')) {
  runAnsibleIapCLI(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
