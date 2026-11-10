import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('OCI web packaging and runtime build expectations', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const nextConfigPath = path.join(rootDir, 'next.config.mjs');
  const packageJsonPath = path.join(rootDir, 'package.json');

  it('enables Next.js standalone output for a container-friendly runtime artifact', () => {
    const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
    expect(nextConfig).toMatch(/output:\s*['"]standalone['"]/);
  });

  it('defines an OCI image build command that publishes a linux/arm64-capable manifest', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = Object.values(pkg.scripts ?? {}).join('\n');

    expect(scripts).toContain('docker buildx build');
    expect(scripts).toMatch(/--platform\s+linux\/amd64,linux\/arm64|--platform\s+linux\/arm64,linux\/amd64/);
    expect(scripts).toContain('Dockerfile.web');
  });
});
