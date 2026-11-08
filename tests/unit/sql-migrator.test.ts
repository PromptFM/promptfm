import { describe, it, expect, vi } from 'vitest';
import {
  discoverMigrations,
  determinePendingMigrations,
  applyMigrations,
  MigrationFile,
} from '@/lib/sql/sql-migrator';
import * as path from 'path';

describe('SQL Database Migrator (sql-migrator)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');

  describe('discoverMigrations()', () => {
    it('discovers all migration files in supabase/migrations in chronological order', () => {
      const migrations = discoverMigrations(migrationsDir);
      expect(migrations.length).toBeGreaterThanOrEqual(9);

      // Verify ascending order
      for (let i = 1; i < migrations.length; i++) {
        const curr = migrations[i]?.version || '';
        const prev = migrations[i - 1]?.version || '';
        expect(curr >= prev).toBe(true);
      }

      // Verify each migration contains a version, filename, sha256 checksum, and content
      const first = migrations[0];
      expect(first).toBeDefined();
      if (first) {
        expect(first.version).toBeDefined();
        expect(first.filename).toMatch(/\.sql$/);
        expect(first.checksum).toMatch(/^[a-f0-9]{64}$/);
        expect(first.content.length).toBeGreaterThan(0);
      }
    });

    it('returns empty array when migrations directory does not exist', () => {
      const migrations = discoverMigrations('/path/to/nonexistent/dir');
      expect(migrations).toEqual([]);
    });
  });

  describe('determinePendingMigrations()', () => {
    const mockMigrations: MigrationFile[] = [
      {
        version: '20261101_initial',
        filename: '20261101_initial.sql',
        path: '/mock/20261101_initial.sql',
        checksum: 'abc1',
        content: 'CREATE TABLE t1();',
      },
      {
        version: '20261102_update',
        filename: '20261102_update.sql',
        path: '/mock/20261102_update.sql',
        checksum: 'abc2',
        content: 'ALTER TABLE t1 ADD col1 TEXT;',
      },
      {
        version: '20261103_feature',
        filename: '20261103_feature.sql',
        path: '/mock/20261103_feature.sql',
        checksum: 'abc3',
        content: 'CREATE TABLE t2();',
      },
    ];

    it('returns all migrations if no versions have been applied', () => {
      const pending = determinePendingMigrations(mockMigrations, []);
      expect(pending).toHaveLength(3);
    });

    it('filters out already applied migration versions', () => {
      const applied = ['20261101_initial', '20261102_update'];
      const pending = determinePendingMigrations(mockMigrations, applied);
      expect(pending).toHaveLength(1);
      expect(pending[0]?.version).toBe('20261103_feature');
    });

    it('returns empty array when all migrations are already applied', () => {
      const applied = ['20261101_initial', '20261102_update', '20261103_feature'];
      const pending = determinePendingMigrations(mockMigrations, applied);
      expect(pending).toHaveLength(0);
    });
  });

  describe('applyMigrations()', () => {
    const mockMigrations: MigrationFile[] = [
      {
        version: '20261107_flags',
        filename: '20261107_flags.sql',
        path: '/mock/20261107_flags.sql',
        checksum: 'deadbeef',
        content: 'CREATE TABLE IF NOT EXISTS flags (key TEXT PRIMARY KEY);',
      },
    ];

    it('dryRun mode lists pending migrations without executing SQL statements', async () => {
      const executor = vi.fn().mockResolvedValue({ success: true });
      const report = await applyMigrations(mockMigrations, {
        dryRun: true,
        appliedVersions: [],
        executor,
      });

      expect(report.dryRun).toBe(true);
      expect(report.pending).toHaveLength(1);
      expect(report.applied).toHaveLength(0);
      expect(executor).not.toHaveBeenCalled();
    });

    it('executes pending migrations sequentially with executor and records them', async () => {
      const executor = vi.fn().mockResolvedValue({ success: true });
      const report = await applyMigrations(mockMigrations, {
        dryRun: false,
        appliedVersions: [],
        executor,
      });

      expect(report.dryRun).toBe(false);
      expect(report.applied).toEqual(['20261107_flags']);
      expect(report.failed).toBeUndefined();
      expect(executor).toHaveBeenCalledTimes(1);
      expect(executor).toHaveBeenCalledWith(mockMigrations[0]);
    });

    it('stops execution and returns failure details if a migration fails', async () => {
      const mockMultiple: MigrationFile[] = [
        {
          version: '20261101_bad',
          filename: '20261101_bad.sql',
          path: '/mock/20261101_bad.sql',
          checksum: '1111',
          content: 'MALFORMED SQL;',
        },
        {
          version: '20261102_good',
          filename: '20261102_good.sql',
          path: '/mock/20261102_good.sql',
          checksum: '2222',
          content: 'CREATE TABLE ok();',
        },
      ];

      const executor = vi.fn().mockRejectedValue(new Error('Syntax error at or near MALFORMED'));
      const report = await applyMigrations(mockMultiple, {
        dryRun: false,
        appliedVersions: [],
        executor,
      });

      expect(report.applied).toHaveLength(0);
      expect(report.failed).toBeDefined();
      expect(report.failed?.version).toBe('20261101_bad');
      expect(report.failed?.error).toContain('Syntax error');
      // Second migration should never have been attempted
      expect(executor).toHaveBeenCalledTimes(1);
    });
  });
});
