#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const outputPath = process.env.GITHUB_OUTPUT;

if (!outputPath) {
  throw new Error('GITHUB_OUTPUT is required');
}

const jiti = require('jiti')(process.cwd());
const { formatRollbackTag, resolveGitHubToken } = jiti(
  path.resolve(process.cwd(), 'src/lib/infra/release-tag.ts')
);

function appendOutput(name, value) {
  fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

const rollbackRef = (process.env.ROLLBACK_REF || '').trim();
const isCommitSha = /^[0-9a-f]{7,40}$/i.test(rollbackRef);
const isReleaseTag = /^(promptfm\/[A-Za-z0-9._/-]+|v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9._-]+)?)$/i.test(rollbackRef);

if (!isCommitSha && !isReleaseTag) {
  throw new Error('Rollback ref must be an existing commit SHA or release tag.');
}

try {
  if (isCommitSha) {
    execFileSync('git', ['rev-parse', '-q', '--verify', `${rollbackRef}^{commit}`], {
      stdio: 'pipe',
    });
  } else {
    execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${rollbackRef}^{commit}`], {
      stdio: 'pipe',
    });
  }
} catch {
  throw new Error(`Unknown rollback ref: ${rollbackRef}`);
}

const rollbackTag = formatRollbackTag(rollbackRef);

let remoteUrl = '';
try {
  remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
} catch {
  remoteUrl = '';
}

const token = resolveGitHubToken({
  envToken: process.env.GH_PAT || process.env.GITHUB_TOKEN,
  remoteUrl,
});

const releaseId = rollbackTag
  .replace(/^promptfm\//, '')
  .replace(/[^A-Za-z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 63);

appendOutput('rollback_tag', rollbackTag);
appendOutput('release_id', releaseId);
appendOutput('has_token', token ? 'true' : 'false');
