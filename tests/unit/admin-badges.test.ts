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
});

