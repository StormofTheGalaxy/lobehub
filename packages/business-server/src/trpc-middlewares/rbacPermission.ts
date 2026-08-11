import { TRPCError } from '@trpc/server';

import { getServerDB } from '@/database/core/db-adaptor';
import { RbacModel } from '@/database/models/rbac';
import { trpc } from '@/libs/trpc/lambda/init';

import { isSuperAdmin } from '../enterprise/superAdmin';
import { resolveScopedPermissionCodes } from './rbacPermissionCodes';

export { resolveScopedPermissionCodes } from './rbacPermissionCodes';

const assertAnyPermission = async (params: {
  codes: string[];
  userId?: string | null;
  workspaceId?: string | null;
}) => {
  if (!params.workspaceId) return;
  if (!params.userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

  const db = await getServerDB();
  if (await isSuperAdmin(db, params.userId)) return;

  const rbac = new RbacModel(db, params.userId);
  const permissionCodes = params.codes.flatMap(resolveScopedPermissionCodes);
  const allowed = await rbac.hasAnyPermission(permissionCodes, {
    workspaceId: params.workspaceId,
  });

  if (!allowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Missing any of: ${permissionCodes.join(', ')}`,
    });
  }
};

export const withRbacPermission = (code: string) =>
  trpc.middleware(async (opts) => {
    await assertAnyPermission({
      codes: [code],
      userId: opts.ctx.userId,
      workspaceId: opts.ctx.workspaceId,
    });

    return opts.next();
  });

export const withAnyRbacPermission = (codes: string[]) =>
  trpc.middleware(async (opts) => {
    await assertAnyPermission({
      codes,
      userId: opts.ctx.userId,
      workspaceId: opts.ctx.workspaceId,
    });

    return opts.next();
  });

export const withAllRbacPermissions = (codes: string[]) =>
  trpc.middleware(async (opts) => {
    for (const code of codes) {
      await assertAnyPermission({
        codes: [code],
        userId: opts.ctx.userId,
        workspaceId: opts.ctx.workspaceId,
      });
    }

    return opts.next();
  });

/** Expand an unscoped action into the `:all | :owner` alternatives. */
export const withScopedPermission = (action: string) => withRbacPermission(action);
