import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { withScopedPermission } from '@/business/server/trpc-middlewares/rbacPermission';
import { wsCompatProcedure } from '@/business/server/trpc-middlewares/workspaceAuth';
import { AgentModel } from '@/database/models/agent';
import { AgentPresetModel } from '@/database/models/agentPreset';
import { UserModel } from '@/database/models/user';
import { WorkspaceAuditLogModel } from '@/database/models/workspaceAuditLog';
import { router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

import { maybeGrantSuperAdmin } from '../../services/rbac/superAdmin';

const agentPresetProcedure = wsCompatProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const wsId = ctx.workspaceId ?? undefined;

  // Acensus: ленивая backfill-выдача super_admin для allowlist-email.
  // Срабатывает максимум один раз — последующие вставки no-op (onConflictDoNothing).
  try {
    const user = await UserModel.findById(ctx.serverDB, ctx.userId);
    await maybeGrantSuperAdmin(ctx.serverDB, {
      email: user?.email,
      userId: ctx.userId,
    });
  } catch (error) {
    console.error('[acensus:agentPreset] super-admin backfill failed', error);
  }

  return opts.next({
    ctx: {
      agentModel: new AgentModel(ctx.serverDB, ctx.userId, wsId),
      agentPresetModel: new AgentPresetModel(ctx.serverDB, wsId),
      auditModel: new WorkspaceAuditLogModel(ctx.serverDB),
      userId: ctx.userId,
      workspaceId: wsId,
    },
  });
});

const createPresetAuditLog = async (
  ctx: {
    auditModel: WorkspaceAuditLogModel;
    userId: string;
    workspaceId?: string;
  },
  params: { action: string; metadata?: Record<string, unknown>; presetId?: string },
) => {
  if (!ctx.workspaceId) return;

  await ctx.auditModel.create({
    action: params.action as any,
    metadata: params.metadata,
    resourceId: params.presetId,
    resourceType: 'agent_preset',
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
  });
};

const presetConfigSchema = z
  .object({
    avatar: z.string().optional(),
    backgroundColor: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    model: z.string().optional(),
    openingMessage: z.string().optional(),
    openingQuestions: z.array(z.string()).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    plugins: z.array(z.string()).optional(),
    provider: z.string().optional(),
    systemRole: z.string().optional(),
    tags: z.array(z.string()).optional(),
    title: z.string().optional(),
  })
  .passthrough();

const upsertInputSchema = z.object({
  avatar: z.string().nullish(),
  backgroundColor: z.string().nullish(),
  category: z.string().nullish(),
  config: presetConfigSchema,
  description: z.string().max(1000).nullish(),
  editorData: z.unknown().optional(),
  featured: z.boolean().optional(),
  identifier: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[\w-]+$/, 'Identifier must be alphanumeric, dash or underscore'),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
  title: z.string().min(1).max(255),
});

export const agentPresetRouter = router({
  /** Admin: создать пресет (черновик/опубликованный). */
  adminCreate: agentPresetProcedure
    .use(withScopedPermission('agent_preset:manage'))
    .input(upsertInputSchema)
    .mutation(async ({ input, ctx }) => {
      const created = await ctx.agentPresetModel.create({
        ...input,
        config: input.config,
        createdBy: ctx.userId,
      });
      await createPresetAuditLog(ctx, {
        action: 'agent_preset.created',
        metadata: { identifier: input.identifier, title: input.title },
        presetId: created.id,
      });
      return { id: created.id };
    }),

  /** Admin: удалить пресет. */
  adminDelete: agentPresetProcedure
    .use(withScopedPermission('agent_preset:manage'))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const ok = await ctx.agentPresetModel.delete(input.id);
      if (!ok) throw new TRPCError({ code: 'NOT_FOUND', message: 'Preset not found' });
      await createPresetAuditLog(ctx, { action: 'agent_preset.deleted', presetId: input.id });
      return { ok: true };
    }),

  /** Admin: получить пресет (любой статус). */
  adminDetail: agentPresetProcedure
    .use(withScopedPermission('agent_preset:manage'))
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const preset = await ctx.agentPresetModel.getAdminDetail(input.id);
      if (!preset) throw new TRPCError({ code: 'NOT_FOUND', message: 'Preset not found' });
      return preset;
    }),

  /** Admin: список всех пресетов (включая drafts/archived). */
  adminList: agentPresetProcedure
    .use(withScopedPermission('agent_preset:manage'))
    .query(async ({ ctx }) => ctx.agentPresetModel.listAll()),

  /** Admin: смена статуса (publish / archive / draft). */
  adminSetStatus: agentPresetProcedure
    .use(withScopedPermission('agent_preset:manage'))
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['draft', 'published', 'archived']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updated = await ctx.agentPresetModel.update(input.id, {
        status: input.status,
        updatedBy: ctx.userId,
      });
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Preset not found' });
      await createPresetAuditLog(ctx, {
        action: 'agent_preset.status_updated',
        metadata: { status: input.status },
        presetId: input.id,
      });
      return { id: updated.id, status: updated.status };
    }),

  /** Admin: обновить пресет. */
  adminUpdate: agentPresetProcedure
    .use(withScopedPermission('agent_preset:manage'))
    .input(z.object({ id: z.string(), patch: upsertInputSchema.partial() }))
    .mutation(async ({ input, ctx }) => {
      const updated = await ctx.agentPresetModel.update(input.id, {
        ...input.patch,
        updatedBy: ctx.userId,
      });
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Preset not found' });
      await createPresetAuditLog(ctx, { action: 'agent_preset.updated', presetId: input.id });
      return { id: updated.id };
    }),

  detail: agentPresetProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const preset = await ctx.agentPresetModel.getDetail(input.id);

    if (!preset) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent preset not found' });
    }

    return preset;
  }),

  install: agentPresetProcedure
    .use(withScopedPermission('agent:create'))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const preset = await ctx.agentPresetModel.getDetail(input.id);

      if (!preset) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent preset not found' });
      }

      const config = {
        ...preset.config,
        avatar: preset.config.avatar ?? preset.avatar ?? undefined,
        backgroundColor: preset.config.backgroundColor ?? preset.backgroundColor ?? undefined,
        description: preset.config.description ?? preset.description ?? undefined,
        editorData: preset.config.editorData ?? preset.editorData ?? undefined,
        params: {
          ...(preset.config.params as Record<string, unknown> | undefined),
          internalPresetId: preset.id,
          internalPresetIdentifier: preset.identifier,
        },
        tags: preset.config.tags ?? preset.tags,
        title: preset.config.title ?? preset.title,
      };

      const agent = await ctx.agentModel.create(config);

      return { agentId: agent.id };
    }),

  list: agentPresetProcedure.query(async ({ ctx }) => {
    return ctx.agentPresetModel.listPublished();
  }),
});
