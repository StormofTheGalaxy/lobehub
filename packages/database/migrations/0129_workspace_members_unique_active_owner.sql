-- Backfill BEFORE the unique index, or this migration aborts on any database
-- that predates single-owner workspaces.
--
-- The fork allowed several active owners per workspace (`promoteToOwner` had no
-- uniqueness guard), so existing deployments carry rows the index below makes
-- unrepresentable, and `CREATE UNIQUE INDEX` fails with 23505 — taking the whole
-- migration transaction, and the container start-up, down with it.
--
-- Keep exactly one active owner per workspace and demote the rest to `admin`,
-- which is what `transferPrimaryOwnership` does to a superseded owner. Priority:
--
--   1. the member named by `workspaces.primary_owner_id` — the authoritative
--      owner, bound to billing and the subscription;
--   2. otherwise the earliest `joined_at`, with `user_id` as a deterministic
--      tie-break so repeated runs pick the same row.
--
-- Demotion, not deletion: an extra owner keeps workspace access, it just loses
-- the money-and-ownership rights that are Owner-only.
WITH ranked AS (
  SELECT
    wm."workspace_id",
    wm."user_id",
    ROW_NUMBER() OVER (
      PARTITION BY wm."workspace_id"
      ORDER BY
        (wm."user_id" = w."primary_owner_id") DESC,
        wm."joined_at" ASC,
        wm."user_id" ASC
    ) AS rn
  FROM "workspace_members" wm
  JOIN "workspaces" w ON w."id" = wm."workspace_id"
  WHERE wm."role" = 'owner' AND wm."deleted_at" IS NULL
)
UPDATE "workspace_members" AS wm
SET "role" = 'admin'
FROM ranked
WHERE ranked."rn" > 1
  AND wm."workspace_id" = ranked."workspace_id"
  AND wm."user_id" = ranked."user_id";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_unique_active_owner_idx" ON "workspace_members" USING btree ("workspace_id") WHERE "workspace_members"."role" = 'owner' AND "workspace_members"."deleted_at" IS NULL;
