// src/lib/sql/sql-migrator.ts
// PostgreSQL / Supabase Migration Runner & Version Orchestrator

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface MigrationFile {
  version: string;
  filename: string;
  path: string;
  checksum: string;
  content: string;
}

export interface ApplyMigrationOptions {
  dryRun?: boolean;
  appliedVersions?: string[];
  executor?: (migration: MigrationFile) => Promise<{ success: boolean }>;
}

export interface MigrationReport {
  dryRun: boolean;
  total: number;
  pending: string[];
  applied: string[];
  failed?: {
    version: string;
    error: string;
  };
}

/**
 * Calculates SHA256 checksum of a file string.
 */
export function calculateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Scans a migrations directory and returns all SQL migration files sorted chronologically.
 */
export function discoverMigrations(migrationsDir: string): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.map((filename) => {
    const fullPath = path.join(migrationsDir, filename);
    const content = fs.readFileSync(fullPath, 'utf8');
    const version = filename.replace(/\.sql$/, '');
    const checksum = calculateChecksum(content);

    return {
      version,
      filename,
      path: fullPath,
      checksum,
      content,
    };
  });
}

/**
 * Filters all migrations to find those that have not yet been applied.
 */
export function determinePendingMigrations(
  allMigrations: MigrationFile[],
  appliedVersions: string[]
): MigrationFile[] {
  const appliedSet = new Set(appliedVersions);
  return allMigrations.filter((m) => !appliedSet.has(m.version));
}

/**
 * Applies pending migrations in sequential order.
 */
export function applyMigrations(
  migrations: MigrationFile[],
  options: ApplyMigrationOptions = {}
): Promise<MigrationReport> {
  const dryRun = options.dryRun ?? false;
  const appliedSet = new Set(options.appliedVersions || []);
  const pending = migrations.filter((m) => !appliedSet.has(m.version));

  if (dryRun) {
    return Promise.resolve({
      dryRun: true,
      total: migrations.length,
      pending: pending.map((m) => m.version),
      applied: [],
    });
  }

  const applied: string[] = [];
  const executor = options.executor;

  const processSequentially = async (): Promise<MigrationReport> => {
    for (const migration of pending) {
      try {
        if (executor) {
          await executor(migration);
        }
        applied.push(migration.version);
      } catch (err: any) {
        return {
          dryRun: false,
          total: migrations.length,
          pending: pending.map((m) => m.version),
          applied,
          failed: {
            version: migration.version,
            error: err.message || String(err),
          },
        };
      }
    }

    return {
      dryRun: false,
      total: migrations.length,
      pending: pending.map((m) => m.version),
      applied,
    };
  };

  return processSequentially();
}

