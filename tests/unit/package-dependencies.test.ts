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

  it('ensures package-lock.json contains node_modules/jiti for deterministic npm ci execution', () => {
    const lockPath = path.resolve(process.cwd(), 'package-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

    expect(lock.packages).toHaveProperty('node_modules/jiti');
    expect(lock.packages['node_modules/jiti'].version).toBeDefined();
  });

  it('pins tailwindcss to v3.x in package.json to maintain PostCSS compatibility', () => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    expect(pkg.devDependencies).toHaveProperty('tailwindcss');
    const version = pkg.devDependencies.tailwindcss;
    expect(version).toMatch(/^(\^|~)?3\./);
  });

  it('configures dependabot to ignore major semver updates for tailwindcss', () => {
    const dependabotPath = path.resolve(process.cwd(), '.github/dependabot.yml');
    const content = fs.readFileSync(dependabotPath, 'utf8');

    expect(content).toContain('tailwindcss');
    expect(content).toMatch(/dependency-name:\s*["']tailwindcss["']/);
    expect(content).toMatch(/version-update:semver-major/);
  });
});
