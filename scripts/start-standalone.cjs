#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const DEFAULT_STREAM_URL = 'https://stream.promptfm.live/stream.mp3';
const LOCAL_STREAM_URL = 'http://localhost:8000/stream.mp3';
const SAFE_DEFAULT_KEYS = new Set(['DEV_FALLBACK_SIMULATION']);
const SAFE_ZERO_CONFIG_KEYS = new Set([
  'DEV_FALLBACK_SIMULATION',
  'NEXT_PUBLIC_ADMIN_EMAILS',
]);
const LOCAL_R2_KEYS = new Set([
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'NEXT_PUBLIC_R2_PUBLIC_URL',
]);
const INVALID_LOCAL_SUPABASE_URLS = new Set([
  'http://localhost:54322',
  'http://127.0.0.1:54322',
]);

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');
const standaloneServerPath = path.join(standaloneDir, 'server.js');
const rootStaticDir = path.join(rootDir, '.next', 'static');
const standaloneStaticDir = path.join(standaloneDir, '.next', 'static');
const rootPublicDir = path.join(rootDir, 'public');
const standalonePublicDir = path.join(standaloneDir, 'public');

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function ensureLinkedDirectory(sourceDir, targetDir) {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  try {
    const existing = fs.lstatSync(targetDir);

    if (existing.isSymbolicLink()) {
      const linkedTarget = path.resolve(path.dirname(targetDir), fs.readlinkSync(targetDir));
      if (linkedTarget === sourceDir) {
        return;
      }
    } else if (existing.isDirectory()) {
      const realTarget = fs.realpathSync(targetDir);
      const realSource = fs.realpathSync(sourceDir);
      if (realTarget === realSource) {
        return;
      }
    }

    removePath(targetDir);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  try {
    fs.symlinkSync(sourceDir, targetDir, 'dir');
  } catch (error) {
    if (!['EPERM', 'EINVAL', 'UNKNOWN'].includes(error.code)) {
      throw error;
    }

    fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
  }
}

function parseEnvFile(content) {
  const entries = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (value === '[SENSITIVE]' || value.startsWith('[SENSITIVE')) continue;
    entries[key] = value;
  }

  return entries;
}

function readEnvFile(cwd, filename) {
  const fullPath = path.join(cwd, filename);
  if (!fs.existsSync(fullPath)) {
    return { exists: false, entries: {} };
  }

  return {
    exists: true,
    entries: parseEnvFile(fs.readFileSync(fullPath, 'utf8')),
  };
}

function applyMissingEnv(targetEnv, sourceEntries, allowedKeys) {
  for (const [key, value] of Object.entries(sourceEntries)) {
    if (allowedKeys && !allowedKeys.has(key)) continue;
    if (!targetEnv[key]) {
      targetEnv[key] = value;
    }
  }
}

function resolveLocalSiteUrl(env) {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return configured;
  }

  const port = String(env.PORT || env.port || '3000').trim() || '3000';
  return `http://localhost:${port}`;
}

function isLocalDevStreamUrl(value) {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//iu.test(value);
  }
}

function isExampleLocalSupabaseUrl(value) {
  return INVALID_LOCAL_SUPABASE_URLS.has((value || '').trim().toLowerCase());
}

function probePort(host, port, timeoutMs = 250) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
    socket.connect(port, host);
  });
}

function resolveStreamUrl(env, exampleEntries, localServices) {
  const configured = env.NEXT_PUBLIC_STREAM_URL?.trim();
  const exampleDefault = exampleEntries.NEXT_PUBLIC_STREAM_URL?.trim() || LOCAL_STREAM_URL;

  if (configured && !isLocalDevStreamUrl(configured)) {
    return configured;
  }

  if (localServices.icecast) {
    return configured || exampleDefault;
  }

  return DEFAULT_STREAM_URL;
}

async function prepareStartupEnv(options = {}) {
  const cwd = options.cwd || process.cwd();
  const command = options.command || 'start';
  const env = { ...(options.env || process.env) };
  const loadedFiles = [];
  const probe = options.probePort || probePort;

  for (const filename of ['.env.local', '.env']) {
    const result = readEnvFile(cwd, filename);
    if (!result.exists) continue;
    applyMissingEnv(env, result.entries);
    loadedFiles.push(filename);
  }

  const envExample = readEnvFile(cwd, '.env.example');
  if (envExample.exists) {
    applyMissingEnv(env, envExample.entries, SAFE_DEFAULT_KEYS);
    loadedFiles.push('.env.example');
  }

  applyMissingEnv(env, envExample.entries, SAFE_ZERO_CONFIG_KEYS);

  if (isExampleLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
    delete env.NEXT_PUBLIC_SUPABASE_URL;
  }

  const localServices = {
    icecast: await probe('127.0.0.1', 8000),
    minio: await probe('127.0.0.1', 9000),
  };

  env.NEXT_PUBLIC_STREAM_URL = resolveStreamUrl(env, envExample.entries, localServices);
  if (command !== 'start') {
    env.NEXT_PUBLIC_SITE_URL = resolveLocalSiteUrl(env);
  }

  if (localServices.minio) {
    applyMissingEnv(env, envExample.entries, LOCAL_R2_KEYS);
  }

  if (!env.DEV_FALLBACK_SIMULATION) {
    env.DEV_FALLBACK_SIMULATION = 'true';
  }

  return {
    env,
    loadedFiles,
    localServices,
    resolved: {
      DEV_FALLBACK_SIMULATION: env.DEV_FALLBACK_SIMULATION,
      NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_STREAM_URL: env.NEXT_PUBLIC_STREAM_URL,
      NEXT_PUBLIC_R2_PUBLIC_URL: env.NEXT_PUBLIC_R2_PUBLIC_URL,
    },
  };
}

function stageStandaloneRuntime() {
  if (!fs.existsSync(standaloneServerPath)) {
    fail(`Standalone server not found at ${standaloneServerPath}. Run \"npm run build\" first.`);
  }

  if (!fs.existsSync(rootStaticDir)) {
    fail(`Next static assets not found at ${rootStaticDir}. Run \"npm run build\" first.`);
  }

  if (fs.existsSync(rootPublicDir)) {
    ensureLinkedDirectory(rootPublicDir, standalonePublicDir);
  }

  ensureLinkedDirectory(rootStaticDir, standaloneStaticDir);
}

function getNextBin() {
  return require.resolve('next/dist/bin/next');
}

function runChild(child, errorMessage) {
  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('error', (error) => {
    fail(`${errorMessage}: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    if (signal === 'SIGINT') {
      process.exit(130);
    }

    if (signal === 'SIGTERM') {
      process.exit(143);
    }

    process.exit(code ?? 0);
  });
}

function startStandaloneServer(env) {
  stageStandaloneRuntime();

  const child = spawn(process.execPath, [standaloneServerPath], {
    cwd: standaloneDir,
    stdio: 'inherit',
    env,
  });

  runChild(child, 'Could not start standalone server');
}

function runNextCommand(command, args, env) {
  const child = spawn(process.execPath, [getNextBin(), command, ...args], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  runChild(child, `Could not start next ${command}`);
}

async function runCli() {
  const rawArgs = process.argv.slice(2);
  const printConfig = rawArgs.includes('--print-config');
  const args = rawArgs.filter((arg) => arg !== '--print-config');
  const command = args.shift() || 'start';
  const startup = await prepareStartupEnv({ command });

  if (printConfig) {
    process.stdout.write(
      `${JSON.stringify(
        {
          command,
          loadedFiles: startup.loadedFiles,
          localServices: startup.localServices,
          resolved: startup.resolved,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (command === 'start') {
    startStandaloneServer(startup.env);
    return;
  }

  runNextCommand(command, args, startup.env);
}

module.exports = {
  DEFAULT_STREAM_URL,
  LOCAL_STREAM_URL,
  parseEnvFile,
  probePort,
  prepareStartupEnv,
  resolveStreamUrl,
  resolveLocalSiteUrl,
  isLocalDevStreamUrl,
  stageStandaloneRuntime,
};

if (require.main === module) {
  runCli().catch((error) => {
    console.error('[start-standalone] Failed to prepare startup env:', error);
    process.exit(1);
  });
}
