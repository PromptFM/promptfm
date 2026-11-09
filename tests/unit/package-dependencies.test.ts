import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('package.json dependencies integrity', () => {
  it('explicitly declares jiti in devDependencies to prevent phantom dependency resolution failures', () => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    expect(pkg.devDependencies).toHaveProperty('jiti');
    expect(pkg.devDependencies.jiti).toBeDefined();
    expect(typeof pkg.devDependencies.jiti).toBe('string');
  });

  it('declares all npm script runners in dependencies or devDependencies', () => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    // Any script using jiti requires jiti explicitly declared
    const jitiScripts = Object.entries(pkg.scripts || {}).filter(([_, cmd]) =>
      typeof cmd === 'string' && cmd.trim().startsWith('jiti ')
    );
    expect(jitiScripts.length).toBeGreaterThan(0);
    expect(allDeps).toHaveProperty('jiti');
  });
});
