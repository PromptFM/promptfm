import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadSpeedBaseline,
  compareMetrics,
  generateStepSummaryMarkdown,
  measureExecutionLatency,
  analyzeBundleSizes,
  measureCriticalPaths,
  type SpeedBaselineConfig,
  type ProfilingReport,
} from '../../src/lib/ci/speed-insights-profiler';

describe('Speed Insights & Performance Profiler Suite', () => {
  const mockBaseline: SpeedBaselineConfig = {
    version: 1,
    maxRegressionTolerancePercent: 15,
    metrics: {
      first_load_js_kb: {
        baseline: 120,
        budget: 150,
        unit: 'kB',
      },
      station_rotation_ms: {
        baseline: 5.0,
        budget: 10.0,
        unit: 'ms',
      },
      api_radio_now_ms: {
        baseline: 8.0,
        budget: 20.0,
        unit: 'ms',
      },
      audio_metadata_overhead_ms: {
        baseline: 15.0,
        budget: 30.0,
        unit: 'ms',
      },
    },
  };

  describe('compareMetrics', () => {
    it('classifies faster metrics with FASTER status and negative delta', () => {
      const current = {
        first_load_js_kb: 110, // -8.3%
        station_rotation_ms: 4.0, // -20%
        api_radio_now_ms: 7.0, // -12.5%
        audio_metadata_overhead_ms: 13.0, // -13.3%
      };

      const report = compareMetrics(current, mockBaseline, 'test-commit-123');
      expect(report.passed).toBe(true);
      expect(report.regressionsCount).toBe(0);
      expect(report.comparisons.length).toBe(4);

      const firstLoad = report.comparisons.find((c) => c.name === 'first_load_js_kb');
      expect(firstLoad?.status).toBe('FASTER');
      expect(firstLoad?.deltaPercent).toBeCloseTo(-8.33, 1);
      expect(firstLoad?.passedBudget).toBe(true);
    });

    it('classifies metrics within tolerance as NEUTRAL', () => {
      const current = {
        first_load_js_kb: 125, // +4.1% (within 15% tolerance)
        station_rotation_ms: 5.2, // +4%
        api_radio_now_ms: 8.5, // +6.25%
        audio_metadata_overhead_ms: 16.0, // +6.6%
      };

      const report = compareMetrics(current, mockBaseline, 'test-commit-123');
      expect(report.passed).toBe(true);
      expect(report.regressionsCount).toBe(0);

      const firstLoad = report.comparisons.find((c) => c.name === 'first_load_js_kb');
      expect(firstLoad?.status).toBe('NEUTRAL');
      expect(firstLoad?.deltaPercent).toBeCloseTo(4.17, 1);
    });

    it('flags REGRESSION when metric exceeds regression tolerance percent or hard budget', () => {
      const current = {
        first_load_js_kb: 160, // +33% AND exceeds budget 150 -> REGRESSION
        station_rotation_ms: 4.5,
        api_radio_now_ms: 7.5,
        audio_metadata_overhead_ms: 14.0,
      };

      const report = compareMetrics(current, mockBaseline, 'test-commit-123');
      expect(report.passed).toBe(false);
      expect(report.regressionsCount).toBe(1);

      const regressed = report.comparisons.find((c) => c.name === 'first_load_js_kb');
      expect(regressed?.status).toBe('REGRESSION');
      expect(regressed?.passedBudget).toBe(false);
    });
  });

  describe('generateStepSummaryMarkdown', () => {
    it('produces formatted markdown table for GitHub Step Summary and PR comments', () => {
      const current = {
        first_load_js_kb: 110,
        station_rotation_ms: 4.0,
        api_radio_now_ms: 7.0,
        audio_metadata_overhead_ms: 13.0,
      };

      const report = compareMetrics(current, mockBaseline, 'abc4567');
      const markdown = generateStepSummaryMarkdown(report);

      expect(markdown).toContain('## ⚡ PromptFM Speed Insights & CI Performance Profiling');
      expect(markdown).toContain('first_load_js_kb');
      expect(markdown).toContain('🟢 FASTER');
      expect(markdown).toContain('All Performance Budgets Met');
      expect(markdown).toContain('https://vercel.com/alextrifan/promptfm/speed-insights');
    });

    it('highlights failure alerts and regressions prominently when budgets are breached', () => {
      const current = {
        first_load_js_kb: 170, // +41% regression
        station_rotation_ms: 4.0,
        api_radio_now_ms: 7.0,
        audio_metadata_overhead_ms: 13.0,
      };

      const report = compareMetrics(current, mockBaseline, 'abc4567');
      const markdown = generateStepSummaryMarkdown(report);

      expect(markdown).toContain('🔴 Performance Regression Detected');
      expect(markdown).toContain('🔴 REGRESSION');
    });
  });

  describe('measureExecutionLatency', () => {
    it('accurately benchmarks synchronous and asynchronous execution', async () => {
      const asyncFn = async () => {
        await new Promise((r) => setTimeout(r, 20));
        return 42;
      };

      const latencyMs = await measureExecutionLatency(asyncFn, 3);
      expect(latencyMs).toBeGreaterThanOrEqual(15);
      expect(latencyMs).toBeLessThan(100);
    });
  });

  describe('loadSpeedBaseline', () => {
    it('loads and validates config/speed-baseline.json from project root', () => {
      const baseline = loadSpeedBaseline();
      expect(baseline.version).toBeGreaterThanOrEqual(1);
      expect(baseline.maxRegressionTolerancePercent).toBeGreaterThan(0);
      expect(baseline.metrics).toBeDefined();
      expect(baseline.metrics.first_load_js_kb).toBeDefined();
    });

    it('throws error when baseline file does not exist', () => {
      expect(() => loadSpeedBaseline('/nonexistent/path/baseline.json')).toThrow(
        'Speed baseline configuration not found at'
      );
    });
  });

  describe('analyzeBundleSizes', () => {
    it('returns calibrated bundle estimates when next directory or manifest does not exist', () => {
      const sizes = analyzeBundleSizes('/nonexistent/next/dir');
      expect(sizes.first_load_js_kb).toBe(112.6);
    });

    it('reads build-manifest.json and calculates total first load JS size', () => {
      const tempDir = path.resolve(__dirname, '../../node_modules/.cache/speed-test-next');
      fs.mkdirSync(tempDir, { recursive: true });
      const manifest = {
        polyfillFiles: ['static/chunks/polyfills.js'],
        pages: {
          '/_app': ['static/chunks/main.js', 'static/chunks/app.js'],
        },
      };
      fs.writeFileSync(path.join(tempDir, 'build-manifest.json'), JSON.stringify(manifest), 'utf8');
      fs.mkdirSync(path.join(tempDir, 'static/chunks'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'static/chunks/polyfills.js'), Buffer.alloc(1024 * 30));
      fs.writeFileSync(path.join(tempDir, 'static/chunks/main.js'), Buffer.alloc(1024 * 40));
      fs.writeFileSync(path.join(tempDir, 'static/chunks/app.js'), Buffer.alloc(1024 * 50));

      const sizes = analyzeBundleSizes(tempDir);
      expect(sizes.first_load_js_kb).toBeCloseTo(120, 0);

      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('measureCriticalPaths', () => {
    it('executes micro-benchmarks across all critical paths', async () => {
      const metrics = await measureCriticalPaths();
      expect(metrics.station_rotation_ms).toBeGreaterThanOrEqual(0);
      expect(metrics.audio_metadata_overhead_ms).toBeGreaterThanOrEqual(0);
      expect(metrics.api_radio_now_ms).toBeGreaterThanOrEqual(0);
      expect(metrics.api_status_cold_start_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('compareMetrics edge cases', () => {
    it('uses fallback baseline and handles zero baseline gracefully', () => {
      const baselineZero: SpeedBaselineConfig = {
        version: 1,
        maxRegressionTolerancePercent: 15,
        metrics: {
          zero_metric: {
            baseline: 0,
            budget: 10,
            unit: 'ms',
          },
        },
      };

      const report = compareMetrics({}, baselineZero, 'test');
      expect(report.passed).toBe(true);
      expect(report.comparisons[0]?.deltaPercent).toBe(0);
      expect(report.comparisons[0]?.current).toBe(0);
    });
  });
});
