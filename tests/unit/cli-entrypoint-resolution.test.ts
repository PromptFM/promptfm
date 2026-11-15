// tests/unit/cli-entrypoint-resolution.test.ts
// Unit tests ensuring scripts and src/lib dependencies resolve properly under jiti and Node environments.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createJiti } from 'jiti';

function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllTypeScriptFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts') && !entry.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('CLI and Library Module Resolution', () => {
  it('ensures all files in src/lib use relative imports instead of @/ path aliases', () => {
    const srcLibDir = join(process.cwd(), 'src', 'lib');
    const files = getAllTypeScriptFiles(srcLibDir);
    const offendingImports: { file: string; match: string }[] = [];

    // Regex matching any import or export from '@/...'
    const aliasImportRegex = /(?:import|from|require)\s*\(?['"]@\/[^'"]+['"]/g;

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const matches = content.match(aliasImportRegex);
      if (matches) {
        for (const match of matches) {
          offendingImports.push({ file: file.replace(process.cwd(), ''), match });
        }
      }
    }

    expect(offendingImports).toEqual([]);
  });

  it('loads public-catalog successfully via jiti without MODULE_NOT_FOUND', () => {
    const jiti = createJiti(process.cwd());
    const publicCatalog = jiti('./src/lib/library/public-catalog') as Record<string, unknown>;

    expect(publicCatalog).toBeDefined();
    expect(typeof publicCatalog.buildPublicCatalog).toBe('function');
    expect(typeof publicCatalog.fetchApprovedCatalogTracks).toBe('function');
    expect(publicCatalog.DEFAULT_PAGE_SIZE).toBe(20);
    expect(publicCatalog.PUBLIC_PREVIEW_SECONDS).toBe(15);
  });
});
