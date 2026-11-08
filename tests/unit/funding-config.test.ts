import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Sponsors & Multi-Rail Funding Configuration', () => {
  const fundingYmlPath = path.resolve(__dirname, '../../.github/FUNDING.yml');
  const docsIndexPath = path.resolve(__dirname, '../../docs/index.html');
  const readmePath = path.resolve(__dirname, '../../README.md');

  it('.github/FUNDING.yml points to promptfm organization and signup link', () => {
    expect(fs.existsSync(fundingYmlPath)).toBe(true);
    const content = fs.readFileSync(fundingYmlPath, 'utf8');

    // Should point to promptfm org, not individual handle atrifan
    expect(content).toMatch(/github:\s*\[promptfm\]/i);
    expect(content).not.toMatch(/github:\s*\[atrifan\]/i);
    expect(content).toContain('https://github.com/sponsors/promptfm/signup');
  });

  it('docs/index.html uses promptfm sponsorship signup link instead of sponsors/atrifan', () => {
    expect(fs.existsSync(docsIndexPath)).toBe(true);
    const content = fs.readFileSync(docsIndexPath, 'utf8');

    expect(content).toContain('https://github.com/sponsors/promptfm/signup');
    expect(content).not.toContain('https://github.com/sponsors/atrifan');
  });

  it('README.md references promptfm sponsorship signup link', () => {
    expect(fs.existsSync(readmePath)).toBe(true);
    const content = fs.readFileSync(readmePath, 'utf8');

    expect(content).toContain('https://github.com/sponsors/promptfm/signup');
    expect(content).not.toContain('https://github.com/sponsors/atrifan');
  });
});

