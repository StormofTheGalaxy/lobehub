import { WORKSPACE_SYSTEM_ROLES } from '@lobechat/const/rbac';
import { z } from 'zod';

import { RbacModel } from '@/database/models/rbac';
import { WorkspaceMemberModel } from '@/database/models/workspaceMember';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const roleSchema = z.enum(['owner', 'member', 'viewer']);

const roleNameByMemberRole = {
  member: WORKSPACE_SYSTEM_ROLES.MEMBER,
  owner: WORKSPACE_SYSTEM_ROLES.OWNER,
  viewer: WORKSPACE_SYSTEM_ROLES.VIEWER,
} as const;

const workspaceMemberProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      memberModel: new WorkspaceMemberModel(ctx.serverDB, ctx.userId),
      rbacModel: new RbacModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const workspaceMemberRouter = router({
  add: workspaceMemberProcedure
    .input(
      z.object({ role: roleSchema.default('member'), userId: z.string(), workspaceId: z.string() }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.memberModel.addMember(input);
      await ctx.rbacModel.assignWorkspaceRole({
        roleName: roleNameByMemberRole[input.role],
        userId: input.userId,
        workspaceId: input.workspaceId,
      });
      return member;
    }),

  createInvitation: workspaceMemberProcedure
    .input(
      z.object({
        email: z.string().email().optional(),
        role: roleSchema.default('member'),
        workspaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => ctx.memberModel.createInvitation(input)),

  list: workspaceMemberProcedure
    .input(z.object({ includeDeleted: z.boolean().optional(), workspaceId: z.string() }))
    .query(async ({ ctx, input }) =>
      ctx.memberModel.listMembers(input.workspaceId, { includeDeleted: input.includeDeleted }),
    ),

  listPendingInvitations: workspaceMemberProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => ctx.memberModel.listPendingInvitations(input.workspaceId)),

  remove: workspaceMemberProcedure
    .input(z.object({ userId: z.string(), workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.memberModel.removeMember(input.workspaceId, input.userId);
      await ctx.rbacModel.revokeWorkspaceRole(input);
      return { ok: true };
    }),

  updateRole: workspaceMemberProcedure
    .input(z.object({ role: roleSchema, userId: z.string(), workspaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.memberModel.updateMemberRole(input.workspaceId, input.userId, input.role);
      await ctx.rbacModel.revokeWorkspaceRole(input);
      await ctx.rbacModel.assignWorkspaceRole({
        roleName: roleNameByMemberRole[input.role],
        userId: input.userId,
        workspaceId: input.workspaceId,
      });
      return { ok: true };
    }),
});
