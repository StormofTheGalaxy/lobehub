import { z } from 'zod';

import { WorkspaceMemberModel } from '@/database/models/workspaceMember';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

import { assertWorkspaceAdmin } from './_workspaceControl';

const referralProcedure = authedProcedure.use(serverDatabase);

export const referralRouter = router({
  createWorkspaceInvite: referralProcedure
    .input(z.object({ email: z.string().email().optional(), workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceAdmin(ctx, input.workspaceId);
      return new WorkspaceMemberModel(ctx.serverDB, ctx.userId).createInvitation({
        email: input.email,
        role: 'member',
        workspaceId: input.workspaceId,
      });
    }),
});
