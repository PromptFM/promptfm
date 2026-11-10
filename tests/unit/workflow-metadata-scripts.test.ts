import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const releaseScriptPath = path.join(rootDir, 'scripts/release-workflow-metadata.cjs');
const rollbackScriptPath = path.join(rootDir, 'scripts/rollback-workflow-metadata.cjs');

function runWorkflowScript(scriptPath: string, env: Record<string, string>): Record<string, string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-workflow-meta-'));
  const outputPath = path.join(tmpDir, 'github-output.txt');

  try {
    execFileSync('node', [scriptPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        ...env,
        GITHUB_OUTPUT: outputPath,
      },
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const rawOutput = fs.readFileSync(outputPath, 'utf8');
    return Object.fromEntries(
      rawOutput
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [key, ...valueParts] = line.split('=');
          return [key, valueParts.join('=')];
        })
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('workflow metadata scripts', () => {
  it('computes release workflow outputs from a repo-owned script instead of inline stdin node', () => {
    expect(fs.existsSync(releaseScriptPath)).toBe(true);

    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();
    const outputs = runWorkflowScript(releaseScriptPath, {
      INPUT_VERSION: '0.2.4',
      INPUT_TARGET_COMMIT: 'HEAD',
      CURRENT_TAG: '',
    });

    expect(outputs.release_tag).toBe(`promptfm/0.2.4-${headSha.slice(0, 7)}`);
    expect(outputs.release_ref).toBe(outputs.release_tag);
    expect(outputs.release_id).toBe(`0.2.4-${headSha.slice(0, 7)}`);
    expect(outputs.target_sha).toBe(headSha);
  });

  it('computes rollback workflow outputs from a repo-owned script without relying on __filename from stdin', () => {
    expect(fs.existsSync(rollbackScriptPath)).toBe(true);

    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();
    const outputs = runWorkflowScript(rollbackScriptPath, {
      ROLLBACK_REF: headSha,
      GH_PAT: 'local-token-1234567890',
      GITHUB_TOKEN: '',
    });

    expect(outputs.rollback_tag).toBe(`promptfm/rollback-${headSha.slice(0, 7)}`);
    expect(outputs.release_id).toBe(`rollback-${headSha.slice(0, 7)}`);
    expect(outputs.has_token).toBe('true');
  });
});
