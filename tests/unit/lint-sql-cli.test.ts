import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSQLLinter } from '../../scripts/lint-sql';
import * as path from 'path';

describe('SQL Linter CLI (scripts/lint-sql.ts)', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 0 when linting all repository SQL files', () => {
    const exitCode = runSQLLinter([]);
    expect(exitCode).toBe(0);
  });

  it('returns 0 when given explicit clean SQL files', () => {
    const validFile = path.resolve(process.cwd(), 'supabase/schema.sql');
    const exitCode = runSQLLinter([validFile]);
    expect(exitCode).toBe(0);
  });

  it('returns 0 when no SQL files are matched', () => {
    const exitCode = runSQLLinter(['nonexistent.sql']);
    expect(exitCode).toBe(0);
  });
});

