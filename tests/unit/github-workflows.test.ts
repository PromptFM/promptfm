import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Actions Workflows Suite', () => {
  const workflowsDir = path.resolve(__dirname, '../../.github/workflows');

  const readWorkflow = (filename: string): string => {
    const filePath = path.join(workflowsDir, filename);
    expect(fs.existsSync(filePath), `Workflow file ${filename} should exist`).toBe(true);
    return fs.readFileSync(filePath, 'utf-8');
  };

  describe('Release PromptFM Workflow (release-promptfm.yml)', () => {
    it('exists and includes workflow_dispatch and promptfm/* tag trigger', () => {
      const content = readWorkflow('release-promptfm.yml');
      expect(content).toContain('name: 🚀 Release PromptFM');
      expect(content).toContain('workflow_dispatch:');
      expect(content).toContain('promptfm/*');
      expect(content).toContain('formatReleaseTag');
      expect(content).toContain('npx vercel --prod');
    });
  });

  describe('Apply Terraform Changes Workflow (apply-terraform.yml)', () => {
    it('exists, listens to promptfm-infra/* tags, and executes prepare-infra before terraform apply', () => {
      const content = readWorkflow('apply-terraform.yml');
      expect(content).toContain('name: 🏗️ Apply Terraform Changes');
      expect(content).toContain('workflow_dispatch:');
      expect(content).toContain('promptfm-infra/*');
      expect(content).toContain('npm run prepare-infra');
      expect(content).toContain('terraform -chdir=infra/terraform init');
      expect(content).toContain('terraform -chdir=infra/terraform apply -auto-approve');
      expect(content).toContain('dns apply promptfm.live');
    });
  });

  describe('Apply Hostinger DNS Workflow (apply-dns.yml)', () => {
    it('exists, supports workflow_dispatch, and executes promptfm dns apply to enforce $0 egress', () => {
      const content = readWorkflow('apply-dns.yml');
      expect(content).toContain('name: 🌐 Apply Hostinger DNS Changes');
      expect(content).toContain('workflow_dispatch:');
      expect(content).toContain('dns apply');
      expect(content).toContain('promptfm.live.state.json');
    });
  });

  describe('Create Preview Link Workflow (create-preview-link.yml)', () => {
    it('exists and accepts commit_sha input or /pr-link comment from core members', () => {
      const content = readWorkflow('create-preview-link.yml');
      expect(content).toContain('name: 🔍 Create Preview Link in Vercel');
      expect(content).toContain('workflow_dispatch:');
      expect(content).toContain('issue_comment:');
      expect(content).toContain('/pr-link');
      expect(content).toContain('npx vercel deploy');
      expect(content).toContain('atrifan');
    });
  });

  describe('Re-test CI Workflow (retest.yml)', () => {
    it('exists, listens for /retest comments from maintainers, and triggers re-run of CI workflow', () => {
      const content = readWorkflow('retest.yml');
      expect(content).toContain('name: 🔁 Re-run CI Checks');
      expect(content).toContain('issue_comment:');
      expect(content).toContain('/retest');
      expect(content).toContain('reRunWorkflow');
      expect(content).toContain('atrifan');
    });
  });

  describe('Update Secrets Workflow (update-secrets.yml)', () => {
    it('exists, requires secret_key/secret_value and references SecretShare guide', () => {
      const content = readWorkflow('update-secrets.yml');
      expect(content).toContain('name: 🔐 Update Secrets in Vercel');
      expect(content).toContain('secret_key:');
      expect(content).toContain('secret_value:');
      expect(content).toContain('secretshare');
      expect(content).toContain('docs/admin-guide.md');
      expect(content).toContain('npx vercel env add');
    });
  });

  describe('Rollback Workflow (rollback.yml)', () => {
    it('exists and creates promptfm/rollback-* tag from commit sha or tag', () => {
      const content = readWorkflow('rollback.yml');
      expect(content).toContain('name: ⏪ Rollback PromptFM');
      expect(content).toContain('rollback_ref:');
      expect(content).toContain('formatRollbackTag');
      expect(content).toContain('resolveGitHubToken');
      expect(content).toContain('npx vercel --prod');
    });
  });

  describe('Rollback Infrastructure Workflow (rollback-infra.yml)', () => {
    it('exists, listens to promptfm-infra/rollback-* tags and workflow_dispatch, and runs terraform plan/apply', () => {
      const content = readWorkflow('rollback-infra.yml');
      expect(content).toContain('name: ⏪ Rollback Infrastructure (Terraform)');
      expect(content).toContain('promptfm-infra/rollback-*');
      expect(content).toContain('workflow_dispatch:');
      expect(content).toContain('terraform -chdir=infra/terraform plan');
      expect(content).toContain('terraform -chdir=infra/terraform apply -auto-approve');
      expect(content).toContain('npm run promptfm -- tag infra-rollback');
    });
  });

  describe('Rollback SQL Migrations Workflow (rollback-sql.yml)', () => {
    it('exists, listens to promptfm-sql/rollback-* tags and workflow_dispatch, and tags rollback release', () => {
      const content = readWorkflow('rollback-sql.yml');
      expect(content).toContain('name: ⏪ Rollback SQL Schema Migrations');
      expect(content).toContain('promptfm-sql/rollback-*');
      expect(content).toContain('workflow_dispatch:');
      expect(content).toContain('target_version:');
      expect(content).toContain('npm run promptfm -- tag sql-rollback');
    });
  });

  describe('Release GH-Pages Workflow (pages.yml)', () => {
    it('exists and deploys documentation to GitHub Pages', () => {
      const content = readWorkflow('pages.yml');
      expect(content).toContain('Release GitHub Pages');
      expect(content).toContain('actions/deploy-pages');
      expect(content).toContain('docs');
    });
  });

  describe('Apply SQL Schema Workflow (apply-sql-schema.yml)', () => {
    it('exists, triggers on manual workflow_dispatch or promptfm-sql/* tags (not auto on main), pulls secrets from Vercel, and executes db:migrate', () => {
      const content = readWorkflow('apply-sql-schema.yml');
      expect(content).toContain('name: 🐘 Apply SQL Schema Migrations');
      expect(content).toContain('workflow_dispatch:');
      expect(content).toContain('promptfm-sql/*');
      expect(content).not.toContain('branches: [main]');
      expect(content).toContain('npm run lint:sql');
      expect(content).toContain('npx vercel env pull .env.production.local --environment=production --yes');
      expect(content).toContain('npm run db:migrate');
    });
  });

  describe('SQL Schema Linter in CI Workflow (ci.yml)', () => {
    it('detects SQL changes and executes npm run lint:sql', () => {
      const content = readWorkflow('ci.yml');
      expect(content).toContain('has_sql');
      expect(content).toContain('npm run lint:sql');
    });
  });

  describe('Speed Insights & Performance Profiling in CI Workflow (ci.yml)', () => {
    it('executes npm run test:speed to detect bundle and runtime latency regressions', () => {
      const content = readWorkflow('ci.yml');
      expect(content).toContain('npm run test:speed');
      expect(content).toMatch(/Speed Insights.*Profiling|test:speed/i);
    });
  });

  describe('Playwright CI Optimization (ci.yml) (Issue #83)', () => {
    it('caches Playwright browser and skips install-deps on cache hit', () => {
      const content = readWorkflow('ci.yml');
      expect(content).toContain('Cache Playwright Browsers');
      expect(content).toContain('playwright-cache');
      expect(content).toContain("if: steps.playwright-cache.outputs.cache-hit != 'true'");
      expect(content).not.toContain("if: steps.playwright-cache.outputs.cache-hit == 'true'\n        run: npx playwright install-deps");
    });
  });

  describe('PR Guidance Bot in CI Workflow (ci.yml)', () => {
    it('contains pr-guidance-comment job with exact matching job name', () => {
      const content = readWorkflow('ci.yml');
      expect(content).toContain('pr-guidance-comment:');
      expect(content).toContain('name: pr-guidance-comment');
      expect(content).toContain('scripts/pr-guidance.ts');
    });
  });

  describe('Infrastructure Checks in CI Workflow (ci.yml)', () => {
    it('audits DNS zones and alerts on direct VM IP leaks or missing edge proxies', () => {
      const content = readWorkflow('ci.yml');
      expect(content).toContain('dns status promptfm.live --strict');
    });

    it('validates and checks Terraform live state vs configuration when infra changes', () => {
      const content = readWorkflow('ci.yml');
      expect(content).toContain('terraform-lint-validate:');
      expect(content).toContain('terraform fmt -check');
      expect(content).toContain('terraform -chdir=infra/terraform validate');
      expect(content).toContain('terraform -chdir=infra/terraform plan');
    });

    it('performs Ansible playbook syntax linting and dry-run task check', () => {
      const content = readWorkflow('ci.yml');
      expect(content).toContain('ansible-lint-dryrun:');
      expect(content).toContain('--syntax-check');
      expect(content).toContain('--list-tasks');
    });
  });

  describe('Automated Release Tagging in Ops Workflows', () => {
    it('records promptfm-sql tag upon successful SQL migration in apply-sql-schema.yml', () => {
      const content = readWorkflow('apply-sql-schema.yml');
      expect(content).toContain('contents: write');
      expect(content).toContain('promptfm -- tag sql');
    });

    it('records promptfm-infra tag upon successful Terraform apply in apply-terraform.yml', () => {
      const content = readWorkflow('apply-terraform.yml');
      expect(content).toContain('contents: write');
      expect(content).toContain('promptfm -- tag infra');
    });
  });

  describe('Workflow syntax validation across all workflows', () => {
    it('does not reference secrets.* directly inside if conditions', () => {
      const workflowFiles = fs
        .readdirSync(workflowsDir)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
      for (const file of workflowFiles) {
        const content = readWorkflow(file);
        // secrets cannot be used directly in if: conditions in GitHub Actions
        const matches = content.match(/if:.*\bsecrets\./g);
        expect(matches, `Workflow ${file} has direct secrets reference in if condition`).toBeNull();
      }
    });

    it('does not combine push paths and tags in the same push event block', () => {
      const terraformWorkflow = readWorkflow('apply-terraform.yml');
      // paths and tags cannot co-exist under the same push trigger in GitHub Actions
      const pushBlock = terraformWorkflow.split('push:')[1]?.split(/^[a-z]/m)[0] || '';
      const hasPaths = pushBlock.includes('paths:');
      const hasTags = pushBlock.includes('tags:');
      expect(hasPaths && hasTags).toBe(false);
    });
  });
});

