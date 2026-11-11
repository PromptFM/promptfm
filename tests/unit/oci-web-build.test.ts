import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

type NonInfraAppEnvManifest = {
  buildKeys: string[];
};

describe('OCI web packaging and runtime build expectations', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const nextConfigPath = path.join(rootDir, 'next.config.mjs');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const manifestPath = path.join(rootDir, 'config/non-infra-app-env.json');
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8'),
  ) as NonInfraAppEnvManifest;

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

  it('forwards every manifest build key through the repo-local docker:web:* scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const buildxScript = pkg.scripts?.['docker:web:buildx'] ?? '';
    const pushScript = pkg.scripts?.['docker:web:push'] ?? '';

    for (const key of manifest.buildKeys) {
      expect(buildxScript).toContain(`--build-arg ${key}`);
      expect(pushScript).toContain(`--build-arg ${key}`);
    }
  });

  it('accepts every manifest build key at image build time so OCI can replace the Vercel runtime safely', () => {
    const dockerfile = fs.readFileSync(path.join(rootDir, 'Dockerfile.web'), 'utf8');

    for (const key of manifest.buildKeys) {
      expect(dockerfile).toContain(`ARG ${key}`);
      expect(dockerfile).toContain(`ENV ${key}=$${key}`);
    }
  });

  it('fails image builds early when the public Supabase build args are missing or still set to placeholders', () => {
    const dockerfile = fs.readFileSync(path.join(rootDir, 'Dockerfile.web'), 'utf8');

    expect(dockerfile).toContain('NEXT_PUBLIC_SUPABASE_URL build arg is required for Dockerfile.web');
    expect(dockerfile).toContain('placeholder Supabase URL');
    expect(dockerfile).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY build arg is required for Dockerfile.web');
    expect(dockerfile).toContain('placeholder anon key');
  });
});
