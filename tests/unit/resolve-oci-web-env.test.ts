import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

type ResolveOciWebEnvHelper = {
  readManifest: () => {
    gcpBundleSecretName: string;
    buildKeys: string[];
    runtimeKeys: string[];
    requiredRuntimeKeys: string[];
    staticRuntimeEnv: Record<string, string>;
    directGcpSecretNames: Record<string, string>;
  };
  parseEnvFile: (content: string) => Record<string, string>;
  parseJsonObject: (raw: string) => Record<string, unknown>;
  readPulledEnv: (rootDir: string) => Record<string, string>;
  getBundleSecretName: (manifest?: { gcpBundleSecretName?: string }) => string;
  getDirectGcpSecretName: (
    key?: string,
    manifest?: { directGcpSecretNames?: Record<string, string> }
  ) => string;
  printBundleSecretName: () => void;
  printDirectGcpSecretName: (key?: string) => void;
  resolveOciWebEnv: (options?: {
    cwd?: string;
    env?: Record<string, string | undefined>;
  }) => {
    runtimeEnv: Record<string, string>;
    buildEnv: Record<string, string>;
    requiredRuntimeKeys: string[];
    gcpBundleSecretName: string;
  };
  main: () => void;
};

const helper = require('../../scripts/resolve-oci-web-env.cjs') as ResolveOciWebEnvHelper;

describe('resolve-oci-web-env script contract', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const scriptPath = path.join(rootDir, 'scripts/resolve-oci-web-env.cjs');
  const originalArgv = [...process.argv];
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.restoreAllMocks();
    process.argv = [...originalArgv];
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('reads the shared manifest and exposes bundle/direct secret lookup helpers', () => {
    const manifest = helper.readManifest();

    expect(helper.getBundleSecretName(manifest)).toBe(manifest.gcpBundleSecretName);
    expect(helper.getBundleSecretName({})).toBe('');
    expect(helper.getDirectGcpSecretName(' ADMIN_API_KEY ', manifest)).toBe(
      manifest.directGcpSecretNames.ADMIN_API_KEY
    );
    expect(helper.getDirectGcpSecretName('UNKNOWN_KEY', manifest)).toBe('');
    expect(helper.getDirectGcpSecretName('', manifest)).toBe('');
    expect(helper.getDirectGcpSecretName('ADMIN_API_KEY', {})).toBe('');
    expect(
      helper.getDirectGcpSecretName(undefined, {
        directGcpSecretNames: { 'Stryker was here!': 'unexpected-secret-name' },
      })
    ).toBe('');
  });

  it('parses env files with trimming, quote unwrapping, and redaction rules', () => {
    const parsedEnv = helper.parseEnvFile(
      [
        '   # comment',
        ' NEXT_PUBLIC_SITE_URL = "https://promptfm.live" ',
        'ADMIN_API_KEY=secret-admin-key',
        "SINGLE_QUOTED='single-quoted-value'",
        'UNTERMINATED_QUOTE="unterminated',
        '=MISSING_KEY_NAME',
        'EMPTY=',
        'REDACTED=[SENSITIVE]',
        'REDACTED_PREFIX=[SENSITIVE value omitted]',
        "HASH_VALUE='#not-a-comment'",
        'NO_EQUALS_SIGN',
      ].join('\n')
    );

    expect(parsedEnv).toEqual({
      NEXT_PUBLIC_SITE_URL: 'https://promptfm.live',
      ADMIN_API_KEY: 'secret-admin-key',
      SINGLE_QUOTED: 'single-quoted-value',
      UNTERMINATED_QUOTE: '"unterminated',
      HASH_VALUE: '#not-a-comment',
    });

    expect(helper.parseJsonObject('')).toEqual({});
    expect(helper.parseJsonObject('   ')).toEqual({});
    expect(helper.parseJsonObject('{"key":"value"}')).toEqual({ key: 'value' });
    expect(helper.parseJsonObject('["not","an","object"]')).toEqual({});
    expect(helper.parseJsonObject('null')).toEqual({});
    expect(helper.parseJsonObject('0')).toEqual({});
    expect(helper.parseJsonObject('"string"')).toEqual({});
    expect(helper.parseJsonObject('not json')).toEqual({});
  });

  it('reads pulled Vercel env from the working directory when present', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-oci-env-'));
    fs.writeFileSync(
      path.join(tmpDir, '.env.production.local'),
      ['NEXT_PUBLIC_STREAM_URL=https://stream.promptfm.live/stream.mp3', 'RESEND_API_KEY=re_123'].join('\n')
    );

    expect(helper.readPulledEnv(tmpDir)).toEqual({
      NEXT_PUBLIC_STREAM_URL: 'https://stream.promptfm.live/stream.mp3',
      RESEND_API_KEY: 're_123',
    });
  });

  it('returns an empty object when no pulled Vercel env file exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-oci-env-'));
    expect(helper.readPulledEnv(tmpDir)).toEqual({});
  });

  it('resolves OCI runtime/build env with the intended precedence and static defaults', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-oci-env-'));
    fs.writeFileSync(
      path.join(tmpDir, '.env.production.local'),
      [
        'NEXT_PUBLIC_SUPABASE_URL=https://pulled.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=pulled-anon-key',
        'SUPABASE_SERVICE_ROLE_KEY=pulled-service-role-key',
        'ADMIN_API_KEY=pulled-admin-key',
        'NEXT_PUBLIC_SITE_URL=https://pulled.promptfm.live',
        'NEXT_PUBLIC_STREAM_URL=https://pulled-stream.promptfm.live/stream.mp3',
        'NEXT_PUBLIC_APP_VERSION=1.2.3-pulled',
      ].join('\n')
    );

    const resolved = helper.resolveOciWebEnv({
      cwd: tmpDir,
      env: {
        GCP_BUNDLED_APP_ENV_JSON: JSON.stringify({
          NEXT_PUBLIC_SITE_URL: 'https://bundle.promptfm.live',
          NEXT_PUBLIC_APP_VERSION: '1.2.3-bundle',
          RESEND_API_KEY: 'bundle-resend-key',
        }),
        NEXT_PUBLIC_SITE_URL: 'https://env.promptfm.live',
        NEXT_PUBLIC_APP_VERSION: '',
        RESEND_API_KEY: 'env-resend-key',
        VERCEL_ENV: 'preview',
      },
    });

    expect(resolved.gcpBundleSecretName).toBe(helper.readManifest().gcpBundleSecretName);
    expect(resolved.requiredRuntimeKeys).toEqual(helper.readManifest().requiredRuntimeKeys);
    expect(resolved.runtimeEnv.NEXT_PUBLIC_SITE_URL).toBe('https://env.promptfm.live');
    expect(resolved.runtimeEnv.NEXT_PUBLIC_STREAM_URL).toBe('https://pulled-stream.promptfm.live/stream.mp3');
    expect(resolved.runtimeEnv.RESEND_API_KEY).toBe('env-resend-key');
    expect(resolved.runtimeEnv.VERCEL_ENV).toBe('production');
    expect(resolved.buildEnv.NEXT_PUBLIC_SITE_URL).toBe('https://env.promptfm.live');
    expect(resolved.buildEnv.NEXT_PUBLIC_APP_VERSION).toBe('1.2.3-pulled');
    expect(resolved.buildEnv.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  it('ignores invalid bundle JSON and filters sensitive env values out of runtime and build output', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-oci-env-'));
    fs.writeFileSync(
      path.join(tmpDir, '.env.production.local'),
      [
        'NEXT_PUBLIC_SUPABASE_URL=https://pulled.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=pulled-anon-key',
        'SUPABASE_SERVICE_ROLE_KEY=pulled-service-role-key',
        'ADMIN_API_KEY=pulled-admin-key',
        'NEXT_PUBLIC_APP_VERSION=1.2.3-pulled',
      ].join('\n')
    );

    const resolved = helper.resolveOciWebEnv({
      cwd: tmpDir,
      env: {
        GCP_BUNDLED_APP_ENV_JSON: 'not-json',
        NEXT_PUBLIC_APP_VERSION: '[SENSITIVE redacted]',
        RESEND_API_KEY: '[SENSITIVE redacted]',
      },
    });

    expect(resolved.runtimeEnv.RESEND_API_KEY).toBeUndefined();
    expect(resolved.buildEnv.NEXT_PUBLIC_APP_VERSION).toBeUndefined();
    expect(resolved.runtimeEnv.NEXT_PUBLIC_SUPABASE_URL).toBe('https://pulled.supabase.co');
  });

  it('rejects missing, placeholder, and redacted required runtime keys with a stable message', () => {
    expect(() =>
      helper.resolveOciWebEnv({
        cwd: rootDir,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://promptfm.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: '[SENSITIVE redacted]',
        },
      })
    ).toThrow('OCI web deploy requires NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_KEY.');
  });

  it('prints helper output directly with trailing newlines', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as never);
    const manifest = helper.readManifest();

    helper.printBundleSecretName();
    helper.printDirectGcpSecretName('ADMIN_API_KEY');

    expect(writeSpy).toHaveBeenNthCalledWith(1, `${manifest.gcpBundleSecretName}\n`);
    expect(writeSpy).toHaveBeenNthCalledWith(2, `${manifest.directGcpSecretNames.ADMIN_API_KEY}\n`);
  });

  it('prints bundle and direct secret names through the CLI modes the workflows call', () => {
    const manifest = helper.readManifest();

    const bundleName = execFileSync('node', [scriptPath, '--print-bundle-secret-name'], {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();

    const directName = execFileSync('node', [scriptPath, '--print-direct-gcp-secret-name', 'ADMIN_API_KEY'], {
      cwd: rootDir,
      encoding: 'utf8',
    }).trim();

    expect(bundleName).toBe(manifest.gcpBundleSecretName);
    expect(directName).toBe(manifest.directGcpSecretNames.ADMIN_API_KEY);
  });

  it('dispatches main() bundle and direct-secret modes without falling through', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as never);
    const manifest = helper.readManifest();

    process.argv = ['node', scriptPath, '--print-bundle-secret-name'];
    helper.main();

    process.argv = ['node', scriptPath, '--print-direct-gcp-secret-name', 'ADMIN_API_KEY'];
    helper.main();

    expect(writeSpy).toHaveBeenNthCalledWith(1, `${manifest.gcpBundleSecretName}\n`);
    expect(writeSpy).toHaveBeenNthCalledWith(2, `${manifest.directGcpSecretNames.ADMIN_API_KEY}\n`);
  });

  it('dispatches main() default mode to resolved JSON', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-oci-env-'));
    fs.writeFileSync(
      path.join(tmpDir, '.env.production.local'),
      [
        'NEXT_PUBLIC_SUPABASE_URL=https://main.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=main-anon-key',
        'SUPABASE_SERVICE_ROLE_KEY=main-service-role-key',
        'ADMIN_API_KEY=main-admin-key',
      ].join('\n')
    );

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as never);
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    process.argv = ['node', scriptPath];
    process.env.GCP_BUNDLED_APP_ENV_JSON = JSON.stringify({ NEXT_PUBLIC_SITE_URL: 'https://main.promptfm.live' });
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    process.env.ADMIN_API_KEY = '';
    process.env.VERCEL_ENV = '';

    helper.main();

    const output = String(writeSpy.mock.calls.at(-1)?.[0] ?? '').trim();
    const resolved = JSON.parse(output) as {
      runtimeEnv: Record<string, string>;
      buildEnv: Record<string, string>;
    };

    expect(resolved.runtimeEnv.NEXT_PUBLIC_SUPABASE_URL).toBe('https://main.supabase.co');
    expect(resolved.runtimeEnv.VERCEL_ENV).toBe('production');
    expect(resolved.buildEnv.NEXT_PUBLIC_SITE_URL).toBe('https://main.promptfm.live');
  });

  it('reports helper errors through main() and exits non-zero', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-oci-env-'));

    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    process.argv = ['node', scriptPath];
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    process.env.ADMIN_API_KEY = '';
    process.env.GCP_BUNDLED_APP_ENV_JSON = '';

    expect(() => helper.main()).toThrow('process.exit:1');
    expect(errorSpy).toHaveBeenCalledWith(
      'OCI web deploy requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_KEY.'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints resolved JSON from the CLI default mode', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-oci-env-'));
    fs.writeFileSync(
      path.join(tmpDir, '.env.production.local'),
      [
        'NEXT_PUBLIC_SUPABASE_URL=https://cli.supabase.co',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=cli-anon-key',
        'SUPABASE_SERVICE_ROLE_KEY=cli-service-role-key',
        'ADMIN_API_KEY=cli-admin-key',
      ].join('\n')
    );

    const raw = execFileSync('node', [scriptPath], {
      cwd: tmpDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        GCP_BUNDLED_APP_ENV_JSON: JSON.stringify({ NEXT_PUBLIC_SITE_URL: 'https://bundle.promptfm.live' }),
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        ADMIN_API_KEY: '',
        VERCEL_ENV: '',
      },
    }).trim();

    const resolved = JSON.parse(raw) as {
      runtimeEnv: Record<string, string>;
      buildEnv: Record<string, string>;
      gcpBundleSecretName: string;
    };

    expect(resolved.runtimeEnv.NEXT_PUBLIC_SUPABASE_URL).toBe('https://cli.supabase.co');
    expect(resolved.runtimeEnv.VERCEL_ENV).toBe('production');
    expect(resolved.buildEnv.NEXT_PUBLIC_SITE_URL).toBe('https://bundle.promptfm.live');
    expect(resolved.gcpBundleSecretName).toBe(helper.readManifest().gcpBundleSecretName);
  });
});
