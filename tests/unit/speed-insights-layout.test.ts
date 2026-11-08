import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Vercel Speed Insights Integration', () => {
  const layoutPath = path.resolve(__dirname, '../../src/app/layout.tsx');

  it('imports SpeedInsights from @vercel/speed-insights/next for Next.js App Router', () => {
    const content = fs.readFileSync(layoutPath, 'utf8');
    expect(content).toContain("import { SpeedInsights } from '@vercel/speed-insights/next'");
    expect(content).not.toContain("import { SpeedInsights } from '@vercel/speed-insights/react'");
  });

  it('renders <SpeedInsights /> component inside the body of RootLayout', () => {
    const content = fs.readFileSync(layoutPath, 'utf8');
    expect(content).toContain('<SpeedInsights />');
  });
});
