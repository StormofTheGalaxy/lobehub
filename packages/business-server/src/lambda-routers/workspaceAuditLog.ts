import { z } from 'zod';

import { WorkspaceAuditLogModel } from '@/database/models/workspaceAuditLog';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const workspaceAuditProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      auditModel: new WorkspaceAuditLogModel(ctx.serverDB),
    },
  });
});

export const workspaceAuditLogRouter = router({
  list: workspaceAuditProcedure
    .input(
      z.object({
        action: z.string().optional(),
        cursor: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        limit: z.number().min(1).max(100).optional(),
        startDate: z.string().datetime().optional(),
        workspaceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) =>
      ctx.auditModel.list({
        ...input,
        action: input.action as any,
        cursor: input.cursor ? new Date(input.cursor) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
      }),
    ),
});
