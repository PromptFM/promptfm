// src/lib/sql/sql-linter.ts
// PostgreSQL / Supabase Schema Linter & Safety Validator

import * as fs from 'fs';

export interface SQLLintIssue {
  line: number;
  column?: number;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SQLLintResult {
  file: string;
  valid: boolean;
  issues: SQLLintIssue[];
}

export interface BatchLintResult {
  hasErrors: boolean;
  totalFiles: number;
  errorCount: number;
  warningCount: number;
  results: SQLLintResult[];
}

/**
 * Strips SQL comments and literals to allow safe syntactic inspection of keywords.
 */
function stripComments(sql: string): { cleaned: string; lineOffsets: number[] } {
  const lineOffsets: number[] = [0];
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === '\n') {
      lineOffsets.push(i + 1);
    }
  }

  return { cleaned: sql, lineOffsets };
}

/**
 * Lints an individual SQL string against PostgreSQL / Supabase standards.
 */
export function lintSQL(sqlContent: string, filePath: string = 'inline.sql'): SQLLintResult {
  const issues: SQLLintIssue[] = [];

  let inLineComment = false;
  let inBlockComment = false;
  let inString = false;
  let inDollarQuote = false;
  let dollarTag = '';

  let parenDepth = 0;
  let currentLine = 1;

  const lines = sqlContent.split('\n');

  // Character-by-character scan for quotes, comments, and balanced parens
  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i];
    const nextChar = sqlContent[i + 1] || '';

    if (char === '\n') {
      currentLine++;
      inLineComment = false;
      continue;
    }

    if (inLineComment) continue;

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (char === "'") {
        if (nextChar === "'") {
          // Escaped single quote
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (inDollarQuote) {
      if (char === '$') {
        const remaining = sqlContent.slice(i);
        if (remaining.startsWith(dollarTag)) {
          inDollarQuote = false;
          i += dollarTag.length - 1;
        }
      }
      continue;
    }

    // Comment starts
    if (char === '-' && nextChar === '-') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    // String start
    if (char === "'") {
      inString = true;
      continue;
    }

    // Dollar quote start ($$ or $tag$)
    if (char === '$') {
      const match = sqlContent.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (match) {
        inDollarQuote = true;
        dollarTag = match[0];
        i += dollarTag.length - 1;
        continue;
      }
    }

    // Parentheses tracking
    if (char === '(') {
      parenDepth++;
    } else if (char === ')') {
      parenDepth--;
      if (parenDepth < 0) {
        issues.push({
          line: currentLine,
          rule: 'balanced-parentheses',
          message: 'Unexpected closing parenthesis ")"',
          severity: 'error',
        });
        parenDepth = 0; // reset
      }
    }
  }

  if (inString) {
    issues.push({
      line: currentLine,
      rule: 'balanced-quotes',
      message: 'Unclosed single quote string literal',
      severity: 'error',
    });
  }

  if (inDollarQuote) {
    issues.push({
      line: currentLine,
      rule: 'balanced-dollar-quotes',
      message: `Unclosed dollar quote (${dollarTag}) block`,
      severity: 'error',
    });
  }

  if (parenDepth > 0) {
    issues.push({
      line: currentLine,
      rule: 'balanced-parentheses',
      message: `Unclosed opening parenthesis (depth: ${parenDepth})`,
      severity: 'error',
    });
  }

  // Inspect statements stripped of comments and strings for DDL best practices & dangerous operations
  const sanitized = sqlContent
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\$([a-zA-Z0-9_]*)\$[\s\S]*?\$\1\$/g, "''");

  const sanitizedLines = sanitized.split('\n');
  for (let lIdx = 0; lIdx < sanitizedLines.length; lIdx++) {
    const rawLine = sanitizedLines[lIdx];
    if (!rawLine) continue;
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check for DROP DATABASE
    if (/\bDROP\s+DATABASE\b/i.test(trimmed)) {
      issues.push({
        line: lIdx + 1,
        rule: 'no-unsafe-destruct',
        message: 'DROP DATABASE is strictly forbidden in migrations and schema definitions',
        severity: 'error',
      });
    }

    // Check for naked CREATE TABLE without IF NOT EXISTS
    if (
      /\bCREATE\s+TABLE\b/i.test(trimmed) &&
      !/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i.test(trimmed) &&
      !/\bTEMP\b/i.test(trimmed)
    ) {
      issues.push({
        line: lIdx + 1,
        rule: 'idempotent-ddl',
        message: 'Prefer "CREATE TABLE IF NOT EXISTS" for repeatable, idempotent migrations',
        severity: 'warning',
      });
    }

    // Check for naked CREATE INDEX without IF NOT EXISTS
    if (
      /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(trimmed) &&
      !/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/i.test(trimmed)
    ) {
      issues.push({
        line: lIdx + 1,
        rule: 'idempotent-ddl',
        message: 'Prefer "CREATE INDEX IF NOT EXISTS" for repeatable migrations',
        severity: 'warning',
      });
    }
  }

  // Row Level Security check for Supabase tables
  if (filePath.includes('supabase')) {
    const createTableMatches = [...sanitized.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi)];
    const rlsMatches = [...sanitized.matchAll(/\bALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/gi)];
    const rlsTables = new Set(
      rlsMatches.map((m) => (m[1] || '').toLowerCase()).filter(Boolean)
    );

    for (const match of createTableMatches) {
      const rawName = match[1];
      if (!rawName) continue;
      const tableName = rawName.toLowerCase();
      // Ignore internal tables like schema_migrations
      if (tableName === 'schema_migrations') continue;

      if (!rlsTables.has(tableName)) {
        issues.push({
          line: 1,
          rule: 'require-rls',
          message: `Table "${tableName}" should have ROW LEVEL SECURITY enabled in Supabase public schema: ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`,
          severity: 'warning',
        });
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    file: filePath,
    valid: !hasErrors,
    issues,
  };
}

/**
 * Validates a batch of SQL files on disk.
 */
export function lintSQLFiles(filePaths: string[]): BatchLintResult {
  const results: SQLLintResult[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const result = lintSQL(content, filePath);
    results.push(result);

    for (const issue of result.issues) {
      if (issue.severity === 'error') errorCount++;
      if (issue.severity === 'warning') warningCount++;
    }
  }

  return {
    hasErrors: errorCount > 0,
    totalFiles: filePaths.length,
    errorCount,
    warningCount,
    results,
  };
}
