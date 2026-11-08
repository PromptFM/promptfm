import { describe, it, expect, vi } from 'vitest';
import { generatePRCommentOutput } from '@/lib/ci/pr-comment-generator';

describe('PR Comment CLI & Output Generation', () => {
  it('formats comment with commit sha and changes correctly', () => {
    const result = generatePRCommentOutput({
      commitSha: 'c0ffee1234567890',
      changedFiles: ['infra/terraform/main.tf', 'src/app/page.tsx'],
      checksPassed: true,
    });

    expect(result.commentMarkdown).toContain('make an admin run the Make preview link workflow on the following sha: `c0ffee1234567890`');
    expect(result.commentMarkdown).toContain('Terraform Infrastructure');
    expect(result.hasInfraChanges).toBe(true);
    expect(result.hasSql).toBe(false);

    const sqlResult = generatePRCommentOutput({
      commitSha: 'c0ffee1234567890',
      changedFiles: ['supabase/migrations/20261108_table.sql'],
      checksPassed: true,
    });
    expect(sqlResult.hasSql).toBe(true);
    expect(sqlResult.hasInfraChanges).toBe(true);
    expect(sqlResult.commentMarkdown).toContain('SQL Schema Migrations Detected');
    expect(sqlResult.commentMarkdown).toContain('Nothing is applied automatically on merge to `main`');

    const secretsResult = generatePRCommentOutput({
      commitSha: 'c0ffee1234567890',
      changedFiles: ['infra/terraform/secrets.auto.tfvars'],
      checksPassed: true,
      prBody: 'Updated secrets notes',
    });
    expect(secretsResult.hasSecrets).toBe(true);
    expect(secretsResult.hasInfraChanges).toBe(true);
    expect(secretsResult.commentMarkdown).toContain('Update Secrets workflow');
  });
});

