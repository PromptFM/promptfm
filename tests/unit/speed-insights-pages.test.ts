import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Pages Speed Insights Integration', () => {
  const docsDir = path.resolve(__dirname, '../../docs');

  it('docs/index.html includes Speed Insights status item and direct links', () => {
    const indexPath = path.join(docsDir, 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);
    const content = fs.readFileSync(indexPath, 'utf8');

    expect(content).toContain('Speed Insights');
    expect(content).toContain('https://vercel.com/alextrifan/promptfm/speed-insights');
    expect(content).toContain('speed-insights.html');
  });

  it('docs/speed-insights.html exists and documents Core Web Vitals and CI profiling benchmarks', () => {
    const speedInsightsPath = path.join(docsDir, 'speed-insights.html');
    expect(fs.existsSync(speedInsightsPath)).toBe(true);
    const content = fs.readFileSync(speedInsightsPath, 'utf8');

    expect(content).toContain('Speed Insights');
    expect(content).toContain('Performance Profiling');
    expect(content).toContain('Real User Monitoring (RUM) Core Web Vitals');
    expect(content).toContain('Performance Profiling Benchmarks');
    expect(content).toContain('@vercel/speed-insights');
    expect(content).toContain('First Load JS');
    expect(content).toContain('Station Rotation Queue Latency');
  });
});
