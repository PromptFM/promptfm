import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Admin Quick Navigation Badges in README.md', () => {
  const readmePath = path.resolve(__dirname, '../../README.md');

  it('README.md exists', () => {
    expect(fs.existsSync(readmePath)).toBe(true);
  });

  it('contains clickable badge for LOGS linking to GCP / Streamer logs', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    // Must contain badge for LOGS
    expect(content).toMatch(/\[!\[.*LOGS.*\]\(.*\)\]\((https:\/\/console\.cloud\.google\.com\/logs[^)]+)\)/i);
  });

  it('contains clickable badge for DASHBOARDS_GCP linking to GCP Monitoring Dashboard', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    // Must contain badge for DASHBOARDS_GCP
    expect(content).toMatch(/\[!\[.*DASHBOARDS_GCP.*\]\(.*\)\]\((https:\/\/console\.cloud\.google\.com\/monitoring\/dashboards[^)]+)\)/i);
  });

  it('contains clickable badge for DASHBOARDS_VERCEL linking to Vercel Analytics / Dashboard', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    // Must contain badge for DASHBOARDS_VERCEL
    expect(content).toMatch(/\[!\[.*DASHBOARDS_VERCEL.*\]\(.*\)\]\((https:\/\/vercel\.com\/alextrifan\/promptfm[^)]+)\)/i);
  });

  it('contains clickable badge for TRACES_GCP linking to GCP Cloud Trace', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    // Must contain badge for TRACES_GCP
    expect(content).toMatch(/\[!\[.*TRACES_GCP.*\]\(.*\)\]\((https:\/\/console\.cloud\.google\.com\/traces[^)]+)\)/i);
  });

  it('contains clickable badge for LOGS_VERCEL linking to Vercel Runtime Logs', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    // Must contain badge for LOGS_VERCEL
    expect(content).toMatch(/\[!\[.*LOGS_VERCEL.*\]\(.*\)\]\((https:\/\/vercel\.com\/alextrifan\/promptfm\/logs[^)]*)\)/i);
  });

  it('contains clickable badge for FLAGS_VERCEL linking to Vercel Feature Flags Console', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    // Must contain badge for FLAGS_VERCEL
    expect(content).toMatch(/\[!\[.*FLAGS_VERCEL.*\]\(.*\)\]\((https:\/\/vercel\.com\/alextrifan\/promptfm\/flags[^)]*)\)/i);
  });

  it('contains Vercel Feature Flags entry in Operational Dashboards table and Admin Docs', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toContain('https://vercel.com/alextrifan/promptfm/flags');
    expect(content).toMatch(/Vercel.*Flags/i);
    expect(content).toMatch(/kill-switch|kill switch|feature flag/i);
  });

  it('contains clickable badge for SPEED_INSIGHTS_VERCEL linking to Vercel Speed Insights', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toMatch(/\[!\[.*SPEED_INSIGHTS.*\]\(.*\)\]\((https:\/\/vercel\.com\/alextrifan\/promptfm\/speed-insights[^)]*)\)/i);
  });

  it('contains Vercel Speed Insights entry in Operational Dashboards table', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toContain('https://vercel.com/alextrifan/promptfm/speed-insights');
    expect(content).toMatch(/Speed Insights/i);
    expect(content).toMatch(/Core Web Vitals|RUM/i);
  });

  it('contains Vercel Speed Insights quick link in Admin page', () => {
    const adminPagePath = path.resolve(__dirname, '../../src/app/admin/page.tsx');
    const content = fs.readFileSync(adminPagePath, 'utf8');
    expect(content).toContain('https://vercel.com/alextrifan/promptfm/speed-insights');
    expect(content).toMatch(/Vercel Speed Insights/i);
  });

  it('verifies all local badge asset references in README.md exist on disk', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    const badgeRegex = /!\[([^\]]*)\]\((\.\/public\/badges\/[^)]+\.svg|public\/badges\/[^)]+\.svg)\)/g;
    const matches = [...content.matchAll(badgeRegex)];

    expect(matches.length).toBeGreaterThan(0);

    for (const match of matches) {
      const relPath = match[2];
      if (!relPath) continue;
      const normalizedPath = path.resolve(__dirname, '../../', relPath.replace(/^\.\//, ''));
      expect(fs.existsSync(normalizedPath), `Local badge asset ${relPath} does not exist on disk`).toBe(true);
    }
  });

  it('contains resilient Production and Status badges without fragile shields.io parameters', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toMatch(/\[!\[.*Production.*\]\(.*\)\]\(https:\/\/promptfm\.live\)/i);
    expect(content).toMatch(/\[!\[.*Status.*\]\(.*\)\]\(https:\/\/promptfm\.live\/status\)/i);
  });
});

