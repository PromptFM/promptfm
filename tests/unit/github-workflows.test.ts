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

  describe('Release GH-Pages Workflow (pages.yml)', () => {
    it('exists and deploys documentation to GitHub Pages', () => {
      const content = readWorkflow('pages.yml');
      expect(content).toContain('Release GitHub Pages');
      expect(content).toContain('actions/deploy-pages');
      expect(content).toContain('docs');
    });
  });

  describe('Apply SQL Schema Workflow (apply-sql-schema.yml)', () => {
    it('exists, triggers on main push and workflow_dispatch, pulls secrets from Vercel, and executes db:migrate', () => {
      const content = readWorkflow('apply-sql-schema.yml');
      expect(content).toContain('name: 🐘 Apply SQL Schema Migrations');
      expect(content).toContain('workflow_dispatch:');
      expect(content).toContain('branches: [main]');
      expect(content).toContain('supabase/**');
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
});

