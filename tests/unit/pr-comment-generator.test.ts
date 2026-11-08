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

    it('returns false for infra when documentation files change', () => {
      const changes = detectInfraChanges(['README.md', 'docs/admin-guide.md']);
      expect(changes.hasTerraform).toBe(false);
      expect(changes.hasAnsible).toBe(false);
      expect(changes.hasSql).toBe(false);
      expect(changes.hasSecrets).toBe(false);
      expect(changes.hasUi).toBe(false);
    });

    it('detects UI changes when src/app or src/components are modified', () => {
      const changes = detectInfraChanges(['src/app/page.tsx', 'src/components/AudioPlayer.tsx']);
      expect(changes.hasUi).toBe(true);
      expect(changes.hasTerraform).toBe(false);
      expect(changes.hasAnsible).toBe(false);
      expect(changes.hasSql).toBe(false);
    });

    it('detects SQL schema changes when files in supabase/ or *.sql are modified', () => {
      const changes = detectInfraChanges(['supabase/migrations/20261109_new_table.sql']);
      expect(changes.hasSql).toBe(true);
      expect(changes.hasTerraform).toBe(false);
      expect(changes.hasAnsible).toBe(false);
      expect(changes.hasSecrets).toBe(false);
    });

    it('does not trigger SQL schema warning when only SQL engine/scripts/tools change', () => {
      const changes = detectInfraChanges([
        'src/lib/sql/sql-linter.ts',
        'src/lib/sql/sql-migrator.ts',
        'scripts/apply-sql-migrations.ts',
        'scripts/lint-sql.ts',
      ]);
      expect(changes.hasSql).toBe(false);
    });

    it('does not trigger secrets warning for documentation examples (.env.example)', () => {
      const changes = detectInfraChanges(['.env.example', '.env.local.example', 'README.md']);
      expect(changes.hasSecrets).toBe(false);
    });

    it('does not trigger Terraform warning when only TypeScript scripts or docs change', () => {
      const changes = detectInfraChanges(['scripts/prepare-infra.ts', 'infra/README.md']);
      expect(changes.hasTerraform).toBe(false);
    });

    it('detects secret configuration changes when secret files are touched', () => {
      const changes = detectInfraChanges(['infra/terraform/secrets.auto.tfvars', 'src/lib/infra/secrets-sync.ts']);
      expect(changes.hasSecrets).toBe(true);
      expect(changes.hasTerraform).toBe(true);
    });
  });

  describe('generatePRGuidanceComment', () => {
    it('generates preview link instruction with exact commit sha when checks pass', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'be7386564e16dcaaab5f423293c060a1aedded24',
        changedFiles: ['README.md'],
        checksPassed: true,
      });

      expect(comment).toContain('make an admin run the Make preview link workflow on the following sha');
      expect(comment).toContain('be7386564e16dcaaab5f423293c060a1aedded24');
      expect(comment).not.toContain('Update terraform workflow');
      expect(comment).not.toContain('Update ansible workflow');
    });

    it('includes dedicated card for UI changes explaining how to ask for pr-link', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['src/components/AudioPlayer.tsx'],
        checksPassed: true,
      });

      expect(comment).toContain('UI / Frontend Changes Detected');
      expect(comment).toContain('/pr-link');
      expect(comment).toContain('https://github.com/PromptFM/promptfm/actions/workflows/create-preview-link.yml');
    });

    it('includes card for Terraform changes when infra/terraform files are touched', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['infra/terraform/main.tf'],
        checksPassed: true,
      });

      expect(comment).toContain('make an admin run the Make preview link workflow on the following sha');
      expect(comment).toContain('Terraform Infrastructure Update');
      expect(comment).toContain('https://github.com/PromptFM/promptfm/actions/workflows/apply-terraform.yml');
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
      expect(comment).toContain('https://github.com/PromptFM/promptfm/actions/workflows/apply-terraform.yml');
      expect(comment).not.toContain('Update terraform workflow');
    });

    it('includes cards for both Terraform and Ansible when both are touched', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['infra/terraform/outputs.tf', 'infra/ansible/playbook.yml'],
        checksPassed: true,
      });

      expect(comment).toContain('Terraform Infrastructure Update');
      expect(comment).toContain('After merge have an admin run the Update ansible workflow');
    });

    it('does not nest consecutive [!IMPORTANT] alerts inside a single blockquote', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: [
          'infra/terraform/main.tf',
          'supabase/migrations/20261109_new_table.sql',
          'infra/terraform/secrets.auto.tfvars',
        ],
        checksPassed: true,
      });

      // There should only be one [!IMPORTANT] tag, not stacked unseparated duplicates
      const importantMatches = comment.match(/\[!IMPORTANT\]/g);
      expect(importantMatches?.length).toBe(1);
      expect(comment).toContain('Terraform Infrastructure Update');
      expect(comment).toContain('SQL Schema Migrations');
      expect(comment).toContain('Update Secrets workflow');
    });

    it('includes card for Secrets changes with link to update-secrets workflow', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['src/lib/infra/secrets-sync.ts'],
        checksPassed: true,
        prBody: 'Updated secrets sync logic',
      });

      expect(comment).toContain('Secrets Update Required');
      expect(comment).toContain('https://github.com/PromptFM/promptfm/actions/workflows/update-secrets.yml');
    });

    it('includes card for SQL schema changes when supabase or .sql files are touched', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['supabase/migrations/20261108_new_table.sql'],
        checksPassed: true,
      });

      expect(comment).toContain('SQL Schema Migrations');
      expect(comment).toContain('automatically apply');
      expect(comment).toContain('https://github.com/PromptFM/promptfm/actions/workflows/apply-sql-schema.yml');
      expect(comment).not.toContain('Terraform Infrastructure Update');
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

    it('appends environment/secret validation warning when env files are changed without notes in PR body', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['.env.example'],
        checksPassed: true,
        prBody: 'Just fixing some typos in the UI',
      });

      expect(comment).toContain('PR Review Check: Environment & Secret Handoff Required');
      expect(comment).toContain('Missing environment variable notes');
    });

    it('does not append environment validation warning when PR body notes "None"', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['.env.example'],
        checksPassed: true,
        prBody: '## Environment Variables & Secrets Required\nNone',
      });

      expect(comment).not.toContain('PR Review Check: Environment & Secret Handoff Required');
    });

    it('does not append warning when feature-flags.ts is changed and PR body specifies feature flag notes', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['src/lib/flags/feature-flags.ts'],
        checksPassed: true,
        prBody: 'Updated feature flag definitions for live stream',
      });

      expect(comment).not.toContain('PR Review Check: Environment & Secret Handoff Required');
    });

    it('appends warning when feature-flags.ts is changed and body has no flag mention', () => {
      const comment = generatePRGuidanceComment({
        commitSha: 'a1b2c3d4e5f6',
        changedFiles: ['src/lib/flags/feature-flags.ts'],
        checksPassed: true,
        prBody: 'Just updating a file',
      });

      expect(comment).toContain('PR Review Check: Environment & Secret Handoff Required');
      expect(comment).toContain('Missing feature flag activation/deactivation notes');
    });
  });
});

