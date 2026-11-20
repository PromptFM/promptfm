import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('scripts/mutate-affected.ts CLI Execution Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const scriptPath = path.join(rootDir, 'scripts/mutate-affected.ts');
  const jitiBin = path.join(rootDir, 'node_modules/.bin/jiti');
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-mutate-cli-test-'));
    execSync('git init && git config user.email "test@promptfm.live" && git config user.name "PromptFM Tester"', {
      cwd: tempDir,
      stdio: 'pipe',
    });
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('exits cleanly with 0 when comparing against an unchanged base ref in repo', () => {
    const output = execSync(`"${jitiBin}" ${scriptPath} --base HEAD --dry-run`, {
      encoding: 'utf8',
      cwd: rootDir,
      env: { ...process.env, NODE_ENV: 'test' },
    });

    expect(output).toContain('[Stryker:Targeted] Comparing changed files against base ref: HEAD');
    const isCleanSkip = output.includes('Skipping Stryker mutation run');
    const isTargetedRun = output.includes('target mutation range(s)');
    expect(isCleanSkip || isTargetedRun).toBe(true);
  });

  it('detects affected hunk line ranges and builds Stryker args in an isolated repository', () => {
    fs.mkdirSync(path.join(tempDir, 'src/lib/dj'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'src/lib/dj/sampler.ts'),
      'export function playSample(volume: number) {\n  return volume > 0;\n}\n'
    );
    execSync('git add . && git commit -m "feat(dj): add sampler"', { cwd: tempDir, stdio: 'pipe' });

    // Modify a functional line in sampler.ts
    fs.writeFileSync(
      path.join(tempDir, 'src/lib/dj/sampler.ts'),
      'export function playSample(volume: number) {\n  return volume >= 10;\n}\n'
    );

    const output = execSync(`"${jitiBin}" ${scriptPath} --base HEAD --dry-run`, {
      encoding: 'utf8',
      cwd: tempDir,
      env: { ...process.env, NODE_ENV: 'test' },
    });

    expect(output).toContain('[Stryker:Targeted] Comparing changed files against base ref: HEAD');
    expect(output).toContain('Found 1 target mutation range(s) across 1 file(s):');
    expect(output).toContain('src/lib/dj/sampler.ts:2-2');
    expect(output).toContain('--mutate src/lib/dj/sampler.ts:2-2');
    expect(output).toContain('[Stryker:Targeted] Dry run active; skipping Stryker execution.');
  });

  it('skips mutation testing cleanly on comment- or whitespace-only diffs', () => {
    fs.mkdirSync(path.join(tempDir, 'src/lib/dj'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'src/lib/dj/sampler.ts'),
      'export function playSample(volume: number) {\n  return volume > 0;\n}\n'
    );
    execSync('git add . && git commit -m "feat(dj): add sampler"', { cwd: tempDir, stdio: 'pipe' });

    // Modify only comments and whitespace
    fs.writeFileSync(
      path.join(tempDir, 'src/lib/dj/sampler.ts'),
      '// Sample player comment\nexport function playSample(volume: number) {\n  return volume > 0;\n}\n'
    );

    const output = execSync(`"${jitiBin}" ${scriptPath} --base HEAD --dry-run`, {
      encoding: 'utf8',
      cwd: tempDir,
      env: { ...process.env, NODE_ENV: 'test' },
    });

    expect(output).toContain('[Stryker:Targeted] All domain changes are comment-, markdown-, or whitespace-only.');
    expect(output).toContain('[Stryker:Targeted] Skipping Stryker mutation run (no functional code changes).');
  });

  it('skips mutation testing when only non-core files are modified', () => {
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Initial README\n');
    execSync('git add . && git commit -m "docs: init readme"', { cwd: tempDir, stdio: 'pipe' });

    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Updated README\n');

    const output = execSync(`"${jitiBin}" ${scriptPath} --base HEAD --dry-run`, {
      encoding: 'utf8',
      cwd: tempDir,
      env: { ...process.env, NODE_ENV: 'test' },
    });

    expect(output).toContain('[Stryker:Targeted] No core domain files modified in this change set.');
    expect(output).toContain('[Stryker:Targeted] Skipping Stryker mutation run (0 mutants to evaluate).');
  });
});
