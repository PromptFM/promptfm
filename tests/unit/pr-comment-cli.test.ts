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
    expect(result.commentMarkdown).toContain('After merge have an admin run the Update terraform workflow');
    expect(result.hasInfraChanges).toBe(true);
  });
});

