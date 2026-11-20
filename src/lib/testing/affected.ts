import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

export interface DetectOptions {
  baseRef?: string;
  fallbackRef?: string;
  includeUncommitted?: boolean;
  execFn?: (cmd: string, options?: { encoding: BufferEncoding; stdio?: string }) => string;
  readFileFn?: (filePath: string) => string;
}

export interface FilterConfig {
  include?: RegExp[];
  exclude?: RegExp[];
}

export interface StrykerOptions {
  incremental?: boolean;
  configFile?: string;
  testFiles?: string[];
}

export interface HunkRangeOptions {
  filterMutatable?: boolean;
  filterConfig?: FilterConfig;
}

export interface RelatedOptions {
  availableTestFiles?: string[];
  testDirs?: string[];
  readFileFn?: (filePath: string) => string;
  rootDir?: string;
}

/**
 * Default patterns matching core business logic targeted by mutation tests.
 */
const DEFAULT_MUTATABLE_INCLUDES: RegExp[] = [
  /^src\/lib\/(dj|community|radio|guardrails|legal|safety|streaming|status|ads|auth|chat|email|player|telemetry|ai|testing|ci|flags|mcp|infra|contact|faq|seo)\/.*\.ts$/,
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
 * Extracts non-trivia tokens (excluding comments, whitespace, newlines, optional semicolons, and trailing commas) using TypeScript scanner.
 */
function getNonTriviaTokens(source: string): string[] {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, /* skipTrivia */ false);
  scanner.setText(source);
  const rawTokens: Array<{ kind: ts.SyntaxKind; text: string }> = [];
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token !== ts.SyntaxKind.SingleLineCommentTrivia &&
      token !== ts.SyntaxKind.MultiLineCommentTrivia &&
      token !== ts.SyntaxKind.NewLineTrivia &&
      token !== ts.SyntaxKind.WhitespaceTrivia
    ) {
      rawTokens.push({ kind: token, text: scanner.getTokenText() });
    }
    token = scanner.scan();
  }

  const normalized: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const cur = rawTokens[i];
    if (!cur) continue;
    const next = rawTokens[i + 1];

    // Trailing commas before closing braces/brackets/parentheses are formatting trivia
    if (
      cur.kind === ts.SyntaxKind.CommaToken &&
      next &&
      (next.kind === ts.SyntaxKind.CloseBraceToken ||
        next.kind === ts.SyntaxKind.CloseBracketToken ||
        next.kind === ts.SyntaxKind.CloseParenToken)
    ) {
      continue;
    }

    // Semicolons are optional formatting trivia in JS/TS
    if (cur.kind === ts.SyntaxKind.SemicolonToken) {
      continue;
    }

    normalized.push(cur.text);
  }

  return normalized;
}

/**
 * Checks if differences between old and new file content are comment-, documentation-, or whitespace-only.
 */
export function isCommentOrWhitespaceOnly(
  oldContent: string,
  newContent: string,
  filePath: string
): boolean {
  if (oldContent === newContent) {
    return true;
  }

  const isTsOrJs = /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath);
  if (isTsOrJs) {
    const oldTokens = getNonTriviaTokens(oldContent);
    const newTokens = getNonTriviaTokens(newContent);

    if (oldTokens.length !== newTokens.length) {
      return false;
    }
    for (let i = 0; i < oldTokens.length; i++) {
      if (oldTokens[i] !== newTokens[i]) {
        return false;
      }
    }
    return true;
  }

  // Non-code file (markdown, docs, text, etc.): check if collapsed whitespace matches
  const normOld = oldContent.replace(/\s+/g, ' ').trim();
  const normNew = newContent.replace(/\s+/g, ' ').trim();
  return normOld === normNew;
}

/**
 * Filters out files where changes compared to baseRef are comment- or whitespace-only.
 */
export function filterFunctionalMutatableChanges(
  files: string[],
  options: DetectOptions = {}
): string[] {
  const {
    baseRef = 'origin/main',
    execFn = execSync as (cmd: string, options?: { encoding: BufferEncoding; stdio?: string }) => string,
    readFileFn = (p: string) => fs.readFileSync(p, 'utf-8'),
  } = options;

  return files.filter((file) => {
    let oldContent = '';
    try {
      oldContent = execFn(`git show ${baseRef}:${file}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      }) || '';
    } catch {
      // File may be newly created in this branch/worktree
      try {
        const newContent = readFileFn(file);
        return !isCommentOrWhitespaceOnly('', newContent, file);
      } catch {
        return true;
      }
    }

    try {
      const newContent = readFileFn(file);
      return !isCommentOrWhitespaceOnly(oldContent, newContent, file);
    } catch {
      return false;
    }
  });
}

/**
 * Extracts unified diff hunk line ranges (git diff -U0) into Stryker mutation range targets.
 * Format: "file.ts:start-end"
 */
export function extractHunkLineRanges(
  diffOutput: string,
  options: HunkRangeOptions = {}
): string[] {
  const lines = diffOutput.split('\n');
  const fileRanges = new Map<string, Array<{ start: number; end: number }>>();
  let currentFile: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('+++ ')) {
      const targetPath = trimmed.replace(/^\+\+\+\s+/, '').trim();
      if (targetPath === '/dev/null' || targetPath === 'dev/null') {
        currentFile = null;
      } else {
        currentFile = targetPath.replace(/^[a-b]\//, '');
      }
      continue;
    }

    if (trimmed.startsWith('@@ ') && currentFile) {
      // @@ -startOld[,countOld] +startNew[,countNew] @@
      const match = /^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(trimmed);
      if (match && match[1]) {
        const newStart = parseInt(match[1], 10);
        const newCount = match[2] !== undefined ? parseInt(match[2], 10) : 1;

        if (newCount > 0) {
          const range = {
            start: newStart,
            end: newStart + newCount - 1,
          };
          const existing = fileRanges.get(currentFile) || [];
          existing.push(range);
          fileRanges.set(currentFile, existing);
        }
      }
    }
  }

  const targets: string[] = [];

  for (const [file, ranges] of fileRanges.entries()) {
    if (options.filterMutatable) {
      const mutatable = filterMutatableFiles([file], options.filterConfig);
      if (mutatable.length === 0) {
        continue;
      }
    }

    // Sort ranges and merge overlapping or contiguous ranges
    ranges.sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];

    for (const range of ranges) {
      const last = merged[merged.length - 1];
      if (!last) {
        merged.push({ ...range });
      } else if (range.start <= last.end + 1) {
        last.end = Math.max(last.end, range.end);
      } else {
        merged.push({ ...range });
      }
    }

    for (const m of merged) {
      targets.push(`${file}:${m.start}-${m.end}`);
    }
  }

  return targets;
}

/**
 * Finds test files related to the changed source files or directly changed test files.
 */
export function findRelatedTestFiles(
  changedFiles: string[],
  options: RelatedOptions = {}
): string[] {
  const {
    availableTestFiles,
    testDirs = ['tests'],
    readFileFn = (p: string) => fs.readFileSync(p, 'utf-8'),
    rootDir = process.cwd(),
  } = options;

  const directTestFiles = changedFiles.filter((f) =>
    /\.(test|spec)\.ts$/.test(f)
  );

  const changedSourceFiles = changedFiles.filter(
    (f) => !/\.(test|spec)\.ts$/.test(f) && /\.(ts|tsx|js|jsx)$/.test(f)
  );

  let testFilePool: string[] = [];
  if (availableTestFiles) {
    testFilePool = availableTestFiles;
  } else {
    const discoverTests = (dir: string): string[] => {
      const fullDir = path.isAbsolute(dir) ? dir : path.join(rootDir, dir);
      if (!fs.existsSync(fullDir)) return [];
      const results: string[] = [];
      const list = fs.readdirSync(fullDir, { withFileTypes: true });
      for (const entry of list) {
        const full = path.join(fullDir, entry.name);
        const rel = path.relative(rootDir, full);
        if (entry.isDirectory()) {
          results.push(...discoverTests(full));
        } else if (/\.(test|spec)\.ts$/.test(entry.name)) {
          results.push(rel);
        }
      }
      return results;
    };

    for (const d of testDirs) {
      testFilePool.push(...discoverTests(d));
    }
  }

  const related = new Set<string>(directTestFiles);

  for (const sourceFile of changedSourceFiles) {
    const stem = sourceFile.replace(/^src\//, '').replace(/\.(ts|tsx|js|jsx)$/, '');
    const baseName = path.basename(sourceFile, path.extname(sourceFile));

    for (const testFile of testFilePool) {
      if (related.has(testFile)) continue;

      try {
        const content = readFileFn(testFile);
        if (content.includes(stem) || content.includes(baseName)) {
          related.add(testFile);
        }
      } catch {
        // Skip unreadable test files
      }
    }
  }

  return Array.from(related).sort();
}

/**
 * Constructs the command-line argument list for Stryker.
 */
export function buildStrykerArgs(
  mutatableTargets: string[],
  options: StrykerOptions = {}
): string[] {
  const args = ['run'];

  if (options.configFile) {
    args.push(options.configFile);
  }

  args.push('--mutate', mutatableTargets.join(','));

  if (options.testFiles && options.testFiles.length > 0) {
    args.push('--testFiles', options.testFiles.join(','));
  }

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
