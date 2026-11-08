#!/usr/bin/env node
// scripts/apply-sql-migrations.ts
// Automated PostgreSQL / Supabase Schema Migrator CLI.
// Retrieves Supabase / Postgres credentials via Vercel single source of truth.

import * as path from 'path';
import { loadLocalEnvFiles } from '../src/lib/infra/prepare-infra';
import {
  discoverMigrations,
  determinePendingMigrations,
  applyMigrations,
} from '../src/lib/sql/sql-migrator';

export async function runSQLMigrationCLI(args: string[] = process.argv.slice(2)): Promise<number> {
  // Load secrets pulled from Vercel into environment
  loadLocalEnvFiles();

  const isDryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');

  console.log(`\n======================================================================`);
  console.log(`🐘 PromptFM Supabase / PostgreSQL Schema Migration Orchestrator`);
  console.log(`======================================================================\n`);

  console.log(`📂 Migrations Directory: ${migrationsDir}`);
  const migrations = discoverMigrations(migrationsDir);
  console.log(`🔍 Total Migrations Discovered: ${migrations.length}`);

  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isDryRun) {
    console.log(`\nMode: 🔍 DRY RUN (no modifications will be made to database)`);
    const report = await applyMigrations(migrations, { dryRun: true });
    console.log(`\nPending Migrations (${report.pending.length}):`);
    for (const v of report.pending) {
      console.log(`  - ⏳ ${v}`);
    }
    console.log(`\n✅ Dry run completed successfully.\n`);
    return 0;
  }

  if (!dbUrl && (!supabaseUrl || !serviceKey)) {
    console.log(`\n⚠️  Database credentials not found in environment or local files.`);
    console.log(`   Expected one of:`);
    console.log(`   - DATABASE_URL / SUPABASE_DB_URL (direct PostgreSQL connection)`);
    console.log(`   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Vercel secrets)`);
    console.log(`\n💡 To pull production credentials from Vercel:`);
    console.log(`   npx vercel env pull .env.production.local --environment=production --yes\n`);
    return 1;
  }

  // Connect to PostgreSQL if dbUrl is provided
  if (dbUrl) {
    console.log(`\n🔌 Connecting via PostgreSQL connection string...`);
    const { Client } = await import('pg');
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

    try {
      await client.connect();

      // Ensure schema_migrations table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.schema_migrations (
          version TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
          checksum TEXT
        );
      `);

      const { rows } = await client.query(`SELECT version FROM public.schema_migrations`);
      const appliedVersions = rows.map((r: { version: string }) => r.version);

      console.log(`✓ Previously applied migrations: ${appliedVersions.length}`);

      const report = await applyMigrations(migrations, {
        dryRun: false,
        appliedVersions,
        executor: async (m) => {
          console.log(`  ▶ Applying ${m.filename}...`);
          await client.query('BEGIN');
          try {
            await client.query(m.content);
            await client.query(
              `INSERT INTO public.schema_migrations (version, name, checksum) VALUES ($1, $2, $3)
               ON CONFLICT (version) DO UPDATE SET checksum = EXCLUDED.checksum`,
              [m.version, m.filename, m.checksum]
            );
            await client.query('COMMIT');
            console.log(`  ✓ Successfully applied ${m.filename}`);
            return { success: true };
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          }
        },
      });

      await client.end();

      if (report.failed) {
        console.error(`\n❌ Migration failed on ${report.failed.version}: ${report.failed.error}\n`);
        return 1;
      }

      console.log(`\n🎉 Applied ${report.applied.length} new migration(s) successfully!\n`);
      return 0;
    } catch (err: any) {
      console.error(`\n❌ Database connection error: ${err.message}\n`);
      return 1;
    }
  }

  // Fallback notice for Supabase Management / REST API
  console.log(`\nℹ️  Supabase URL configured: ${supabaseUrl}`);
  console.log(`   Direct SQL execution requires direct DATABASE_URL pooler connection.`);
  return 0;
}

if (!process.env.VITEST) {
  runSQLMigrationCLI().then((code) => {
    if (code !== 0) process.exit(code);
  });
}

