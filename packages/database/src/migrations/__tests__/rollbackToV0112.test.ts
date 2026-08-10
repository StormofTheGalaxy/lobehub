// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import * as schema from '../../schemas';

const migrationsFolder = join(__dirname, '../../../migrations');
const rollbackScript = join(__dirname, '../rollback/rollback_to_v0.1.12.sql');

/** Last migration present at tag v0.1.12 (`0114_add_verify_run_scenario_context`). */
const TAG_CUTOFF_MILLIS = 1_782_009_459_420;

describe('rollback to v0.1.12', () => {
  let expected: { columns: string[]; indexes: string[]; tables: string[] };
  let actual: { columns: string[]; indexes: string[]; tables: string[] };
  let remainingMigrations: number;

  const build = async (stopAtTag: boolean) => {
    const client = new PGlite({ extensions: { vector } });
    const db = drizzle({ client, schema });
    (db as unknown as { $client: PGlite }).$client = client;
    const migrations = readMigrationFiles({ migrationsFolder });

    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
      )
    `);

    for (const migration of migrations) {
      if (stopAtTag && migration.folderMillis > TAG_CUTOFF_MILLIS) continue;

      // PGlite has no pg_search, so skip those statements but retain their
      // journal rows to match production and exercise the rollback guard.
      const usesFullTextSearch = migration.sql.some(
        (statement) =>
          statement.toLowerCase().includes('pg_search') || statement.toLowerCase().includes('bm25'),
      );
      if (!usesFullTextSearch) {
        for (const statement of migration.sql) await db.execute(sql.raw(statement));
      }

      await db.execute(
        sql`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES (${migration.hash}, ${migration.folderMillis})`,
      );
    }

    return db;
  };

  const catalog = async (db: Awaited<ReturnType<typeof build>>) => {
    const rows = async (query: SQL) => (await db.execute(query)).rows as Record<string, string>[];

    const tables = await rows(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const columns = await rows(
      sql`SELECT table_name || '.' || column_name AS c FROM information_schema.columns
          WHERE table_schema = 'public' ORDER BY 1`,
    );
    const indexes = await rows(
      sql`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`,
    );

    return {
      columns: columns.map((row) => row.c!),
      indexes: indexes.map((row) => row.indexname!),
      tables: tables.map((row) => row.tablename!),
    };
  };

  beforeAll(async () => {
    const tagDatabase = await build(true);
    expected = await catalog(tagDatabase);

    const fullDatabase = await build(false);
    await (fullDatabase as unknown as { $client: PGlite }).$client.exec(
      readFileSync(rollbackScript, 'utf8'),
    );
    actual = await catalog(fullDatabase);

    const left = await fullDatabase.execute(
      sql`SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"`,
    );
    remainingMigrations = (left.rows[0] as { n: number }).n;
  }, 180_000);

  it('leaves no table the tag did not have', () => {
    expect(actual.tables.filter((table) => !expected.tables.includes(table))).toEqual([]);
  });

  it('drops no table the tag did have', () => {
    expect(expected.tables.filter((table) => !actual.tables.includes(table))).toEqual([]);
  });

  it('restores the exact column set', () => {
    expect(actual.columns.filter((column) => !expected.columns.includes(column))).toEqual([]);
    expect(expected.columns.filter((column) => !actual.columns.includes(column))).toEqual([]);
  });

  it('restores the exact index set', () => {
    expect(actual.indexes.filter((index) => !expected.indexes.includes(index))).toEqual([]);
    expect(expected.indexes.filter((index) => !actual.indexes.includes(index))).toEqual([]);
  });

  it('rewinds the drizzle journal so the old app re-applies nothing', () => {
    expect(remainingMigrations).toBe(115);
  });
});
