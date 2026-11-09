import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Resend Forwarding workflow (resend-forwarding.yml)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const read = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');
  const wf = read('.github/workflows/resend-forwarding.yml');
  const forwarding = JSON.parse(read('config/inbound-forwarding.json'));

  it('runs by hand with an address dropdown and a list of emails', () => {
    expect(wf).toContain('workflow_dispatch:');
    expect(wf).toMatch(/address:[\s\S]*?type: choice/);
    expect(wf).toMatch(/forward_to:[\s\S]*?type: string/);
  });

  it('the dropdown lists exactly the addresses in config/inbound-forwarding.json', () => {
    const block = wf.split('options:')[1]?.split('forward_to:')[0] ?? '';
    const options = [...block.matchAll(/^\s+- (\w+)\s*$/gm)].map((m) => m[1]).sort();
    expect(options).toEqual(Object.keys(forwarding.aliases).sort());
  });

  it('passes inputs through env, never straight into the shell script', () => {
    expect(wf).toContain('ADDRESS: ${{ inputs.address }}');
    expect(wf).toContain('FORWARD_TO: ${{ inputs.forward_to }}');
    const runs = [...wf.matchAll(/run: \|\n([\s\S]*?)(?=\n      - name:|\n*$)/g)].map((m) => m[1]).join('\n');
    expect(runs).not.toContain('${{ inputs.');
  });

  it('changes the file with the same code the app tests cover and opens a pull request', () => {
    expect(wf).toContain('npm run -s email:forward');
    expect(wf).toContain('gh pr create --base main');
    expect(wf).toContain('pull-requests: write');
  });

  it('does nothing when the address already forwards there', () => {
    expect(wf).toContain("steps.change.outputs.changed == 'true'");
  });

  it('has an npm script for the same change on a laptop', () => {
    expect(JSON.parse(read('package.json')).scripts['email:forward']).toBe('jiti scripts/set-inbound-forwarding.ts');
  });
});
