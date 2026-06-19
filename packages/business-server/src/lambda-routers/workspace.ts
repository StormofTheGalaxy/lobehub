import { WORKSPACE_SYSTEM_ROLES } from '@lobechat/const/rbac';
import type { LobeChatDatabase } from '@lobechat/database';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { WorkspaceModel } from '@/database/models/workspace';
import { WorkspaceMemberModel } from '@/database/models/workspaceMember';
import { assignWorkspaceRoleToUser, seedWorkspaceRoles } from '@/database/utils/seedWorkspaceRoles';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const DEFAULT_WORKSPACE_SLUG = process.env.ACENSUS_DEFAULT_WORKSPACE_SLUG || 'acensus';
const DEFAULT_WORKSPACE_NAME = process.env.ACENSUS_DEFAULT_WORKSPACE_NAME || 'Acensus';

const slugSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must use lowercase letters, numbers and dashes');

const workspaceProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      memberModel: new WorkspaceMemberModel(ctx.serverDB, ctx.userId),
      serverDB: ctx.serverDB,
      userId: ctx.userId,
      workspaceModel: new WorkspaceModel(ctx.serverDB, ctx.userId),
    },
  });
});

const ensureDefaultWorkspaceMembership = async (ctx: {
  memberModel: WorkspaceMemberModel;
  serverDB: LobeChatDatabase;
  userId: string;
  workspaceModel: WorkspaceModel;
}) => {
  const existing = await ctx.workspaceModel.findBySlug(DEFAULT_WORKSPACE_SLUG);

  if (!existing) {
    return ctx.workspaceModel.create({
      description: 'Корпоративное пространство Acensus по умолчанию',
      name: DEFAULT_WORKSPACE_NAME,
      slug: DEFAULT_WORKSPACE_SLUG,
    });
  }

  const member = await ctx.memberModel.getMember(existing.id, ctx.userId);
  if (member) return existing;

  await seedWorkspaceRoles(ctx.serverDB, existing.id);
  await ctx.memberModel.addMember({ role: 'member', userId: ctx.userId, workspaceId: existing.id });
  await assignWorkspaceRoleToUser(ctx.serverDB, {
    roleName: WORKSPACE_SYSTEM_ROLES.MEMBER,
    userId: ctx.userId,
    workspaceId: existing.id,
  });

  return existing;
};

export const workspaceRouter = router({
  create: workspaceProcedure
    .input(
      z.object({
        avatar: z.string().optional(),
        description: z.string().max(1000).optional(),
        name: z.string().min(1).max(255),
        slug: slugSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.workspaceModel.findBySlug(input.slug);
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Workspace slug already exists' });
      }

      return ctx.workspaceModel.create(input);
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.workspaceModel.delete(input.id);
      return { ok: true };
    }),

  ensureMarketOrganization: workspaceProcedure.mutation(
    async (): Promise<{ marketAccountId: number }> => {
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'Workspace market organization is disabled in Acensus self-hosted builds.',
      });
    },
  ),

  getBySlug: workspaceProcedure
    .input(z.object({ slug: slugSchema }))
    .query(async ({ ctx, input }) => {
      return ctx.workspaceModel.findBySlug(input.slug);
    }),

  list: workspaceProcedure.query(async ({ ctx }) => {
    await ensureDefaultWorkspaceMembership(ctx);
    return ctx.workspaceModel.listUserWorkspaces();
  }),

  update: workspaceProcedure
    .input(
      z.object({
        avatar: z.string().optional(),
        description: z.string().max(1000).optional(),
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        slug: slugSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...value } = input;
      await ctx.workspaceModel.update(id, value);
      return { ok: true };
    }),
});
