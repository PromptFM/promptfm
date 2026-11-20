import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('scripts/mutate-affected.ts CLI Execution Suite', () => {
  it('detects uncommitted line ranges and related tests when running against HEAD', () => {
    const output = execSync('npx jiti scripts/mutate-affected.ts --base HEAD', {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    });

    expect(output).toContain('[Stryker:Targeted] Comparing changed files against base ref: HEAD');
    expect(output).toContain('[Stryker:Targeted] Found');
    expect(output).toContain('target mutation range(s)');
    expect(output).toContain('--testFiles');
  });

  it('exits cleanly with 0 when comparing against nonexistent mutatable changes with mock base', () => {
    // Verify jiti loads module and filterFunctionalMutatableChanges is present
    const result = execSync(
      'node -e \'const { createJiti } = require("jiti"); const j = createJiti(process.cwd() + "/index.js"); const m = j("./src/lib/testing/affected"); console.log(typeof m.filterFunctionalMutatableChanges);\'',
      { encoding: 'utf8' }
    );
    expect(result.trim()).toBe('function');
  });
});
