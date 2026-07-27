import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import { WorkspaceAuditLogModel } from '@/database/models/workspaceAuditLog';
import { WorkspaceMemberModel } from '@/database/models/workspaceMember';
import { users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

import { isSuperAdmin } from '../enterprise/superAdmin';

const auditProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      workspaceAuditLogModel: new WorkspaceAuditLogModel(ctx.serverDB),
      workspaceMemberModel: new WorkspaceMemberModel(ctx.serverDB, ctx.userId),
    },
  });
});

/** Audit reading is `WORKSPACE_AUDIT_READ` — Admin and Owner, plus super-admins. */
const assertCanReadAudit = async (
  ctx: {
    serverDB: LobeChatDatabase;
    userId: string;
    workspaceMemberModel: WorkspaceMemberModel;
  },
  workspaceId: string,
) => {
  const membership = await ctx.workspaceMemberModel.getMember(workspaceId, ctx.userId);
  if (membership?.role === 'owner' || membership?.role === 'admin') return;

  if (await isSuperAdmin(ctx.serverDB, ctx.userId)) return;

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Требуется роль администратора или владельца workspace',
  });
};

export const workspaceAuditLogRouter = router({
  list: auditProcedure
    .input(
      z.object({
        action: z.string().optional(),
        cursor: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        limit: z.number().min(1).max(100).optional(),
        q: z.string().optional(),
        resourceType: z.string().optional(),
        startDate: z.coerce.date().optional(),
        workspaceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertCanReadAudit(ctx, input.workspaceId);

      // A free-text query should also match the actor, so resolve the ids of
      // users whose name or e-mail contains the keyword and pass them along —
      // the model ORs them into the search.
      const keyword = input.q?.trim();
      let userIds: string[] | undefined;
      if (keyword) {
        const matches = await ctx.serverDB.query.users.findMany({
          columns: { id: true },
          where: (table, { ilike, or }) =>
            or(
              ilike(table.email, `%${keyword}%`),
              ilike(table.fullName, `%${keyword}%`),
              ilike(table.username, `%${keyword}%`),
            ),
        });
        userIds = matches.map((row) => row.id);
      }

      const { items, nextCursor } = await ctx.workspaceAuditLogModel.list({
        ...input,
        action: input.action as never,
        userIds,
      });

      // Resolve actor labels in one round-trip so the page can render "who"
      // without a request per row.
      const actorIds = items
        .map((item) => item.userId)
        .filter((userId): userId is string => !!userId);
      const uniqueActorIds = [...new Set(actorIds)];
      const actors = uniqueActorIds.length
        ? await ctx.serverDB.query.users.findMany({
            columns: { email: true, fullName: true, id: true, username: true },
            where: inArray(users.id, uniqueActorIds),
          })
        : [];
      const actorById = new Map(actors.map((actor) => [actor.id, actor]));

      return {
        items: items.map((item) => {
          const actor = item.userId ? actorById.get(item.userId) : undefined;

          return {
            ...item,
            actorLabel: actor?.fullName || actor?.username || actor?.email || item.userId,
          };
        }),
        nextCursor,
      };
    }),

  /**
   * Distinct actions present in this workspace's recent log, so the filter
   * offers only values that can actually return rows.
   */
  listActions: auditProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanReadAudit(ctx, input.workspaceId);

      const { items } = await ctx.workspaceAuditLogModel.list({
        limit: 100,
        workspaceId: input.workspaceId,
      });

      return [...new Set(items.map((item) => item.action))].sort();
    }),
});
