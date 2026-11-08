import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PromptFM Documentation & Architecture Portal (docs/index.html)', () => {
  const portalPath = path.resolve(__dirname, '../../docs/index.html');

  it('docs/index.html exists', () => {
    expect(fs.existsSync(portalPath)).toBe(true);
  });

  it('contains all 12 operational and developer sections', () => {
    const html = fs.readFileSync(portalPath, 'utf8');

    // 1. AI Prompts
    expect(html).toMatch(/id="prompts"|AI Prompts|DJ Prompts|Monologues/i);
    // 2. CLI Reference
    expect(html).toMatch(/id="cli"|CLI Command Reference|npm run promptfm/i);
    // 3. Setting MCP
    expect(html).toMatch(/id="mcp"|mcp-integration-guide\.md|Model Context Protocol/i);
    // 4. Dashboards & Realtime Status
    expect(html).toMatch(/id="dashboards"|Cloud Monitoring|Vercel Analytics|Realtime Status/i);
    expect(html).toContain('https://vercel.com/alextrifan/promptfm/flags');
    expect(html).toContain('promptfm-radio-1793623670');
    expect(html).toContain('/api/status');
    // 5. Contributing Guidelines
    expect(html).toMatch(/id="contributing"|CONTRIBUTING\.md|Test-Driven Development|Stryker Mutation/i);
    // 6. Roadmap Status
    expect(html).toMatch(/id="roadmap"|ROADMAP\.md|Public Roadmap|Milestones/i);
    // 7. Multi-Rail Funding
    expect(html).toMatch(/id="funding"|GitHub Sponsors|donate\.stripe\.com|ko-fi\.com/i);
    // 8. Runbooks & Disaster Recovery
    expect(html).toMatch(/id="runbooks"|admin-guide\.md|Runbooks|Disaster Recovery|Rollback/i);
    // 9. Workflows
    expect(html).toMatch(/id="workflows"|GitHub Actions|ci\.yml|apply-terraform\.yml|apply-sql-schema\.yml/i);
    // 10. Filing Bugs and Issues
    expect(html).toMatch(/id="issues"|Filing Bugs|SECURITY\.md|Bug Reports/i);
    // 11. Relevant Contacts
    expect(html).toMatch(/id="contacts"|dev@promptfm\.live|@atrifan|Contacts/i);
    // 12. Social Networks
    expect(html).toMatch(/id="socials"|@promptfm_live|discord|telegram/i);
  });

  it('includes interactive quick search or filter capability for terminal commands and docs', () => {
    const html = fs.readFileSync(portalPath, 'utf8');
    expect(html).toMatch(/search|filter/i);
    expect(html).toContain('input');
  });

  it('contains links to rollbacks and SemVer tagging lanes', () => {
    const html = fs.readFileSync(portalPath, 'utf8');
    expect(html).toContain('promptfm-infra');
    expect(html).toContain('promptfm-sql');
    expect(html).toMatch(/rollback/i);
  });

  describe('Oracle monitor links', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const metrics = 'https://cloud.oracle.com/monitoring/metrics-explorer?region=us-ashburn-1';

    it('docs portal has a clickable Oracle monitor banner, a header button and a dashboards card', () => {
      const html = fs.readFileSync(portalPath, 'utf8');
      expect(html).toMatch(new RegExp(`<a class="oracle-banner" href="${metrics.replace(/[?.]/g, '\\$&')}"[^>]*rel="noopener"`));
      expect(html).toContain('Oracle Monitor</a>');
      expect(html).toContain('Oracle Cloud (Always Free)');
      expect(html).toContain('https://cloud.oracle.com/quotas');
      expect(html).toContain('https://cloud.oracle.com/account-management/cost-analysis');
    });

    it('keeps keyboard focus visible on the banner', () => {
      const html = fs.readFileSync(portalPath, 'utf8');
      expect(html).toContain('.oracle-banner:focus-visible');
    });

    it('README links the Oracle badges and documents the $0 guardrails', () => {
      const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
      expect(readme).toContain('[![Oracle Always Free](./public/badges/oracle-always-free.svg)]');
      expect(readme).toContain('[![DASHBOARDS_ORACLE](./public/badges/dashboards-oracle.svg)](' + metrics + ')');
      expect(readme).toContain('### $0 guardrails on Oracle');
      expect(readme).toContain('promptfm-always-free-only');
    });

    it('ships the Oracle badge images', () => {
      for (const name of ['oracle-always-free', 'oracle-quota-cap', 'dashboards-oracle']) {
        const svg = fs.readFileSync(path.join(rootDir, 'public/badges', `${name}.svg`), 'utf8');
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('aria-label=');
      }
    });
  });
});
