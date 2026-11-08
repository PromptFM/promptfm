import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAnsibleIapCLI } from '../../scripts/run-ansible-iap';
import * as ansibleRunnerModule from '../../src/lib/infra/ansible-runner';

describe('Ansible IAP Runner CLI (scripts/run-ansible-iap.ts)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips execution and returns 0 when shouldRunAnsible returns false', async () => {
    vi.spyOn(ansibleRunnerModule, 'shouldRunAnsible').mockReturnValue({
      shouldRun: false,
      reason: 'No changes detected',
    });

    const mockExec = vi.fn();
    const exitCode = await runAnsibleIapCLI([], { execCommand: mockExec });

    expect(exitCode).toBe(0);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('executes ansible-playbook via IAP when shouldRunAnsible is true and ansible-playbook exists', async () => {
    vi.spyOn(ansibleRunnerModule, 'shouldRunAnsible').mockReturnValue({
      shouldRun: true,
      reason: 'Changes detected in infra/ansible',
    });

    const mockExec = vi.fn();
    const mockCheckCmd = vi.fn().mockImplementation((cmd: string) => cmd === 'ansible-playbook');

    const exitCode = await runAnsibleIapCLI(['--check'], {
      execCommand: mockExec,
      checkCommandExists: mockCheckCmd,
    });

    expect(exitCode).toBe(0);
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('ansible-playbook -i infra/ansible/inventory.ini')
    );
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('gcloud compute start-iap-tunnel promptfm-streamer')
    );
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('--check --diff')
    );
  });

  it('falls back to gcloud compute ssh when ansible-playbook is missing', async () => {
    vi.spyOn(ansibleRunnerModule, 'shouldRunAnsible').mockReturnValue({
      shouldRun: true,
      reason: 'Streamer VM was updated',
    });

    const mockExec = vi.fn();
    const mockCheckCmd = vi.fn().mockReturnValue(false);

    const exitCode = await runAnsibleIapCLI([], {
      execCommand: mockExec,
      checkCommandExists: mockCheckCmd,
    });

    expect(exitCode).toBe(0);
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('gcloud compute ssh promptfm-streamer')
    );
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('--tunnel-through-iap')
    );
  });

  it('reads terraform apply log file from --terraform-log flag', async () => {
    const shouldRunSpy = vi.spyOn(ansibleRunnerModule, 'shouldRunAnsible').mockReturnValue({
      shouldRun: false,
      reason: 'No changes',
    });

    const mockRead = vi.fn().mockReturnValue('Apply complete! Resources: 0 added');

    await runAnsibleIapCLI(['--terraform-log', '/tmp/tf.log'], {
      readLogFile: mockRead,
    });

    expect(mockRead).toHaveBeenCalledWith('/tmp/tf.log');
    expect(shouldRunSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        terraformOutput: 'Apply complete! Resources: 0 added',
      })
    );
  });

  it('handles execution failure and returns exit code 1', async () => {
    vi.spyOn(ansibleRunnerModule, 'shouldRunAnsible').mockReturnValue({
      shouldRun: true,
      reason: 'Forced execution',
    });

    const mockExec = vi.fn().mockImplementation(() => {
      throw new Error('SSH connection timed out');
    });

    const exitCode = await runAnsibleIapCLI(['--force'], {
      execCommand: mockExec,
      checkCommandExists: () => true,
    });

    expect(exitCode).toBe(1);
  });
});
