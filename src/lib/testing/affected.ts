import { execSync } from 'child_process';

export interface DetectOptions {
  baseRef?: string;
  fallbackRef?: string;
  includeUncommitted?: boolean;
  execFn?: (cmd: string, options?: { encoding: BufferEncoding; stdio?: string }) => string;
}

export interface FilterConfig {
  include?: RegExp[];
  exclude?: RegExp[];
}

export interface StrykerOptions {
  incremental?: boolean;
  configFile?: string;
}

/**
 * Default patterns matching core business logic targeted by mutation tests.
 */
const DEFAULT_MUTATABLE_INCLUDES: RegExp[] = [
  /^src\/lib\/(dj|community|radio|guardrails|legal|safety|streaming|status|ads|auth|chat|email|player|telemetry|ai|testing|ci|flags|mcp)\/.*\.ts$/,
];

const DEFAULT_MUTATABLE_EXCLUDES: RegExp[] = [
  /\.d\.ts$/,
  /\.(test|spec)\.ts$/,
];

/**
 * Patterns that indicate UI or end-to-end functionality requiring Playwright tests.
 */
const E2E_TRIGGER_PATTERNS: RegExp[] = [
  /^src\/app\//,
  /^src\/components\//,
  /^src\/lib\//,
  /^public\//,
  /^tests\/e2e\//,
  /^playwright\.config\.(ts|js|mjs)$/,
  /^package(-lock)?\.json$/,
  /^next\.config\.(js|mjs|ts)$/,
];

/**
 * Detects modified and untracked files compared to a base git reference.
 */
export function detectChangedFiles(options: DetectOptions = {}): string[] {
  const {
    baseRef = 'origin/main',
    fallbackRef = 'HEAD~1',
    includeUncommitted = true,
    execFn = execSync as (cmd: string, options?: { encoding: BufferEncoding; stdio?: string }) => string,
  } = options;

  const runSafeCmd = (cmd: string): string => {
    try {
      return execFn(cmd, { encoding: 'utf-8', stdio: 'pipe' }) || '';
    } catch {
      return '';
    }
  };

  const tryGitDiff = (base: string): string[] => {
    const committed = execFn(`git diff --name-only ${base}...HEAD`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    const uncommitted = includeUncommitted ? runSafeCmd('git diff --name-only HEAD') : '';
    const untracked = includeUncommitted ? runSafeCmd('git ls-files --others --exclude-standard') : '';

    const combined = `${committed}\n${uncommitted}\n${untracked}`;
    return Array.from(
      new Set(
        combined
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      )
    );
  };

  try {
    return tryGitDiff(baseRef);
  } catch {
    try {
      return tryGitDiff(fallbackRef);
    } catch {
      return [];
    }
  }
}

/**
 * Filters a list of files down to mutatable domain source code.
 */
export function filterMutatableFiles(
  files: string[],
  config: FilterConfig = {}
): string[] {
  const includes = config.include ?? DEFAULT_MUTATABLE_INCLUDES;
  const excludes = config.exclude ?? DEFAULT_MUTATABLE_EXCLUDES;

  return files.filter((file) => {
    const isIncluded = includes.some((pattern) => pattern.test(file));
    const isExcluded = excludes.some((pattern) => pattern.test(file));
    return isIncluded && !isExcluded;
  });
}

/**
 * Determines whether Stryker mutation testing needs to run.
 */
export function shouldRunMutationTesting(mutatableFiles: string[]): boolean {
  return mutatableFiles.length > 0;
}

/**
 * Constructs the command-line argument list for Stryker.
 */
export function buildStrykerArgs(
  mutatableFiles: string[],
  options: StrykerOptions = {}
): string[] {
  const args = ['run'];

  if (options.configFile) {
    args.push(options.configFile);
  }

  args.push('--mutate', mutatableFiles.join(','));

  if (options.incremental) {
    args.push('--incremental');
  }

  return args;
}

/**
 * Determines whether Playwright E2E tests should be triggered.
 * If changedFiles is empty, returns true as a fail-safe (e.g. initial checkout or branch detection unavailable).
 */
export function shouldRunE2ETests(changedFiles: string[]): boolean {
  if (changedFiles.length === 0) {
    return true;
  }

  return changedFiles.some((file) =>
    E2E_TRIGGER_PATTERNS.some((pattern) => pattern.test(file))
  );
}
