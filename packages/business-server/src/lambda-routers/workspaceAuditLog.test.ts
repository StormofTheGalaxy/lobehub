// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import { WorkspaceAuditLogModel } from '@/database/models/workspaceAuditLog';
import {
  users,
  workspaceAuditLogs,
  workspaceMembers,
  workspaces,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { workspaceAuditLogRouter } from './workspaceAuditLog';

vi.mock('../enterprise/superAdmin', () => ({
  isSuperAdmin: async () => false,
}));

const serverDB: LobeChatDatabase = await getTestDB();

// The router builds its own models from `ctx.serverDB`, which the
// `serverDatabase` middleware injects from the runtime adaptor.
vi.mock('@/database/core/db-adaptor', () => ({ getServerDB: async () => serverDB }));

const ownerId = 'audit-owner';
const adminId = 'audit-admin';
const memberId = 'audit-member';
const workspaceId = 'audit-workspace';

const callList = (userId: string, input: Record<string, unknown> = {}) =>
  workspaceAuditLogRouter
    .createCaller({ jwtPayload: { userId }, userId } as never)
    .list({ workspaceId, ...input });

const cleanup = async () => {
  await serverDB.delete(workspaceAuditLogs);
  await serverDB.delete(workspaceMembers);
  await serverDB.delete(workspaces);
  await serverDB.delete(users);
};

beforeEach(async () => {
  await cleanup();
  await serverDB.insert(users).values([
    { fullName: 'Owner Person', id: ownerId },
    { fullName: 'Admin Person', id: adminId },
    { id: memberId },
  ]);
  await serverDB.insert(workspaces).values({
    id: workspaceId,
    name: 'Audit workspace',
    primaryOwnerId: ownerId,
    slug: workspaceId,
  });
  await serverDB.insert(workspaceMembers).values([
    { role: 'owner', userId: ownerId, workspaceId },
    { role: 'admin', userId: adminId, workspaceId },
    { role: 'member', userId: memberId, workspaceId },
  ]);
  await new WorkspaceAuditLogModel(serverDB).create({
    action: 'member.invited',
    metadata: { email: 'invitee@example.com' },
    userId: ownerId,
    workspaceId,
  });
});

afterEach(async () => {
  await cleanup();
});

describe('workspaceAuditLogRouter.list', () => {
  it('lets the owner read the log', async () => {
    const result = await callList(ownerId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ action: 'member.invited' });
  });

  // The Audit Log tab is shown to Admins (manage_settings), so the API must
  // serve them instead of silently returning nothing.
  it('lets an admin read the log', async () => {
    const result = await callList(adminId);

    expect(result.items).toHaveLength(1);
  });

  it('rejects a plain member instead of returning an empty page', async () => {
    await expect(callList(memberId)).rejects.toBeInstanceOf(TRPCError);
  });

  it('resolves the actor label so rows can name who acted', async () => {
    const result = await callList(ownerId);

    expect(result.items[0].actorLabel).toBe('Owner Person');
  });

  it('filters by action', async () => {
    await expect(callList(ownerId, { action: 'workspace.updated' })).resolves.toMatchObject({
      items: [],
    });
    await expect(callList(ownerId, { action: 'member.invited' })).resolves.toMatchObject({
      items: [expect.objectContaining({ action: 'member.invited' })],
    });
  });

  it('matches the free-text query against the actor', async () => {
    await expect(callList(ownerId, { q: 'Owner Person' })).resolves.toMatchObject({
      items: [expect.objectContaining({ action: 'member.invited' })],
    });
    await expect(callList(ownerId, { q: 'nobody-matches-this' })).resolves.toMatchObject({
      items: [],
    });
  });
});
