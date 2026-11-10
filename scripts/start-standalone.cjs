#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

const child = spawn(process.execPath, [standaloneServerPath], {
  cwd: standaloneDir,
  stdio: 'inherit',
  env: process.env,
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('error', (error) => {
  fail(`Could not start standalone server: ${error.message}`);
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
