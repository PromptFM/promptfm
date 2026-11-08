import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('scripts/profile-speed.ts CLI Suite', () => {
  it('runs speed profiling successfully in non-strict mode', () => {
    const output = execSync('npm run profile:speed', {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_SHA: 'testsha123' },
    });

    expect(output).toContain('PromptFM Speed Insights & CI Performance Profiler');
    expect(output).toContain('first_load_js_kb');
    expect(output).toContain('Speed Insights Profiling Complete: All budgets satisfied');
  });

  it('runs speed profiling successfully in strict mode without regressions', () => {
    const output = execSync('npm run test:speed', {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_SHA: 'testsha123' },
    });

    expect(output).toContain('PromptFM Speed Insights & CI Performance Profiler');
    expect(output).toContain('first_load_js_kb');
  });
});
