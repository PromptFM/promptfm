#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const outputPath = process.env.GITHUB_OUTPUT;

if (!outputPath) {
  throw new Error('GITHUB_OUTPUT is required');
}

const jiti = require('jiti')(process.cwd());
const { formatReleaseTag } = jiti(path.resolve(process.cwd(), 'src/lib/infra/release-tag.ts'));

function appendOutput(name, value) {
  fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
const currentTag = (process.env.CURRENT_TAG || '').trim();
const inputVersion = (process.env.INPUT_VERSION || '').trim();
const targetRef = (process.env.INPUT_TARGET_COMMIT || '').trim() || 'HEAD';
const targetSha = execFileSync('git', ['rev-parse', targetRef], { encoding: 'utf8' }).trim();

let releaseTag = '';
if (/^(promptfm\/|v\d+\.\d+\.\d+)/.test(currentTag)) {
  releaseTag = currentTag;
} else if (inputVersion.startsWith('promptfm/') || /^v\d+\.\d+\.\d+/.test(inputVersion)) {
  releaseTag = inputVersion;
} else {
  releaseTag = formatReleaseTag(inputVersion || pkg.version || '0.2.0', targetSha);
}

const releaseId =
  releaseTag
    .replace(/^promptfm\//, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63) || `release-${targetSha.slice(0, 12)}`;

appendOutput('release_tag', releaseTag);
appendOutput('release_ref', releaseTag);
appendOutput('release_id', releaseId);
appendOutput('target_sha', targetSha);
