import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const startStandalone = require('../../scripts/start-standalone.cjs') as {
  DEFAULT_STREAM_URL: string;
  LOCAL_STREAM_URL: string;
  parseEnvFile: (content: string) => Record<string, string>;
  prepareStartupEnv: (options?: {
    cwd?: string;
    command?: string;
    env?: Partial<NodeJS.ProcessEnv>;
    probePort?: (host: string, port: number, timeoutMs?: number) => Promise<boolean>;
  }) => Promise<{
    env: NodeJS.ProcessEnv;
    loadedFiles: string[];
    localServices: { icecast: boolean; minio: boolean };
    resolved: Record<string, string | undefined>;
  }>;
};

describe('start-standalone local startup env', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses env files and skips redacted values', () => {
    const parsed = startStandalone.parseEnvFile(
      [
        '# comment',
        'DEV_FALLBACK_SIMULATION=true',
        'ADMIN_API_KEY="promptfm-local-dev-key"',
        'SECRET=[SENSITIVE]',
      ].join('\n')
    );

    expect(parsed.DEV_FALLBACK_SIMULATION).toBe('true');
    expect(parsed.ADMIN_API_KEY).toBe('promptfm-local-dev-key');
    expect(parsed.SECRET).toBeUndefined();
  });

  it('loads safe local defaults and prefers localhost stream only when Icecast is reachable', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-start-'));
    fs.writeFileSync(
      path.join(tmpDir, '.env.example'),
      [
        'DEV_FALLBACK_SIMULATION=true',
        'NEXT_PUBLIC_STREAM_URL=http://localhost:8000/stream.mp3',
        'NEXT_PUBLIC_SUPABASE_URL=http://localhost:54322',
        'R2_ACCOUNT_ID=local-minio',
        'R2_ACCESS_KEY_ID=minioadmin',
        'R2_SECRET_ACCESS_KEY=minioadmin',
        'R2_BUCKET_NAME=promptfm-audio',
        'NEXT_PUBLIC_R2_PUBLIC_URL=http://localhost:9000/promptfm-audio',
      ].join('\n')
    );

    const startup = await startStandalone.prepareStartupEnv({
      cwd: tmpDir,
      env: {},
      probePort: vi.fn(async (_host: string, port: number) => port === 8000 || port === 9000),
    });

    expect(startup.loadedFiles).toContain('.env.example');
    expect(startup.localServices).toEqual({ icecast: true, minio: true });
    expect(startup.env.DEV_FALLBACK_SIMULATION).toBe('true');
    expect(startup.env.NEXT_PUBLIC_STREAM_URL).toBe(startStandalone.LOCAL_STREAM_URL);
    expect(startup.env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(startup.env.ADMIN_API_KEY).toBeUndefined();
    expect(startup.env.NEXT_PUBLIC_R2_PUBLIC_URL).toBe('http://localhost:9000/promptfm-audio');
  });

  it('hydrates only the safe zero-config defaults needed for local dev when no env file exists', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-start-'));
    fs.writeFileSync(
      path.join(tmpDir, '.env.example'),
      [
        'DEV_FALLBACK_SIMULATION=true',
        'NEXT_PUBLIC_ADMIN_EMAILS=dev@promptfm.local,admin@promptfm.local',
        'ADMIN_API_KEY=promptfm-local-dev-key',
        'GEMINI_API_KEY=mock-gemini-api-key-local-simulation',
        'TELEGRAM_BOT_TOKEN=0000000000:LOCAL_MOCK_TELEGRAM_TOKEN',
        'X_API_KEY=mock_x_api_key',
      ].join('\n')
    );

    const startup = await startStandalone.prepareStartupEnv({
      cwd: tmpDir,
      command: 'dev',
      env: {
        PORT: '3111',
      },
      probePort: vi.fn(async () => false),
    });

    expect(startup.env.DEV_FALLBACK_SIMULATION).toBe('true');
    expect(startup.env.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3111');
    expect(startup.env.NEXT_PUBLIC_ADMIN_EMAILS).toBe('dev@promptfm.local,admin@promptfm.local');
    expect(startup.env.ADMIN_API_KEY).toBeUndefined();
    expect(startup.env.GEMINI_API_KEY).toBeUndefined();
    expect(startup.env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(startup.env.X_API_KEY).toBeUndefined();
    expect(startup.resolved.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3111');
  });

  it('does not synthesize a localhost site URL for standalone start when NEXT_PUBLIC_SITE_URL is unset', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-start-'));
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'DEV_FALLBACK_SIMULATION=true\n');

    const startup = await startStandalone.prepareStartupEnv({
      cwd: tmpDir,
      command: 'start',
      env: {
        PORT: '3222',
      },
      probePort: vi.fn(async () => false),
    });

    expect(startup.env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
    expect(startup.resolved.NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });

  it('falls back to the hosted stream when localhost stream is only an example and Icecast is down', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-start-'));
    fs.writeFileSync(
      path.join(tmpDir, '.env.example'),
      [
        'DEV_FALLBACK_SIMULATION=true',
        'NEXT_PUBLIC_STREAM_URL=http://localhost:8000/stream.mp3',
      ].join('\n')
    );

    const startup = await startStandalone.prepareStartupEnv({
      cwd: tmpDir,
      env: {},
      probePort: vi.fn(async () => false),
    });

    expect(startup.localServices).toEqual({ icecast: false, minio: false });
    expect(startup.env.NEXT_PUBLIC_STREAM_URL).toBe(startStandalone.DEFAULT_STREAM_URL);
    expect(startup.env.ADMIN_API_KEY).toBeUndefined();
  });

  it('preserves an explicit non-local stream URL from user env', async () => {
    const startup = await startStandalone.prepareStartupEnv({
      cwd: process.cwd(),
      env: {
        NEXT_PUBLIC_STREAM_URL: 'https://cdn.example.com/live.mp3',
      },
      probePort: vi.fn(async () => false),
    });

    expect(startup.env.NEXT_PUBLIC_STREAM_URL).toBe('https://cdn.example.com/live.mp3');
  });
});
