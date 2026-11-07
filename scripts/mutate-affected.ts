#!/usr/bin/env node
import { spawnSync } from 'child_process';
import {
  detectChangedFiles,
  filterMutatableFiles,
  shouldRunMutationTesting,
  buildStrykerArgs,
} from '../src/lib/testing/affected';

function parseCliArgs(): { baseRef: string; incremental: boolean; force: boolean } {
  const args = process.argv.slice(2);
  let baseRef = process.env.BASE_REF || 'origin/main';
  let incremental = true;
  let force = false;

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
    }
  }

  return { baseRef, incremental, force };
}

function main(): void {
  const { baseRef, incremental, force } = parseCliArgs();

  console.log(`[Stryker:Targeted] Comparing changed files against base ref: ${baseRef}`);

  const changedFiles = detectChangedFiles({ baseRef });
  console.log(`[Stryker:Targeted] Total files changed: ${changedFiles.length}`);

  const mutatableFiles = filterMutatableFiles(changedFiles);

  if (!shouldRunMutationTesting(mutatableFiles) && !force) {
    console.log('[Stryker:Targeted] No core domain files modified in this change set.');
    console.log('[Stryker:Targeted] Skipping Stryker mutation run (0 mutants to evaluate).');
    process.exit(0);
  }

  console.log(`[Stryker:Targeted] Found ${mutatableFiles.length} target domain file(s) to mutate:`);
  mutatableFiles.forEach((f) => console.log(`  - ${f}`));

  const strykerArgs = buildStrykerArgs(mutatableFiles, { incremental });
  console.log(`[Stryker:Targeted] Executing: npx stryker ${strykerArgs.join(' ')}\n`);

  const result = spawnSync('npx', ['stryker', ...strykerArgs], {
    stdio: 'inherit',
    env: process.env,
  });

  process.exit(result.status ?? 0);
}

main();
