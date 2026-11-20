#!/usr/bin/env node
import { spawnSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectChangedFiles,
  filterMutatableFiles,
  filterFunctionalMutatableChanges,
  extractHunkLineRanges,
  findRelatedTestFiles,
  shouldRunMutationTesting,
  buildStrykerArgs,
} from '../src/lib/testing/affected';

function parseCliArgs(): {
  baseRef: string;
  incremental: boolean;
  force: boolean;
  wholeFiles: boolean;
  allTests: boolean;
  breakScore: number;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  let baseRef = process.env.BASE_REF || 'origin/main';
  let incremental = true;
  let force = false;
  let wholeFiles = false;
  let allTests = false;
  let breakScore = 80;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) {
      baseRef = args[i + 1];
      i++;
    } else if (args[i].startsWith('--base=')) {
      baseRef = args[i].split('=')[1];
    } else if (args[i] === '--no-incremental') {
      incremental = false;
    } else if (args[i] === '--force') {
      force = true;
    } else if (args[i] === '--whole-files') {
      wholeFiles = true;
    } else if (args[i] === '--all-tests') {
      allTests = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--break' && args[i + 1]) {
      breakScore = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { baseRef, incremental, force, wholeFiles, allTests, breakScore, dryRun };
}

function main(): void {
  const { baseRef, incremental, force, wholeFiles, allTests, breakScore, dryRun } = parseCliArgs();

  console.log(`[Stryker:Targeted] Comparing changed files against base ref: ${baseRef}`);

  const changedFiles = detectChangedFiles({ baseRef });
  console.log(`[Stryker:Targeted] Total files changed in git diff: ${changedFiles.length}`);

  const candidateMutatables = filterMutatableFiles(changedFiles);

  if (!shouldRunMutationTesting(candidateMutatables) && !force) {
    console.log('[Stryker:Targeted] No core domain files modified in this change set.');
    console.log('[Stryker:Targeted] Skipping Stryker mutation run (0 mutants to evaluate).');
    process.exit(0);
  }

  const functionalMutatables = filterFunctionalMutatableChanges(candidateMutatables, { baseRef });
  if (functionalMutatables.length === 0 && !force) {
    console.log('[Stryker:Targeted] All domain changes are comment-, markdown-, or whitespace-only.');
    console.log('[Stryker:Targeted] Skipping Stryker mutation run (no functional code changes).');
    process.exit(0);
  }

  let targets: string[] = [];
  if (!wholeFiles) {
    let diffOutput = '';
    try {
      diffOutput = execSync(`git diff -U0 ${baseRef}...HEAD`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch {
      try {
        diffOutput = execSync(`git diff -U0 ${baseRef} HEAD`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      } catch {
        try {
          diffOutput = execSync('git diff -U0 HEAD~1...HEAD', {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        } catch {
          diffOutput = '';
        }
      }
    }

    try {
      const uncommittedDiff = execSync('git diff -U0 HEAD', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      diffOutput = `${diffOutput}\n${uncommittedDiff}`;
    } catch {
      // ignore
    }

    const hunkTargets = extractHunkLineRanges(diffOutput, { filterMutatable: true });
    targets = hunkTargets.filter((t) => {
      const filePath = t.split(':')[0];
      return functionalMutatables.includes(filePath);
    });

    // If a functional mutatable file has no diff hunks (e.g. newly created file), include the file
    for (const file of functionalMutatables) {
      if (!targets.some((t) => t.startsWith(`${file}:`))) {
        targets.push(file);
      }
    }
  } else {
    targets = functionalMutatables;
  }

  if (targets.length === 0 && !force) {
    console.log('[Stryker:Targeted] No affected line ranges found to mutate.');
    console.log('[Stryker:Targeted] Skipping Stryker mutation run.');
    process.exit(0);
  }

  let relatedTests: string[] = [];
  if (!allTests) {
    relatedTests = findRelatedTestFiles(changedFiles);
    if (relatedTests.length > 0) {
      console.log(`[Stryker:Targeted] Found ${relatedTests.length} related test file(s) for changed code:`);
      relatedTests.forEach((t) => console.log(`  - ${t}`));
    } else {
      console.log('[Stryker:Targeted] No specific related test files detected; running all test suites.');
    }
  } else {
    console.log('[Stryker:Targeted] --all-tests flag active; running full test suite across targeted mutants.');
  }

  console.log(`[Stryker:Targeted] Found ${targets.length} target mutation range(s) across ${functionalMutatables.length} file(s):`);
  targets.forEach((t) => console.log(`  - ${t}`));

  if (incremental) {
    const incrementalPath = path.resolve(process.cwd(), 'reports/stryker-incremental.json');
    if (fs.existsSync(incrementalPath)) {
      try {
        const raw = fs.readFileSync(incrementalPath, 'utf-8');
        const data = JSON.parse(raw);
        if (data && typeof data === 'object' && data.files) {
          const filteredFiles: Record<string, unknown> = {};
          for (const file of functionalMutatables) {
            if (data.files[file]) {
              filteredFiles[file] = data.files[file];
            }
          }
          data.files = filteredFiles;
          fs.writeFileSync(incrementalPath, JSON.stringify(data), 'utf-8');
          console.log(`[Stryker:Targeted] Scoped incremental cache to ${Object.keys(filteredFiles).length} affected file(s).`);
        }
      } catch {
        // ignore cache filtering failures
      }
    }
  }

  const strykerArgs = buildStrykerArgs(targets, {
    incremental,
    testFiles: relatedTests,
  });

  console.log(`[Stryker:Targeted] Executing: ./node_modules/.bin/stryker ${strykerArgs.join(' ')}\n`);

  if (dryRun) {
    console.log('[Stryker:Targeted] Dry run active; skipping Stryker execution.');
    process.exit(0);
  }

  const result = spawnSync('./node_modules/.bin/stryker', strykerArgs, {
    stdio: 'inherit',
    env: process.env,
  });

  process.exit(result.status ?? 0);
}

main();
