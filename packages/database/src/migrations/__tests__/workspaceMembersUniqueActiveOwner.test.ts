// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/pglite';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import * as schema from '../../schemas';

const migrationsFolder = join(__dirname, '../../../migrations');

const OWNER_INDEX = 'workspace_members_unique_active_owner_idx';

/**
 * Guards the backfill in `0129_workspace_members_unique_active_owner.sql`.
 *
 * The fork allowed several active owners per workspace, so the unique partial
 * index that migration adds fails with 23505 on any pre-existing database —
 * which aborts the migration transaction and crash-loops the container on
 * start-up. Without the backfill this whole suite throws at `applyMigration`.
 */
describe('migration 0129: unique active workspace owner', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let ownerMigration: { sql: string[] };

  const applyStatements = async (statements: string[]) => {
    for (const stmt of statements) await db.execute(sql.raw(stmt));
  };

  beforeAll(async () => {
    const pglite = new PGlite({ extensions: { vector } });
    db = drizzle({ client: pglite, schema });

    const migrations = readMigrationFiles({ migrationsFolder });
    const ownerIndex = migrations.findIndex((m) =>
      m.sql.some((s) => s.includes(OWNER_INDEX)),
    );

    expect(ownerIndex).toBeGreaterThan(-1);
    ownerMigration = migrations[ownerIndex]!;

    // Everything up to — but not including — the owner-index migration, so the
    // seed below can create the multi-owner state that migration must repair.
    for (const migration of migrations.slice(0, ownerIndex)) {
      const usesFullTextSearch = migration.sql.some(
        (s) => s.toLowerCase().includes('pg_search') || s.toLowerCase().includes('bm25'),
      );
      if (usesFullTextSearch) continue;

      await applyStatements(migration.sql);
    }
  });

  it('keeps the primary owner and demotes the extra active owners', async () => {
    await db.execute(sql`
      INSERT INTO "users" ("id") VALUES ('u-early'), ('u-primary'), ('u-late'), ('u-removed')
    `);
    // `primary_owner_id` deliberately is NOT the earliest-joined owner, so the
    // assertion below distinguishes the two tie-break rules.
    await db.execute(sql`
      INSERT INTO "workspaces" ("id", "slug", "name", "primary_owner_id")
      VALUES ('ws-multi', 'ws-multi', 'Multi', 'u-primary')
    `);
    await db.execute(sql`
      INSERT INTO "workspace_members" ("workspace_id", "user_id", "role", "joined_at", "deleted_at")
      VALUES
        ('ws-multi', 'u-early',   'owner',  '2020-01-01T00:00:00Z', NULL),
        ('ws-multi', 'u-primary', 'owner',  '2021-01-01T00:00:00Z', NULL),
        ('ws-multi', 'u-late',    'owner',  '2022-01-01T00:00:00Z', NULL),
        ('ws-multi', 'u-removed', 'owner',  '2019-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
    `);

    // Throws 23505 without the backfill.
    await applyStatements(ownerMigration.sql);

    const rows = await db.execute(sql`
      SELECT "user_id", "role" FROM "workspace_members"
      WHERE "workspace_id" = 'ws-multi' AND "deleted_at" IS NULL
      ORDER BY "user_id"
    `);
    const byUser = Object.fromEntries(
      (rows.rows as { role: string; user_id: string }[]).map((r) => [r.user_id, r.role]),
    );

    // `primary_owner_id` wins over the earlier `joined_at`.
    expect(byUser).toEqual({ 'u-early': 'admin', 'u-late': 'admin', 'u-primary': 'owner' });

    // Demoted, not removed — they keep workspace access.
    expect(Object.keys(byUser)).toHaveLength(3);
  });

  it('leaves a soft-deleted owner row untouched', async () => {
    const rows = await db.execute(sql`
      SELECT "role" FROM "workspace_members"
      WHERE "workspace_id" = 'ws-multi' AND "user_id" = 'u-removed'
    `);

    // Excluded by the index predicate, so the backfill must not touch it.
    expect((rows.rows as { role: string }[])[0]?.role).toBe('owner');
  });

  it('enforces a single active owner from now on', async () => {
    await db.execute(sql`INSERT INTO "users" ("id") VALUES ('u-second')`);
    await db.execute(sql`
      INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
      VALUES ('ws-multi', 'u-second', 'member')
    `);

    await expect(
      db.execute(sql`
        UPDATE "workspace_members" SET "role" = 'owner'
        WHERE "workspace_id" = 'ws-multi' AND "user_id" = 'u-second'
      `),
    ).rejects.toThrow();
  });
});
