import { describe, it, expect, vi } from 'vitest';
import {
  shouldRunAnsible,
  buildIapSshCommand,
  buildAnsibleIapCommand,
  detectChangedAnsibleFiles,
  type ShouldRunAnsibleOptions,
} from '../../src/lib/infra/ansible-runner';

describe('Ansible IAP Zero-Cost Execution & Decision Engine (src/lib/infra/ansible-runner.ts)', () => {
  describe('shouldRunAnsible()', () => {
    it('returns shouldRun: false when skipAnsible is explicitly true', () => {
      const decision = shouldRunAnsible({
        skipAnsible: true,
        forceAnsible: true,
        changedFiles: ['infra/ansible/playbook.yml'],
      });

      expect(decision.shouldRun).toBe(false);
      expect(decision.reason).toContain('skipped');
    });

    it('returns shouldRun: true when forceAnsible is true and skipAnsible is false', () => {
      const decision = shouldRunAnsible({
        forceAnsible: true,
        changedFiles: [],
      });

      expect(decision.shouldRun).toBe(true);
      expect(decision.reason).toContain('Forced');
    });

    it('returns shouldRun: true when files in infra/ansible/ have changed', () => {
      const decision = shouldRunAnsible({
        changedFiles: [
          'src/app/page.tsx',
          'infra/ansible/roles/streamer/tasks/main.yml',
        ],
      });

      expect(decision.shouldRun).toBe(true);
      expect(decision.reason).toContain('Changes detected in infra/ansible');
    });

    it('returns shouldRun: true when infra/ansible/group_vars/all.yml has changed', () => {
      const decision = shouldRunAnsible({
        changedFiles: ['infra/ansible/group_vars/all.yml'],
      });

      expect(decision.shouldRun).toBe(true);
      expect(decision.reason).toContain('Changes detected in infra/ansible');
    });

    it('returns shouldRun: true when Terraform output indicates streamer VM was created or modified', () => {
      const tfOutput = `
google_compute_instance.streamer: Creating...
google_compute_instance.streamer: Still creating... [10s elapsed]
google_compute_instance.streamer: Creation complete after 15s [id=promptfm-streamer]
Apply complete! Resources: 1 added, 0 changed, 0 destroyed.
`;
      const decision = shouldRunAnsible({
        terraformOutput: tfOutput,
        changedFiles: ['infra/terraform/main.tf'],
      });

      expect(decision.shouldRun).toBe(true);
      expect(decision.reason).toContain('streamer VM');
    });

    it('returns shouldRun: true when Terraform output indicates modifications to streamer VM', () => {
      const tfOutput = `
google_compute_instance.streamer: Modifying... [id=promptfm-streamer]
google_compute_instance.streamer: Modifications complete after 4s [id=promptfm-streamer]
Apply complete! Resources: 0 added, 1 changed, 0 destroyed.
`;
      const decision = shouldRunAnsible({
        terraformOutput: tfOutput,
      });

      expect(decision.shouldRun).toBe(true);
      expect(decision.reason).toContain('streamer VM');
    });

    it('returns shouldRun: true when streamer service is marked unhealthy', () => {
      const decision = shouldRunAnsible({
        isStreamHealthy: false,
        changedFiles: [],
      });

      expect(decision.shouldRun).toBe(true);
      expect(decision.reason).toContain('unhealthy');
    });

    it('returns shouldRun: false when no relevant files changed, Terraform had no VM changes, and stream is healthy', () => {
      const tfOutput = `
Apply complete! Resources: 0 added, 0 changed, 0 destroyed.
`;
      const decision = shouldRunAnsible({
        terraformOutput: tfOutput,
        changedFiles: ['docs/index.html', 'README.md'],
        isStreamHealthy: true,
      });

      expect(decision.shouldRun).toBe(false);
      expect(decision.reason).toContain('No Ansible file changes or VM modifications');
    });

    it('returns shouldRun: false when changedFiles is empty and no Terraform output is supplied', () => {
      const decision = shouldRunAnsible({});

      expect(decision.shouldRun).toBe(false);
      expect(decision.reason).toContain('No Ansible file changes or VM modifications');
    });
  });

  describe('buildIapSshCommand()', () => {
    it('generates standard gcloud compute ssh command with IAP tunneling flags', () => {
      const cmd = buildIapSshCommand();

      expect(cmd).toContain('gcloud compute ssh promptfm-streamer');
      expect(cmd).toContain('--zone=us-central1-a');
      expect(cmd).toContain('--project=promptfm-radio-1793623670');
      expect(cmd).toContain('--tunnel-through-iap');
      expect(cmd).toContain('--quiet');
    });

    it('includes remote command string when command option is provided', () => {
      const cmd = buildIapSshCommand({
        command: 'curl -sI http://localhost:8000/status.xsl',
      });

      expect(cmd).toContain('--command="curl -sI http://localhost:8000/status.xsl"');
    });

    it('allows custom instance name, zone, and project', () => {
      const cmd = buildIapSshCommand({
        instanceName: 'custom-vm',
        zone: 'europe-west1-b',
        project: 'custom-project',
      });

      expect(cmd).toContain('gcloud compute ssh custom-vm');
      expect(cmd).toContain('--zone=europe-west1-b');
      expect(cmd).toContain('--project=custom-project');
    });
  });

  describe('buildAnsibleIapCommand()', () => {
    it('constructs ansible-playbook command with IAP proxy command and defaults', () => {
      const cmd = buildAnsibleIapCommand();

      expect(cmd).toContain('ansible-playbook');
      expect(cmd).toContain('-i infra/ansible/inventory.ini');
      expect(cmd).toContain('infra/ansible/playbook.yml');
      expect(cmd).toContain('--ssh-common-args=');
      expect(cmd).toContain('gcloud compute start-iap-tunnel promptfm-streamer %p --listen-on-stdin');
      expect(cmd).toContain('--project=promptfm-radio-1793623670');
      expect(cmd).toContain('--zone=us-central1-a');
      expect(cmd).toContain('-o StrictHostKeyChecking=no');
    });

    it('appends --check --diff when checkOnly is true', () => {
      const cmd = buildAnsibleIapCommand({
        checkOnly: true,
      });

      expect(cmd).toContain('--check --diff');
    });

    it('includes extra vars formatted as -e "key=value"', () => {
      const cmd = buildAnsibleIapCommand({
        extraVars: {
          app_dir: '/opt/promptfm/streamer',
          stream_bitrate: '192',
        },
      });

      expect(cmd).toContain('-e "app_dir=/opt/promptfm/streamer"');
      expect(cmd).toContain('-e "stream_bitrate=192"');
    });
  });

  describe('detectChangedAnsibleFiles()', () => {
    it('filters git diff output to include only infra/ansible/ files', () => {
      const mockExecGit = vi.fn().mockReturnValue(`
docs/index.html
infra/ansible/roles/streamer/tasks/main.yml
infra/ansible/playbook.yml
infra/terraform/main.tf
src/lib/audio.ts
`.trim());

      const changed = detectChangedAnsibleFiles({ execGit: mockExecGit });

      expect(changed).toEqual([
        'infra/ansible/roles/streamer/tasks/main.yml',
        'infra/ansible/playbook.yml',
      ]);
      expect(mockExecGit).toHaveBeenCalledWith(expect.stringContaining('git diff'));
    });

    it('returns empty array when git execution fails or produces empty output', () => {
      const mockExecGit = vi.fn().mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const changed = detectChangedAnsibleFiles({ execGit: mockExecGit });

      expect(changed).toEqual([]);
    });
  });
});
