// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
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

/**
 * Verifies the hand-written rollback script actually returns the schema to the
 * v0.1.12 shape, rather than merely running without error.
 *
 * Builds two databases from the same migration folder — one stopped at the tag,
 * one fully migrated and then rolled back — and diffs their catalogs.
 */
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

      // PGlite has no pg_search, so those statements cannot run here — but the
      // journal row still goes in. The rollback script asserts a production row
      // count, and skipping the row too would make this environment disagree
      // with the real database by two.
      const usesFullTextSearch = migration.sql.some(
        (s) => s.toLowerCase().includes('pg_search') || s.toLowerCase().includes('bm25'),
      );
      if (!usesFullTextSearch) {
        for (const stmt of migration.sql) await db.execute(sql.raw(stmt));
      }

      await db.execute(
        sql`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES (${migration.hash}, ${migration.folderMillis})`,
      );
    }

    return db;
  };

  const catalog = async (db: Awaited<ReturnType<typeof build>>) => {
    const rows = async (q: any) => (await db.execute(q)).rows as Record<string, string>[];

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
      columns: columns.map((r) => r.c!),
      indexes: indexes.map((r) => r.indexname!),
      tables: tables.map((r) => r.tablename!),
    };
  };

  beforeAll(async () => {
    const tagDb = await build(true);
    expected = await catalog(tagDb);

    const fullDb = await build(false);
    // Run the file in one shot, the way `psql -f` does — splitting on `;`
    // would cut the DO $$ … $$ guard block in half.
    await (fullDb as unknown as { $client: PGlite }).$client.exec(
      readFileSync(rollbackScript, 'utf8'),
    );
    actual = await catalog(fullDb);

    const left = await fullDb.execute(sql`SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"`);
    remainingMigrations = (left.rows[0] as { n: number }).n;
  }, 180_000);

  it('leaves no table the tag did not have', () => {
    expect(actual.tables.filter((t) => !expected.tables.includes(t))).toEqual([]);
  });

  it('drops no table the tag did have', () => {
    expect(expected.tables.filter((t) => !actual.tables.includes(t))).toEqual([]);
  });

  it('restores the exact column set', () => {
    expect(actual.columns.filter((c) => !expected.columns.includes(c))).toEqual([]);
    expect(expected.columns.filter((c) => !actual.columns.includes(c))).toEqual([]);
  });

  it('restores the exact index set', () => {
    expect(actual.indexes.filter((i) => !expected.indexes.includes(i))).toEqual([]);
    expect(expected.indexes.filter((i) => !actual.indexes.includes(i))).toEqual([]);
  });

  it('rewinds the drizzle journal so the old app re-applies nothing', () => {
    expect(remainingMigrations).toBe(115);
  });
});
