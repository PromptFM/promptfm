import { describe, it, expect } from 'vitest';
import { lintSQL, lintSQLFiles } from '@/lib/sql/sql-linter';
import * as fs from 'fs';
import * as path from 'path';

describe('SQL Database Linter (sql-linter)', () => {
  describe('lintSQL() syntax and safety checks', () => {
    it('passes for clean, valid PostgreSQL DDL with IF NOT EXISTS and semicolons', () => {
      const sql = `
        CREATE TABLE IF NOT EXISTS public.channels (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          slug TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_channels_slug ON public.channels(slug);

        ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
      `;

      const result = lintSQL(sql, 'test_channels.sql');
      expect(result.valid).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('detects unbalanced parentheses as a syntax error', () => {
      const sql = `
        CREATE TABLE IF NOT EXISTS broken_table (
          id UUID PRIMARY KEY,
          title TEXT NOT NULL
        ;
      `;

      const result = lintSQL(sql, 'broken_parens.sql');
      expect(result.valid).toBe(false);
      const parenError = result.issues.find((i) => i.rule === 'balanced-parentheses');
      expect(parenError).toBeDefined();
      expect(parenError?.severity).toBe('error');
    });

    it('detects unclosed single quotes', () => {
      const sql = `
        INSERT INTO feature_flags (key, name) VALUES ('maintenance_mode, 'Station Maintenance');
      `;

      const result = lintSQL(sql, 'broken_quote.sql');
      expect(result.valid).toBe(false);
      const quoteError = result.issues.find((i) => i.rule === 'balanced-quotes');
      expect(quoteError).toBeDefined();
      expect(quoteError?.severity).toBe('error');
    });

    it('detects unclosed dollar quotes ($$)', () => {
      const sql = `
        CREATE OR REPLACE FUNCTION update_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
      `;

      const result = lintSQL(sql, 'broken_dollar.sql');
      expect(result.valid).toBe(false);
      const dollarError = result.issues.find((i) => i.rule === 'balanced-dollar-quotes');
      expect(dollarError).toBeDefined();
      expect(dollarError?.severity).toBe('error');
    });

    it('flags dangerous DROP DATABASE operations', () => {
      const sql = `
        DROP DATABASE postgres;
      `;

      const result = lintSQL(sql, 'danger.sql');
      expect(result.valid).toBe(false);
      const dangerError = result.issues.find((i) => i.rule === 'no-unsafe-destruct');
      expect(dangerError).toBeDefined();
      expect(dangerError?.severity).toBe('error');
    });

    it('warns when CREATE TABLE lacks IF NOT EXISTS', () => {
      const sql = `
        CREATE TABLE new_metrics (
          id SERIAL PRIMARY KEY,
          metric_value NUMERIC NOT NULL
        );
      `;

      const result = lintSQL(sql, 'missing_if_not_exists.sql');
      const warning = result.issues.find((i) => i.rule === 'idempotent-ddl');
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe('warning');
      expect(warning?.message).toContain('IF NOT EXISTS');
    });

    it('warns when CREATE INDEX lacks IF NOT EXISTS', () => {
      const sql = `
        CREATE INDEX idx_metrics_val ON new_metrics(metric_value);
      `;

      const result = lintSQL(sql, 'missing_index_if_not_exists.sql');
      const warning = result.issues.find((i) => i.rule === 'idempotent-ddl');
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe('warning');
    });

    it('warns when CREATE TABLE in supabase lacks Row Level Security (RLS)', () => {
      const sql = `
        CREATE TABLE IF NOT EXISTS public.secret_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          secret_key TEXT NOT NULL
        );
      `;

      const result = lintSQL(sql, 'supabase/migrations/test_rls.sql');
      const rlsWarning = result.issues.find((i) => i.rule === 'require-rls');
      expect(rlsWarning).toBeDefined();
      expect(rlsWarning?.severity).toBe('warning');
      expect(rlsWarning?.message).toContain('ROW LEVEL SECURITY');
    });

    it('does not warn about RLS when ENABLE ROW LEVEL SECURITY is present', () => {
      const sql = `
        CREATE TABLE IF NOT EXISTS public.secret_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          secret_key TEXT NOT NULL
        );

        ALTER TABLE public.secret_data ENABLE ROW LEVEL SECURITY;
      `;

      const result = lintSQL(sql, 'supabase/migrations/test_rls_ok.sql');
      const rlsWarning = result.issues.find((i) => i.rule === 'require-rls');
      expect(rlsWarning).toBeUndefined();
    });

    it('correctly ignores comments (-- and /* */) when validating statements', () => {
      const sql = `
        -- This is a comment with unbalanced (parens and 'quotes
        /* Multi-line comment
           DROP DATABASE evil;
           (still commented)
        */
        CREATE TABLE IF NOT EXISTS clean_table (
          id INT PRIMARY KEY
        );
      `;

      const result = lintSQL(sql, 'commented.sql');
      expect(result.valid).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });
  });

  describe('lintSQLFiles() batch validation', () => {
    it('successfully lints existing migrations in supabase/migrations', () => {
      const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
      if (fs.existsSync(migrationsDir)) {
        const files = fs
          .readdirSync(migrationsDir)
          .filter((f) => f.endsWith('.sql'))
          .map((f) => path.join(migrationsDir, f));

        const batch = lintSQLFiles(files);
        expect(batch.hasErrors).toBe(false);
      }
    });
  });
});
