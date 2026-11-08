#!/usr/bin/env node
// scripts/pr-guidance.ts
// Generates PR guidance markdown comment and posts to PR or writes to file.

import { execSync } from 'child_process';
import * as fs from 'fs';
import { generatePRCommentOutput } from '../src/lib/ci/pr-comment-generator';

function getChangedFiles(): string[] {
  try {
    const baseRef = process.env.GITHUB_BASE_REF || 'origin/main';
    const output = execSync(`git diff --name-only ${baseRef} HEAD`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    try {
      const fallback = execSync('git diff --name-only HEAD~1 HEAD', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return fallback.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

function main() {
  const commitSha =
    process.env.PR_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

  const changedFiles = getChangedFiles();
  const checksPassed = process.env.CHECKS_PASSED !== 'false';

  const { commentMarkdown, hasInfraChanges } = generatePRCommentOutput({
    commitSha,
    changedFiles,
    checksPassed,
  });

  console.log(`\n======================================================`);
  console.log(`💬 Generated PR Guidance Comment (SHA: ${commitSha})`);
  console.log(`======================================================\n`);
  console.log(commentMarkdown);
  console.log(`\n======================================================\n`);

  // Write to output file if requested
  const outputPath = process.env.COMMENT_OUTPUT_FILE || 'pr_comment.md';
  fs.writeFileSync(outputPath, commentMarkdown, 'utf8');
  console.log(`Written to: ${outputPath}`);

  // Set GitHub Actions step outputs if running in Actions
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `has_infra_changes=${hasInfraChanges}\ncommit_sha=${commitSha}\n`
    );
  }
}

if (require.main === module) {
  main();
}

