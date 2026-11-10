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

  it('contains clickable badge for DASHBOARDS_ORACLE linking to Oracle Metrics Explorer', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toMatch(/\[!\[.*DASHBOARDS_ORACLE.*\]\(.*\)\]\((https:\/\/cloud\.oracle\.com\/monitoring\/metrics-explorer[^)]+)\)/i);
  });

  it('contains clickable badge for TRACES_GCP linking to GCP Cloud Trace', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    // Must contain badge for TRACES_GCP
    expect(content).toMatch(/\[!\[.*TRACES_GCP.*\]\(.*\)\]\((https:\/\/console\.cloud\.google\.com\/traces[^)]+)\)/i);
  });

  it('documents the current Oracle-hosted maintenance restore state', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toContain('Oracle-hosted maintenance page');
    expect(content).toContain('stream.promptfm.live');
    expect(content).toMatch(/OCI app migration|OCI deploy path/i);
  });

  it('documents Oracle $0 guardrails and quota enforcement', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toContain('### $0 guardrails on Oracle');
    expect(content).toContain('promptfm-always-free-only');
    expect(content).toMatch(/quota policy/i);
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

  it('contains resilient Production and System Status badges matching the current restore state', () => {
    const content = fs.readFileSync(readmePath, 'utf8');
    expect(content).toMatch(/\[!\[.*Production.*\]\(.*\)\]\(https:\/\/promptfm\.live\)/i);
    expect(content).toContain('status-degraded.svg');
    expect(content).toMatch(/\[!\[.*System Status.*\]\(.*\)\]\(https:\/\/github\.com\/PromptFM\/promptfm\/issues\/191\)/i);
  });
});
