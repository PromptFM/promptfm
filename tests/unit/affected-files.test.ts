import { describe, it, expect, vi } from 'vitest';
import {
  detectChangedFiles,
  filterMutatableFiles,
  shouldRunMutationTesting,
  buildStrykerArgs,
  shouldRunE2ETests,
  extractHunkLineRanges,
  isCommentOrWhitespaceOnly,
  filterFunctionalMutatableChanges,
  findRelatedTestFiles,
} from '@/lib/testing/affected';

describe('Affected Files & Targeted Testing Engine', () => {
  describe('detectChangedFiles', () => {
    it('parses git diff output into a clean array of file paths', () => {
      const mockExec = vi.fn().mockImplementation((cmd: string) => {
        if (cmd.includes('...HEAD')) {
          return `
            src/lib/dj/engine.ts
            src/lib/safety/guardrails.ts
            tests/unit/dj-engine.test.ts
          `;
        }
        return '';
      });

      const files = detectChangedFiles({
        baseRef: 'origin/main',
        execFn: mockExec,
      });

      expect(mockExec).toHaveBeenCalledWith(
        'git diff --name-only origin/main...HEAD',
        expect.any(Object)
      );
      expect(files).toEqual([
        'src/lib/dj/engine.ts',
        'src/lib/safety/guardrails.ts',
        'tests/unit/dj-engine.test.ts',
      ]);
    });

    it('includes uncommitted working-tree and untracked files when present', () => {
      const mockExec = vi.fn().mockImplementation((cmd: string) => {
        if (cmd.includes('...HEAD')) {
          return 'src/lib/dj/rotation.ts\n';
        }
        if (cmd === 'git diff --name-only HEAD') {
          return 'src/lib/safety/guardrails.ts\n';
        }
        if (cmd.includes('ls-files')) {
          return 'src/lib/community/new-feature.ts\n';
        }
        return '';
      });

      const files = detectChangedFiles({
        baseRef: 'origin/main',
        execFn: mockExec,
      });

      expect(files).toEqual([
        'src/lib/dj/rotation.ts',
        'src/lib/safety/guardrails.ts',
        'src/lib/community/new-feature.ts',
      ]);
    });

    it('falls back to git diff HEAD when base comparison fails or branch is local', () => {
      const mockExec = vi.fn().mockImplementation((cmd: string) => {
        if (cmd.includes('origin/main...HEAD')) {
          throw new Error('fatal: ambiguous argument origin/main');
        }
        if (cmd.includes('HEAD~1...HEAD')) {
          return 'src/lib/radio/channels.ts\n';
        }
        return '';
      });

      const files = detectChangedFiles({
        baseRef: 'origin/main',
        fallbackRef: 'HEAD~1',
        execFn: mockExec,
      });

      expect(files).toEqual(['src/lib/radio/channels.ts']);
    });

    it('handles empty git diff gracefully', () => {
      const mockExec = vi.fn().mockReturnValue('');
      const files = detectChangedFiles({ execFn: mockExec });
      expect(files).toEqual([]);
    });

    it('uses default baseRef and fallbackRef when not provided', () => {
      const mockExec = vi.fn().mockReturnValue('src/lib/dj/engine.ts\n');
      const files = detectChangedFiles({ execFn: mockExec });
      expect(mockExec).toHaveBeenCalledWith(
        'git diff --name-only origin/main...HEAD',
        expect.objectContaining({ encoding: 'utf-8', stdio: 'pipe' })
      );
      expect(files).toEqual(['src/lib/dj/engine.ts']);
    });

    it('falls back to default fallbackRef HEAD~1 when baseRef fails', () => {
      const mockExec = vi.fn()
        .mockImplementationOnce(() => {
          throw new Error('remote base not found');
        })
        .mockReturnValue('src/lib/dj/engine.ts\n');

      const files = detectChangedFiles({ execFn: mockExec });
      expect(mockExec).toHaveBeenCalledWith(
        'git diff --name-only HEAD~1...HEAD',
        expect.objectContaining({ encoding: 'utf-8', stdio: 'pipe' })
      );
      expect(files).toContain('src/lib/dj/engine.ts');
    });

    it('returns empty array if all git commands throw', () => {
      const mockExec = vi.fn().mockImplementation(() => {
        throw new Error('git not found');
      });
      const files = detectChangedFiles({ execFn: mockExec });
      expect(files).toEqual([]);
    });
  });

  describe('filterMutatableFiles', () => {
    it('selects core domain TypeScript files under src/lib', () => {
      const files = [
        'src/lib/dj/rotation.ts',
        'src/lib/safety/guardrails.ts',
        'src/components/AudioPlayer.tsx',
        'docs/admin-guide.md',
        'infra/terraform/main.tf',
      ];

      const mutatable = filterMutatableFiles(files);
      expect(mutatable).toEqual([
        'src/lib/dj/rotation.ts',
        'src/lib/safety/guardrails.ts',
      ]);
    });

    it('excludes test files, spec files, and type definitions', () => {
      const files = [
        'src/lib/dj/rotation.ts',
        'src/lib/dj/rotation.test.ts',
        'src/lib/radio/channels.spec.ts',
        'src/lib/types.d.ts',
      ];

      const mutatable = filterMutatableFiles(files);
      expect(mutatable).toEqual(['src/lib/dj/rotation.ts']);
    });

    it('allows custom include patterns and exclude patterns', () => {
      const files = [
        'src/lib/dj/rotation.ts',
        'src/services/billing.ts',
        'src/services/billing.test.ts',
      ];

      const mutatable = filterMutatableFiles(files, {
        include: [/^src\/services\//],
        exclude: [/\.test\.ts$/],
      });

      expect(mutatable).toEqual(['src/services/billing.ts']);
    });

    it('matches when any one of multiple include patterns matches', () => {
      const files = [
        'src/services/billing.ts',
        'src/domain/users.ts',
        'src/other/misc.ts',
      ];

      const mutatable = filterMutatableFiles(files, {
        include: [/^src\/services\//, /^src\/domain\//],
        exclude: [],
      });

      expect(mutatable).toEqual([
        'src/services/billing.ts',
        'src/domain/users.ts',
      ]);
    });
  });

  describe('shouldRunMutationTesting', () => {
    it('returns true when mutatable files exist', () => {
      expect(shouldRunMutationTesting(['src/lib/dj/rotation.ts'])).toBe(true);
    });

    it('returns false when no mutatable files exist', () => {
      expect(shouldRunMutationTesting([])).toBe(false);
    });
  });

  describe('buildStrykerArgs', () => {
    it('generates correct stryker CLI flags for given files', () => {
      const files = ['src/lib/dj/rotation.ts', 'src/lib/safety/guardrails.ts'];
      const args = buildStrykerArgs(files);

      expect(args).toEqual([
        'run',
        '--mutate',
        'src/lib/dj/rotation.ts,src/lib/safety/guardrails.ts',
      ]);
    });

    it('appends incremental flag when requested', () => {
      const files = ['src/lib/dj/rotation.ts'];
      const args = buildStrykerArgs(files, { incremental: true });

      expect(args).toEqual([
        'run',
        '--mutate',
        'src/lib/dj/rotation.ts',
        '--incremental',
      ]);
    });

    it('appends custom config file when provided', () => {
      const files = ['src/lib/dj/rotation.ts'];
      const args = buildStrykerArgs(files, { configFile: 'stryker.fast.json' });

      expect(args).toEqual([
        'run',
        'stryker.fast.json',
        '--mutate',
        'src/lib/dj/rotation.ts',
      ]);
    });

    it('passes multiple files and line range targets accurately', () => {
      const targets = [
        'src/lib/dj/rotation.ts:12-25',
        'src/lib/dj/rotation.ts:50-55',
        'src/lib/safety/guardrails.ts:100-112',
      ];
      const args = buildStrykerArgs(targets);

      expect(args).toEqual([
        'run',
        '--mutate',
        'src/lib/dj/rotation.ts:12-25,src/lib/dj/rotation.ts:50-55,src/lib/safety/guardrails.ts:100-112',
      ]);
    });

    it('appends testFiles option when related test files are provided', () => {
      const files = ['src/lib/dj/rotation.ts:10-20'];
      const testFiles = [
        'tests/unit/rotation.test.ts',
        'tests/integration/queue-api.test.ts',
      ];
      const args = buildStrykerArgs(files, { testFiles });

      expect(args).toEqual([
        'run',
        '--mutate',
        'src/lib/dj/rotation.ts:10-20',
        '--testFiles',
        'tests/unit/rotation.test.ts,tests/integration/queue-api.test.ts',
      ]);
    });

    it('omits testFiles flag when testFiles is empty or undefined', () => {
      const files = ['src/lib/dj/rotation.ts:10-20'];
      const args = buildStrykerArgs(files, { testFiles: [] });

      expect(args).toEqual([
        'run',
        '--mutate',
        'src/lib/dj/rotation.ts:10-20',
      ]);
    });
  });

  describe('shouldRunE2ETests', () => {
    it('returns true when UI components or app pages change', () => {
      expect(shouldRunE2ETests(['src/components/AudioPlayer.tsx'])).toBe(true);
      expect(shouldRunE2ETests(['src/app/page.tsx'])).toBe(true);
      expect(shouldRunE2ETests(['src/app/api/radio/next/route.ts'])).toBe(true);
      // Mixed files: some UI, some non-UI
      expect(
        shouldRunE2ETests(['README.md', 'src/components/AudioPlayer.tsx'])
      ).toBe(true);
    });

    it('returns true when e2e tests or playwright config change', () => {
      expect(shouldRunE2ETests(['tests/e2e/home.spec.ts'])).toBe(true);
      expect(shouldRunE2ETests(['playwright.config.ts'])).toBe(true);
      expect(shouldRunE2ETests(['package.json'])).toBe(true);
    });

    it('returns false when only documentation, infra, or unit tests change', () => {
      expect(
        shouldRunE2ETests([
          'README.md',
          'docs/admin-guide.md',
          'infra/terraform/main.tf',
          'tests/unit/funding.test.ts',
          '.github/workflows/pages.yml',
        ])
      ).toBe(false);
    });

    it('returns true as fail-safe when changed files list is empty', () => {
      expect(shouldRunE2ETests([])).toBe(true);
    });
  });

  describe('extractHunkLineRanges', () => {
    it('extracts multi-line hunk line ranges into file:start-end format', () => {
      const diffOutput = `
diff --git a/src/lib/dj/rotation.ts b/src/lib/dj/rotation.ts
--- a/src/lib/dj/rotation.ts
+++ b/src/lib/dj/rotation.ts
@@ -10,3 +10,5 @@
+const x = 1;
+const y = 2;
@@ -40,2 +42,3 @@
+const z = 3;
`;
      const targets = extractHunkLineRanges(diffOutput);
      expect(targets).toEqual([
        'src/lib/dj/rotation.ts:10-14',
        'src/lib/dj/rotation.ts:42-44',
      ]);
    });

    it('extracts single line hunk without count (+start)', () => {
      const diffOutput = `
diff --git a/src/lib/safety/guardrails.ts b/src/lib/safety/guardrails.ts
--- a/src/lib/safety/guardrails.ts
+++ b/src/lib/safety/guardrails.ts
@@ -25 +25 @@
-const oldVal = 1;
+const newVal = 2;
`;
      const targets = extractHunkLineRanges(diffOutput);
      expect(targets).toEqual(['src/lib/safety/guardrails.ts:25-25']);
    });

    it('ignores pure deletions with new count of 0 (+start,0)', () => {
      const diffOutput = `
diff --git a/src/lib/dj/rotation.ts b/src/lib/dj/rotation.ts
--- a/src/lib/dj/rotation.ts
+++ b/src/lib/dj/rotation.ts
@@ -10,5 +10,0 @@
-const deletedLine = 1;
-const deletedLine2 = 2;
`;
      const targets = extractHunkLineRanges(diffOutput);
      expect(targets).toEqual([]);
    });

    it('merges overlapping or adjacent hunk ranges for the same file', () => {
      const diffOutput = `
diff --git a/src/lib/dj/rotation.ts b/src/lib/dj/rotation.ts
--- a/src/lib/dj/rotation.ts
+++ b/src/lib/dj/rotation.ts
@@ -10,3 +10,4 @@
@@ -14,2 +14,3 @@
@@ -30,1 +30,2 @@
`;
      // Hunk 1: 10 + 4 - 1 = 13 (lines 10-13)
      // Hunk 2: 14 + 3 - 1 = 16 (lines 14-16) -> Adjacent! 14 <= 13 + 1 -> Merged into 10-16
      // Hunk 3: 30 + 2 - 1 = 31 (lines 30-31)
      const targets = extractHunkLineRanges(diffOutput);
      expect(targets).toEqual([
        'src/lib/dj/rotation.ts:10-16',
        'src/lib/dj/rotation.ts:30-31',
      ]);
    });

    it('handles diffs across multiple files and filters to mutatable files if requested', () => {
      const diffOutput = `
diff --git a/src/lib/dj/rotation.ts b/src/lib/dj/rotation.ts
--- a/src/lib/dj/rotation.ts
+++ b/src/lib/dj/rotation.ts
@@ -5,2 +5,3 @@
diff --git a/docs/readme.md b/docs/readme.md
--- a/docs/readme.md
+++ b/docs/readme.md
@@ -1,2 +1,4 @@
diff --git a/src/lib/safety/guardrails.ts b/src/lib/safety/guardrails.ts
--- a/src/lib/safety/guardrails.ts
+++ b/src/lib/safety/guardrails.ts
@@ -50,1 +50,2 @@
`;
      const targets = extractHunkLineRanges(diffOutput, { filterMutatable: true });
      expect(targets).toEqual([
        'src/lib/dj/rotation.ts:5-7',
        'src/lib/safety/guardrails.ts:50-51',
      ]);
    });

    it('ignores deleted files (/dev/null)', () => {
      const diffOutput = `
diff --git a/src/lib/old.ts b/dev/null
--- a/src/lib/old.ts
+++ /dev/null
@@ -1,5 +0,0 @@
`;
      const targets = extractHunkLineRanges(diffOutput);
      expect(targets).toEqual([]);
    });
  });

  describe('isCommentOrWhitespaceOnly', () => {
    it('returns true when diff only modifies single line comments', () => {
      const oldCode = `
export function calculateScore(a: number, b: number): number {
  // initial score
  return a + b;
}
`;
      const newCode = `
export function calculateScore(a: number, b: number): number {
  // updated score explanation
  return a + b;
}
`;
      expect(isCommentOrWhitespaceOnly(oldCode, newCode, 'test.ts')).toBe(true);
    });

    it('returns true when diff only modifies block or JSDoc comments', () => {
      const oldCode = `
/**
 * Sums two values
 */
export const sum = (x: number, y: number) => x + y;
`;
      const newCode = `
/*
 * Updated comment block
 * with extra notes
 */
export const sum = (x: number, y: number) => x + y;
`;
      expect(isCommentOrWhitespaceOnly(oldCode, newCode, 'sum.ts')).toBe(true);
    });

    it('returns true when diff only changes formatting or whitespace', () => {
      const oldCode = `export const config = { a: 1, b: 2 };\n`;
      const newCode = `
export const config = {
  a: 1,
  b: 2,
};
`;
      expect(isCommentOrWhitespaceOnly(oldCode, newCode, 'config.ts')).toBe(true);
    });

    it('returns false when actual code logic or variables change', () => {
      const oldCode = `
export function isAllowed(role: string): boolean {
  return role === 'admin';
}
`;
      const newCode = `
export function isAllowed(role: string): boolean {
  return role === 'admin' || role === 'mod';
}
`;
      expect(isCommentOrWhitespaceOnly(oldCode, newCode, 'auth.ts')).toBe(false);
    });

    it('returns false when token length changes between versions', () => {
      const oldCode = `export const x = 1;`;
      const newCode = `export const x = 1; export const y = 2;`;
      expect(isCommentOrWhitespaceOnly(oldCode, newCode, 'test.ts')).toBe(false);
    });

    it('returns true when formatting differences include trailing commas in arrays or calls', () => {
      const oldCode = `const arr = [1, 2]; fn(a, b);`;
      const newCode = `const arr = [\n  1,\n  2,\n];\nfn(\n  a,\n  b,\n);`;
      expect(isCommentOrWhitespaceOnly(oldCode, newCode, 'format.ts')).toBe(true);
    });

    it('returns true for markdown or text files when text is identical after whitespace normalization', () => {
      const oldText = `# Guide\n\nSome documentation.\n`;
      const newText = `# Guide\n\n\nSome documentation.  \n`;
      expect(isCommentOrWhitespaceOnly(oldText, newText, 'README.md')).toBe(true);
    });

    it('returns false for markdown or text files when textual words differ', () => {
      const oldText = `# Guide\n\nInitial documentation.\n`;
      const newText = `# Guide\n\nUpdated documentation.\n`;
      expect(isCommentOrWhitespaceOnly(oldText, newText, 'README.md')).toBe(false);
    });
  });

  describe('filterFunctionalMutatableChanges', () => {
    it('excludes files where code has not changed (comment/whitespace-only)', () => {
      const mockExec = vi.fn().mockImplementation((cmd: string) => {
        if (cmd.includes('git show origin/main:src/lib/dj/rotation.ts')) {
          return 'export const X = 1; // old comment\n';
        }
        if (cmd.includes('git show origin/main:src/lib/safety/guardrails.ts')) {
          return 'export const Y = 1;\n';
        }
        return '';
      });

      const mockReadFile = vi.fn().mockImplementation((filePath: string) => {
        if (filePath.includes('rotation.ts')) {
          return 'export const X = 1; // new comment\n';
        }
        if (filePath.includes('guardrails.ts')) {
          return 'export const Y = 2;\n'; // Real change!
        }
        return '';
      });

      const candidates = [
        'src/lib/dj/rotation.ts',
        'src/lib/safety/guardrails.ts',
      ];

      const functional = filterFunctionalMutatableChanges(candidates, {
        baseRef: 'origin/main',
        execFn: mockExec,
        readFileFn: mockReadFile,
      });

      expect(functional).toEqual(['src/lib/safety/guardrails.ts']);
    });

    it('retains new files that have functional code', () => {
      const mockExec = vi.fn().mockImplementation((cmd: string) => {
        // Base revision does not have the new file -> throws
        throw new Error('fatal: path not found in origin/main');
      });

      const mockReadFile = vi.fn().mockReturnValue('export const NEW_FEATURE = true;\n');

      const functional = filterFunctionalMutatableChanges(['src/lib/dj/new-service.ts'], {
        baseRef: 'origin/main',
        execFn: mockExec,
        readFileFn: mockReadFile,
      });

      expect(functional).toEqual(['src/lib/dj/new-service.ts']);
    });

    it('handles deleted files or unreadable workspace files gracefully', () => {
      const mockExec = vi.fn().mockReturnValue('export const OLD = 1;\n');
      const mockReadFile = vi.fn().mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      const functional = filterFunctionalMutatableChanges(['src/lib/dj/deleted.ts'], {
        baseRef: 'origin/main',
        execFn: mockExec,
        readFileFn: mockReadFile,
      });

      expect(functional).toEqual([]);
    });

    it('falls back to including new file when reading workspace file throws', () => {
      const mockExec = vi.fn().mockImplementation(() => {
        throw new Error('fatal: not in git');
      });
      const mockReadFile = vi.fn().mockImplementation(() => {
        throw new Error('read error');
      });

      const functional = filterFunctionalMutatableChanges(['src/lib/dj/new-broken.ts'], {
        baseRef: 'origin/main',
        execFn: mockExec,
        readFileFn: mockReadFile,
      });

      expect(functional).toEqual(['src/lib/dj/new-broken.ts']);
    });
  });

  describe('findRelatedTestFiles', () => {
    it('includes changed test files directly', () => {
      const changed = ['tests/unit/rotation-state.test.ts'];
      const related = findRelatedTestFiles(changed, {
        availableTestFiles: [
          'tests/unit/rotation-state.test.ts',
          'tests/unit/guardrails.test.ts',
        ],
      });

      expect(related).toEqual(['tests/unit/rotation-state.test.ts']);
    });

    it('maps changed source files to test files importing them via alias or relative path', () => {
      const changed = ['src/lib/flags/feature-flags.ts'];
      const testFileMap: Record<string, string> = {
        'tests/unit/feature-flags.test.ts': `import { getFeatureFlag } from '@/lib/flags/feature-flags';`,
        'tests/integration/mcp-admin.test.ts': `import { flagClient } from '../../src/lib/flags/feature-flags';`,
        'tests/unit/rotation.test.ts': `import { rotate } from '@/lib/dj/rotation';`,
      };

      const mockReadFile = vi.fn().mockImplementation((p: string) => testFileMap[p] || '');

      const related = findRelatedTestFiles(changed, {
        availableTestFiles: Object.keys(testFileMap),
        readFileFn: mockReadFile,
      });

      expect(related).toEqual([
        'tests/integration/mcp-admin.test.ts',
        'tests/unit/feature-flags.test.ts',
      ]);
    });

    it('returns empty array when no test files import the source file', () => {
      const changed = ['src/lib/unknown/isolated.ts'];
      const testFileMap: Record<string, string> = {
        'tests/unit/rotation.test.ts': `import { rotate } from '@/lib/dj/rotation';`,
      };

      const mockReadFile = vi.fn().mockImplementation((p: string) => testFileMap[p] || '');

      const related = findRelatedTestFiles(changed, {
        availableTestFiles: Object.keys(testFileMap),
        readFileFn: mockReadFile,
      });

      expect(related).toEqual([]);
    });

    it('discovers test files by scanning directories on the filesystem when availableTestFiles is omitted', () => {
      const changed = ['src/lib/testing/affected.ts'];
      const related = findRelatedTestFiles(changed, {
        testDirs: ['tests/unit'],
      });

      expect(related).toContain('tests/unit/affected-files.test.ts');
    });

    it('handles non-existent test directories and unreadable test files gracefully', () => {
      const changed = ['src/lib/testing/affected.ts'];
      const empty = findRelatedTestFiles(changed, {
        testDirs: ['tests/non-existent-directory-xyz'],
      });
      expect(empty).toEqual([]);

      const mockReadFile = vi.fn().mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });
      const unreadable = findRelatedTestFiles(changed, {
        availableTestFiles: ['tests/unit/dummy.test.ts'],
        readFileFn: mockReadFile,
      });
      expect(unreadable).toEqual([]);
    });
  });
});
