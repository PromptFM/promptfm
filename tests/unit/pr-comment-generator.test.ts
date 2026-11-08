import { describe, it, expect } from 'vitest';
import {
  generatePRGuidanceComment,
  detectInfraChanges,
} from '@/lib/ci/pr-comment-generator';

describe('PR Comment Guidance Generator', () => {
  describe('detectInfraChanges', () => {
    it('detects terraform changes when files in infra/terraform are modified', () => {
      const changes = detectInfraChanges(['infra/terraform/main.tf', 'README.md']);
      expect(changes.hasTerraform).toBe(true);
      expect(changes.hasAnsible).toBe(false);
    });

    it('detects ansible changes when files in infra/ansible are modified', () => {
      const changes = detectInfraChanges(['infra/ansible/playbook.yml']);
      expect(changes.hasTerraform).toBe(false);
      expect(changes.hasAnsible).toBe(true);
    });

    it('detects both terraform and ansible changes', () => {
      const changes = detectInfraChanges([
        'infra/terraform/variables.tf',
        'infra/ansible/inventory.ini',
        'scripts/prepare-infra.ts',
      ]);
      expect(changes.hasTerraform).toBe(true);
      expect(changes.hasAnsible).toBe(true);
    });

    it('returns false for both when only application files change', () => {
      const changes = detectInfraChanges(['src/app/page.tsx', 'src/components/AudioPlayer.tsx']);
      expect(changes.hasTerraform).toBe(false);
      expect(changes.hasAnsible).toBe(false);
    });
  });

  describe('generatePRGuidanceComment', () => {
    it('generates preview link instruction with exact commit sha when checks pass', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'be7386564e16dcaaab5f423293c060a1aedded24',
        changedFiles: ['src/app/page.tsx'],
        checksPassed: true,
      });

      expect(comment).toContain('make an admin run the Make preview link workflow on the following sha');
      expect(comment).toContain('be7386564e16dcaaab5f423293c060a1aedded24');
      expect(comment).not.toContain('Update terraform workflow');
      expect(comment).not.toContain('Update ansible workflow');
    });

    it('includes card for Terraform changes when infra/terraform files are touched', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['infra/terraform/main.tf'],
        checksPassed: true,
      });

      expect(comment).toContain('make an admin run the Make preview link workflow on the following sha');
      expect(comment).toContain('After merge have an admin run the Update terraform workflow');
      expect(comment).not.toContain('Update ansible workflow');
    });

    it('includes card for Ansible changes when infra/ansible files are touched', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['infra/ansible/roles/streamer/tasks/main.yml'],
        checksPassed: true,
      });

      expect(comment).toContain('make an admin run the Make preview link workflow on the following sha');
      expect(comment).toContain('After merge have an admin run the Update ansible workflow');
      expect(comment).not.toContain('Update terraform workflow');
    });

    it('includes cards for both Terraform and Ansible when both are touched', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['infra/terraform/outputs.tf', 'infra/ansible/playbook.yml'],
        checksPassed: true,
      });

      expect(comment).toContain('After merge have an admin run the Update terraform workflow');
      expect(comment).toContain('After merge have an admin run the Update ansible workflow');
    });

    it('informs that checks must pass when checksPassed is false', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['src/app/page.tsx'],
        checksPassed: false,
      });

      expect(comment).toContain('Quality and security checks must pass');
      expect(comment).not.toContain('make an admin run the Make preview link workflow');
    });
  });
});

