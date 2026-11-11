#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const manifestPath = path.join(__dirname, '..', 'config', 'non-infra-app-env.json');

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function parseEnvFile(content) {
  const entries = {};
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!value || value === '[SENSITIVE]' || value.startsWith('[SENSITIVE')) continue;
    entries[key] = value;
  }
  return entries;
}

function parseJsonObject(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readPulledEnv(rootDir) {
  const filePath = path.join(rootDir, '.env.production.local');
  if (!fs.existsSync(filePath)) return {};
  return parseEnvFile(fs.readFileSync(filePath, 'utf8'));
}

function getBundleSecretName(manifest = readManifest()) {
  return manifest.gcpBundleSecretName || '';
}

function getDirectGcpSecretName(key, manifest = readManifest()) {
  const trimmedKey = String(key || '').trim();
  if (!trimmedKey || !manifest.directGcpSecretNames || typeof manifest.directGcpSecretNames !== 'object') {
    return '';
  }
  return manifest.directGcpSecretNames[trimmedKey] || '';
}

function printBundleSecretName() {
  process.stdout.write(`${getBundleSecretName()}\n`);
}

function printDirectGcpSecretName(key) {
  process.stdout.write(`${getDirectGcpSecretName(key)}\n`);
}

function resolveOciWebEnv(options = {}) {
  const manifest = readManifest();
  const cwd = options.cwd || process.cwd();
  const env = options.env || process.env;
  const pulledEnv = readPulledEnv(cwd);
  const gcpBundle = parseJsonObject(env.GCP_BUNDLED_APP_ENV_JSON || '');

  const merged = { ...gcpBundle, ...pulledEnv };
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && value !== '') {
      merged[key] = value;
    }
  }

  for (const [key, value] of Object.entries(manifest.staticRuntimeEnv)) {
    merged[key] = value;
  }

  const missing = [];
  for (const key of manifest.requiredRuntimeKeys) {
    const value = merged[key];
    if (!value || String(value).startsWith('[SENSITIVE') || String(value).startsWith('placeholder')) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`OCI web deploy requires ${missing.join(', ')}.`);
  }

  const runtimeEnv = {};
  for (const key of manifest.runtimeKeys) {
    const value = merged[key];
    if (typeof value === 'string' && value !== '' && !value.startsWith('[SENSITIVE')) {
      runtimeEnv[key] = value;
    }
  }
  for (const [key, value] of Object.entries(manifest.staticRuntimeEnv)) {
    runtimeEnv[key] = value;
  }

  const buildEnv = {};
  for (const key of manifest.buildKeys) {
    const value = merged[key];
    if (typeof value === 'string' && value !== '' && !value.startsWith('[SENSITIVE')) {
      buildEnv[key] = value;
    }
  }

  return {
    runtimeEnv,
    buildEnv,
    requiredRuntimeKeys: manifest.requiredRuntimeKeys,
    gcpBundleSecretName: manifest.gcpBundleSecretName,
  };
}

function main() {
  const [mode, modeArg] = process.argv.slice(2);
  if (mode === '--print-bundle-secret-name') {
    printBundleSecretName();
    return;
  }
  if (mode === '--print-direct-gcp-secret-name') {
    printDirectGcpSecretName(modeArg);
    return;
  }

  try {
    process.stdout.write(`${JSON.stringify(resolveOciWebEnv())}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  readManifest,
  parseEnvFile,
  parseJsonObject,
  readPulledEnv,
  getBundleSecretName,
  getDirectGcpSecretName,
  resolveOciWebEnv,
  printBundleSecretName,
  printDirectGcpSecretName,
  main,
};

if (require.main === module) {
  main();
}
