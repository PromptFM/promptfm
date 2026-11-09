import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('$0 policy doc (docs/zero-cost-policy.md)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const read = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');
  const doc = read('docs/zero-cost-policy.md');

  it('covers Oracle, Google Cloud and Vercel', () => {
    for (const heading of ['## Oracle Cloud', '## Google Cloud', '## Vercel']) {
      expect(doc).toContain(heading);
    }
  });

  it('says plainly that budgets alert and do not stop spending', () => {
    expect(doc).toMatch(/budget is an alert, not a cap/i);
    expect(doc).toContain('Alert only. There is no hard cap on GCP');
  });

  it('names the real alert and cap resources so they cannot be renamed silently', () => {
    const oci = read('infra/terraform-oci/main.tf');
    for (const name of ['promptfm-always-free-only', 'promptfm-1-usd-alert', 'promptfm-streamer-egress-daily']) {
      expect(doc).toContain(name);
      expect(oci).toContain(name);
    }
    expect(doc).toContain('$1 Monthly Budget Alert');
  });

  it('states the listener cap that matches Icecast', () => {
    const xml = read('deploy/streamer/icecast.xml');
    const max = xml.match(/<max-listeners>(\d+)<\/max-listeners>/)?.[1];
    expect(doc).toContain(`max-listeners\` ${max}`);
  });

  it('is linked from the README, the admin guide and the docs portal', () => {
    expect(read('README.md')).toContain('docs/zero-cost-policy.md');
    expect(read('docs/admin-guide.md')).toContain('zero-cost-policy.md');
    expect(read('docs/index.html')).toContain('docs/zero-cost-policy.md');
  });

  it('does not claim Vercel alerts are configured by the repo', () => {
    expect(doc).toContain('**not set by this repo**');
  });
});
