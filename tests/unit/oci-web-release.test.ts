import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('OCI web release retention helper', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const helperPath = path.join(rootDir, 'src/lib/infra/oci-web-release.ts');

  it('exists so release and rollback can share deterministic retained-release logic', () => {
    expect(fs.existsSync(helperPath)).toBe(true);
  });

  it('defines helpers for current release lookup, previous release selection, and prune planning', () => {
    expect(fs.existsSync(helperPath)).toBe(true);
    if (!fs.existsSync(helperPath)) {
      return;
    }

    const content = fs.readFileSync(helperPath, 'utf8');
    expect(content).toMatch(/current.*release|release.*current/i);
    expect(content).toMatch(/previous.*release|release.*previous/i);
    expect(content).toMatch(/prune|retain/i);
  });
});
