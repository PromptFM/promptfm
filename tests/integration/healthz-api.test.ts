import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GET /api/healthz deploy-readiness API Integration', () => {
  const routePath = path.resolve(__dirname, '../../src/app/api/healthz/route.ts');

  it('adds a dedicated healthz route for OCI cutover readiness', () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('implements a lightweight readiness contract that is separate from /api/status', () => {
    expect(fs.existsSync(routePath)).toBe(true);

    if (!fs.existsSync(routePath)) {
      return;
    }

    const content = fs.readFileSync(routePath, 'utf8');
    expect(content).toMatch(/ready|ok/i);
    expect(content).not.toMatch(/services\s*:/);
  });
});
