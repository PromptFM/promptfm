#!/usr/bin/env node
// scripts/lint-sql.ts
// PostgreSQL / Supabase Schema Linter CLI for local development and CI checks.

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { lintSQLFiles } from '../src/lib/sql/sql-linter';

function findSQLFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findSQLFiles(fullPath));
    } else if (file.endsWith('.sql')) {
      results.push(fullPath);
    }
  }
  return results;
}

function getChangedSQLFiles(): string[] {
  try {
    const baseRef = process.env.GITHUB_BASE_REF || 'origin/main';
    const output = execSync(`git diff --name-only ${baseRef} HEAD`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output
      .trim()
      .split('\n')
      .filter((f) => f.endsWith('.sql') && fs.existsSync(f));
  } catch {
    return [];
  }
}

export function runSQLLinter(args: string[] = process.argv.slice(2)): number {
  console.log(`\n======================================================`);
  console.log(`🔍 PromptFM PostgreSQL / Supabase Schema Linter`);
  console.log(`======================================================\n`);

  let targetFiles: string[] = [];

  if (args.includes('--changed')) {
    targetFiles = getChangedSQLFiles();
    console.log(`Checking changed SQL files (${targetFiles.length} files detected)...`);
  } else if (args.length > 0 && args[0] && !args[0].startsWith('-')) {
    targetFiles = args.filter((a) => a.endsWith('.sql'));
  } else {
    // Default: scan supabase and docker directories
    const supabaseFiles = findSQLFiles(path.resolve(process.cwd(), 'supabase'));
    const dockerFiles = findSQLFiles(path.resolve(process.cwd(), 'docker'));
    targetFiles = [...supabaseFiles, ...dockerFiles];
  }

  if (targetFiles.length === 0) {
    console.log(`✓ No SQL files to lint.\n`);
    return 0;
  }

  console.log(`Linting ${targetFiles.length} SQL file(s)...\n`);

  const report = lintSQLFiles(targetFiles);

  for (const fileResult of report.results) {
    const relativePath = path.relative(process.cwd(), fileResult.file);
    if (fileResult.issues.length === 0) {
      console.log(`  ✓ ${relativePath}`);
      continue;
    }

    const hasErrors = fileResult.issues.some((i) => i.severity === 'error');
    const symbol = hasErrors ? '❌' : '⚠️ ';
    console.log(`  ${symbol} ${relativePath}:`);

    for (const issue of fileResult.issues) {
      const tag = issue.severity === 'error' ? '[ERROR]' : '[WARN]';
      console.log(`     Line ${issue.line}: ${tag} (${issue.rule}) ${issue.message}`);
    }
    console.log('');
  }

  console.log(`------------------------------------------------------`);
  console.log(
    `Summary: ${report.totalFiles} files scanned, ${report.errorCount} error(s), ${report.warningCount} warning(s)`
  );
  console.log(`------------------------------------------------------\n`);

  if (report.hasErrors) {
    console.error(`❌ SQL linting failed with ${report.errorCount} error(s).\n`);
    return 1;
  }

  console.log(`✅ All SQL files passed syntax & safety verification!\n`);
  return 0;
}

// Always execute when run as script
if (!process.env.VITEST) {
  const exitCode = runSQLLinter();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
