import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Playwright production server runtime', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const playwrightConfigPath = path.join(rootDir, 'playwright.config.ts');
  const standaloneStartPath = path.join(rootDir, 'scripts/start-standalone.cjs');

  it('keeps CI e2e on npm start while npm start boots the standalone production server', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const playwrightConfig = fs.readFileSync(playwrightConfigPath, 'utf8');

    expect(pkg.scripts?.start).toBe('node scripts/start-standalone.cjs');
    expect(playwrightConfig).toMatch(
      /command:\s*process\.env\.CI\s*\?\s*'npm run start'\s*:\s*`npx next dev -p \$\{PORT\}`/,
    );
  });

  it('stages public and .next/static assets into the standalone runtime before boot', () => {
    const script = fs.readFileSync(standaloneStartPath, 'utf8');

    expect(script).toContain("'.next', 'standalone'");
    expect(script).toContain("'.next', 'static'");
    expect(script).toContain('public');
    expect(script).toMatch(/symlinkSync|cpSync/);
    expect(script).toContain('server.js');
  });
});
