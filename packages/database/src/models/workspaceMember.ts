import { INVITATION_EXPIRY_DAYS } from '@lobechat/const';
import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid/non-secure';

import { devices } from '../schemas/device';
import { users } from '../schemas/user';
import { workspaceInvitations, workspaceMembers, workspaces } from '../schemas/workspace';
import type { LobeChatDatabase, Transaction } from '../type';

type MemberRole = 'admin' | 'member' | 'viewer';

const lockWorkspaceForOwnerChange = async (tx: Transaction, workspaceId: string) => {
  const [workspace] = await tx
    .select({ primaryOwnerId: workspaces.primaryOwnerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .for('update');

  if (!workspace) throw new Error('Workspace not found');

  return workspace;
};

export class WorkspaceMemberModel {
  private readonly db: LobeChatDatabase;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  // ===== Members ===== //

  addMember = async (params: { role?: MemberRole; userId: string; workspaceId: string }) => {
    const [result] = await this.db
      .insert(workspaceMembers)
      .values({
        role: params.role ?? 'member',
        userId: params.userId,
        workspaceId: params.workspaceId,
      })
      .onConflictDoUpdate({
        set: {
          deletedAt: null,
          joinedAt: new Date(),
          role: params.role ?? 'member',
        },
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      })
      .returning();
    return result;
  };

  getMember = async (workspaceId: string, userId: string) => {
    return this.db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
        isNull(workspaceMembers.deletedAt),
      ),
    });
  };

  listMembers = async (workspaceId: string, options: { includeDeleted?: boolean } = {}) => {
    const whereClause = options.includeDeleted
      ? eq(workspaceMembers.workspaceId, workspaceId)
      : and(eq(workspaceMembers.workspaceId, workspaceId), isNull(workspaceMembers.deletedAt));

    return this.db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        updatedAt: workspaceMembers.updatedAt,
        deletedAt: workspaceMembers.deletedAt,
        email: users.email,
        normalizedEmail: users.normalizedEmail,
        username: users.username,
      })
      .from(workspaceMembers)
      .leftJoin(users, eq(users.id, workspaceMembers.userId))
      .where(whereClause);
  };

  removeMember = async (workspaceId: string, userId: string) => {
    return this.db.transaction(async (tx) => {
      const workspace = await lockWorkspaceForOwnerChange(tx, workspaceId);
      if (workspace.primaryOwnerId === userId) {
        throw new Error('Cannot remove the primary owner — transfer primary ownership first');
      }

      // Departed-member device cleanup: private enrollments and devices shared
      // from the user's personal list no longer belong in the workspace.
      const removedDevices = await tx
        .delete(devices)
        .where(
          and(
            eq(devices.workspaceId, workspaceId),
            eq(devices.userId, userId),
            or(eq(devices.visibility, 'private'), isNotNull(devices.sharedFromDeviceId)),
          ),
        )
        .returning({ deviceId: devices.deviceId });

      await tx
        .update(workspaceMembers)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, userId),
            isNull(workspaceMembers.deletedAt),
          ),
        );

      return { removedDeviceIds: removedDevices.map((device) => device.deviceId) };
    });
  };

  updateMemberRole = async (workspaceId: string, userId: string, role: MemberRole) => {
    return this.db.transaction(async (tx) => {
      const workspace = await lockWorkspaceForOwnerChange(tx, workspaceId);
      if (workspace.primaryOwnerId === userId) {
        throw new Error('Cannot demote the primary owner — transfer primary ownership first');
      }

      return tx
        .update(workspaceMembers)
        .set({ role })
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, userId),
            isNull(workspaceMembers.deletedAt),
          ),
        );
    });
  };

  // ===== Invitations ===== //

  createInvitation = async (params: { email?: string; role?: MemberRole; workspaceId: string }) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const [result] = await this.db
      .insert(workspaceInvitations)
      .values({
        email: params.email,
        expiresAt,
        inviterId: this.userId,
        role: params.role ?? 'member',
        token: nanoid(32),
        workspaceId: params.workspaceId,
      })
      .returning();
    return result;
  };

  findInvitationByToken = async (token: string) => {
    return this.db.query.workspaceInvitations.findFirst({
      where: eq(workspaceInvitations.token, token),
    });
  };

  listPendingInvitations = async (workspaceId: string) => {
    return this.db.query.workspaceInvitations.findMany({
      where: and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        eq(workspaceInvitations.status, 'pending'),
      ),
    });
  };

  revokeInvitation = async (id: string, workspaceId: string) => {
    return this.db
      .update(workspaceInvitations)
      .set({ status: 'revoked' })
      .where(
        and(eq(workspaceInvitations.id, id), eq(workspaceInvitations.workspaceId, workspaceId)),
      );
  };

  updateInvitationStatus = async (
    id: string,
    status: 'accepted' | 'expired' | 'revoked',
    workspaceId: string,
  ) => {
    return this.db
      .update(workspaceInvitations)
      .set({ status })
      .where(
        and(eq(workspaceInvitations.id, id), eq(workspaceInvitations.workspaceId, workspaceId)),
      );
  };
}
