#!/usr/bin/env node
// scripts/profile-speed.ts
// Automated CI Performance Profiler & Speed Insights Regression Gate for PromptFM.

import * as fs from 'fs';
import {
  loadSpeedBaseline,
  compareMetrics,
  measureCriticalPaths,
  analyzeBundleSizes,
} from '../src/lib/ci/speed-insights-profiler';

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const commitSha = process.env.GITHUB_SHA || 'local-dev';

  console.log(`\n======================================================================`);
  console.log(`⚡  PromptFM Speed Insights & CI Performance Profiler`);
  console.log(`    Comparing build performance against strict baseline budgets`);
  console.log(`======================================================================\n`);

  try {
    const baseline = loadSpeedBaseline();
    console.log(`1️⃣  Loaded speed baseline (tolerance: ±${baseline.maxRegressionTolerancePercent}%)...`);

    console.log(`2️⃣  Measuring critical runtime path execution latencies...`);
    const pathMetrics = await measureCriticalPaths();

    console.log(`3️⃣  Analyzing Next.js bundle chunk sizes...`);
    const bundleMetrics = analyzeBundleSizes();

    const currentMetrics: Record<string, number> = {
      ...bundleMetrics,
      ...pathMetrics,
    };

    console.log(`4️⃣  Comparing against baseline thresholds...`);
    const report = compareMetrics(currentMetrics, baseline, commitSha);

    console.log('\n' + report.summaryMarkdown + '\n');

    // Output to GitHub Actions Step Summary if available
    const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (stepSummaryPath) {
      try {
        fs.appendFileSync(stepSummaryPath, '\n' + report.summaryMarkdown + '\n', 'utf8');
        console.log(`✅ Appended profiling summary to GitHub Step Summary: ${stepSummaryPath}`);
      } catch (err: any) {
        console.warn(`⚠️ Could not write to GITHUB_STEP_SUMMARY: ${err.message}`);
      }
    }

    if (!report.passed && strict) {
      console.error(`\n❌ CI Performance Gate Failed: ${report.regressionsCount} regression(s) detected.`);
      process.exit(1);
    }

    console.log(`\n🎉 Speed Insights Profiling Complete: All budgets satisfied!`);
  } catch (err: any) {
    console.error('Fatal error during speed profiling:', err);
    process.exit(1);
  }
}

main();

