import { describe, it, expect, vi } from 'vitest';
import {
  detectChangedFiles,
  filterMutatableFiles,
  shouldRunMutationTesting,
  buildStrykerArgs,
  shouldRunE2ETests,
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
});
