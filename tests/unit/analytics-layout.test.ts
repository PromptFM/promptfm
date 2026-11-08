import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Vercel Web Analytics Integration (Issue #30)', () => {
  const layoutPath = path.resolve(__dirname, '../../src/app/layout.tsx');

  it('imports Analytics from @vercel/analytics/next for Next.js App Router', () => {
    const content = fs.readFileSync(layoutPath, 'utf8');
    // Must import from @vercel/analytics/next, NOT @vercel/analytics/react
    expect(content).toContain("import { Analytics } from '@vercel/analytics/next'");
    expect(content).not.toContain("import { Analytics } from '@vercel/analytics/react'");
  });

  it('renders <Analytics /> component inside the body of RootLayout', () => {
    const content = fs.readFileSync(layoutPath, 'utf8');
    expect(content).toContain('<Analytics />');
  });
});

