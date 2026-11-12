import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Local Development & Isolation Configuration', () => {
  const envExamplePath = path.resolve(__dirname, '../../.env.example');
  const dockerComposePath = path.resolve(__dirname, '../../docker-compose.local.yml');
  const packageJsonPath = path.resolve(__dirname, '../../package.json');

  it('provides an .env.example file with zero production secrets', () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);
    const content = fs.readFileSync(envExamplePath, 'utf-8');

    // Must NOT contain production Supabase project ref
    expect(content).not.toContain('oxfacfdpxbxilucooijy');
    // Must NOT contain production Resend keys or Cloudflare secret keys
    expect(content).not.toContain('re_');
    expect(content).not.toContain('ghp_');
    expect(content).not.toContain('github_pat_');

    // Must contain developer simulation flags
    expect(content).toContain('DEV_FALLBACK_SIMULATION=true');
    expect(content).toContain('NEXT_PUBLIC_STREAM_URL=http://localhost:8000/stream.mp3');
    expect(content).toContain('NEXT_PUBLIC_R2_PUBLIC_URL=http://localhost:9000/promptfm-audio');
    expect(content).toContain('NEXT_PUBLIC_SUPABASE_URL=http://localhost:54322');
  });

  it('documents localhost services as optional examples rather than required shell exports', () => {
    const content = fs.readFileSync(envExamplePath, 'utf-8');

    expect(content).toContain('If Docker is not running');
    expect(content).toContain('player falls back to the hosted stream automatically');
    expect(content).toContain('local startup wrappers ignore');
  });

  it('provides a docker-compose.local.yml file defining icecast, liquidsoap, postgres and minio', () => {
    expect(fs.existsSync(dockerComposePath)).toBe(true);
    const dockerContent = fs.readFileSync(dockerComposePath, 'utf-8');

    expect(dockerContent).toContain('icecast');
    expect(dockerContent).toContain('liquidsoap');
    expect(dockerContent).toContain('postgres');
    expect(dockerContent).toContain('minio');
  });

  it('exposes reproducible local-run scripts for zero-config and full local stack development', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts?.dev).toBe('node scripts/start-standalone.cjs dev');
    expect(pkg.scripts?.['dev:config']).toBe('node scripts/start-standalone.cjs dev --print-config');
    expect(pkg.scripts?.['local:dev']).toBe('npm run local:up && npm run dev');
  });

  it('ensures local database seed creates channels and test tracks', () => {
    const seedPath = path.resolve(__dirname, '../../docker/local-dev/init-db.sql');
    expect(fs.existsSync(seedPath)).toBe(true);
    const seedContent = fs.readFileSync(seedPath, 'utf-8');

    expect(seedContent).toContain('CREATE TABLE IF NOT EXISTS public.tracks');
    expect(seedContent).toContain('CREATE TABLE IF NOT EXISTS public.channels');
    expect(seedContent).toContain('PromptFM Main Stage');
    expect(seedContent).toContain('Neon Alley');
  });
});
