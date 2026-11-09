import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// The retired GCP VM stays stopped unless the stream is switched back to it (see stream-switch.test.ts).
describe('GCP VM (infra/terraform)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const read = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');

  it('keeps the GCP streamer VM stopped unless streamer_vm_running is set', () => {
    const main = read('infra/terraform/main.tf');
    const vars = read('infra/terraform/variables.tf');
    expect(main).toContain('desired_status            = var.streamer_vm_running ? "RUNNING" : "TERMINATED"');
    expect(vars).toMatch(/variable "streamer_vm_running"[\s\S]*?default\s*=\s*false/);
  });
});
