import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { generateAllBadges, BADGE_DEFINITIONS } from '@/lib/badges/badge-catalog';

describe('Badge Catalog & Asset Generation', () => {
  const outputDir = path.resolve(process.cwd(), 'public/badges');

  beforeAll(() => {
    generateAllBadges(outputDir);
  });

  it('contains definitions for all standard repository badges', () => {
    const requiredKeys = [
      'production',
      'deployed-on-vercel',
      'status-operational',
      'status-degraded',
      'status-outage',
      'tests',
      'mutation',
      'gcp-always-free',
      'logs-cloud-logging',
      'logs-vercel',
      'flags-vercel',
      'dashboards-gcp',
      'dashboards-vercel',
      'speed-insights-vercel',
      'traces-gcp',
      'license',
    ];

    for (const key of requiredKeys) {
      expect(BADGE_DEFINITIONS).toHaveProperty(key);
      const def = BADGE_DEFINITIONS[key];
      expect(def).toBeDefined();
      expect(def?.label).toBeTruthy();
      expect(def?.message).toBeTruthy();
      expect(def?.color).toBeTruthy();
    }
  });

  it('generates valid, readable SVG files in public/badges', () => {
    expect(fs.existsSync(outputDir)).toBe(true);

    for (const key of Object.keys(BADGE_DEFINITIONS)) {
      const filePath = path.join(outputDir, `${key}.svg`);
      expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);

      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(content).toContain('height="28"');
      expect(content).toContain('role="img"');
      expect(content.endsWith('</svg>')).toBe(true);
    }
  });
});
