import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Infrastructure overview doc (docs/infra-overview.md)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const read = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');
  const doc = read('docs/infra-overview.md');

  it('has the infrastructure diagram and the alert flow as Mermaid', () => {
    expect(doc.match(/```mermaid/g)?.length).toBeGreaterThanOrEqual(2);
    for (const node of ['Oracle Cloud Always Free', 'Vercel Hobby', 'Cloudflare R2', 'Supabase', 'Hostinger', 'Resend', 'Secret Manager']) {
      expect(doc).toContain(node);
    }
  });

  it('says which system is used for what, and which commands still apply', () => {
    expect(doc).toContain('## 2. What we use for what');
    expect(doc).toContain('## 3. Which commands still apply');
    expect(doc).toContain('infra/converge-stream.sh');
    expect(doc).toContain('infra/ansible/deploy-oci.sh');
  });

  it('is honest that the video feeds do not work on either host', () => {
    expect(doc).toContain('**No, on either host today.**');
    expect(doc).toContain('stream start / stop / status');
  });

  it('explains the stream host switch and the tags, including why the 0.1.0 tag cannot be applied', () => {
    expect(doc).toContain('infra/stream-host');
    expect(doc).toContain('promptfm-infra/0.3.0-<sha>');
    expect(doc).toContain('promptfm-infra/0.2.0-<sha>');
    expect(doc).toContain('promptfm-infra/0.1.0-9b8127b');
    expect(doc).toContain('npm run promptfm -- tag infra --version 0.3.0');
    expect(doc).toContain('not** applied automatically');
  });

  it('has a runbook for Oracle failing that says the GCP fallback breaks the $0 goal and gives the cost', () => {
    expect(doc).toContain('## 5. Runbook: Oracle stopped working');
    expect(doc).toContain('Fix it on Oracle first');
    expect(doc).toContain('This breaks the $0 goal');
    expect(doc).toContain('$0.17 a day');
    expect(doc).toContain('Rollback Infrastructure');
  });

  it('lists the alert emails and says both Oracle and GCP reach dev@promptfm.live', () => {
    expect(doc).toContain('## 6. Alert emails to look for');
    expect(doc).toContain('Oracle Cloud Infrastructure Notifications');
    expect(doc).toContain('Google Cloud Billing');
    expect(doc).toContain('dev@promptfm.live');
    expect(doc).toContain('Click Confirm');
  });

  it('does not mention scripts that no longer exist', () => {
    expect(doc).not.toContain('rollback-stream-to-gcp');
    expect(doc).not.toContain('return-stream-to-oracle');
  });

  it('is linked from the README, the docs portal and the Oracle doc', () => {
    expect(read('README.md')).toContain('docs/infra-overview.md');
    expect(read('docs/index.html')).toContain('docs/infra-overview.md');
    expect(read('docs/oracle-always-free-streamer.md')).toContain('infra-overview.md');
  });
});
