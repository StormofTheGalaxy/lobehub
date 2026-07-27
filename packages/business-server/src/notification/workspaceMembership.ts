import { eq, or } from 'drizzle-orm';

import { users, workspaces } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { deliverInboxNotification, notificationTranslation } from './deliver';

const resolveUserLabel = async (db: LobeChatDatabase, userId: string) => {
  const user = await db.query.users.findFirst({
    columns: { email: true, fullName: true, username: true },
    where: eq(users.id, userId),
  });

  return user?.fullName || user?.username || user?.email || userId;
};

const resolveWorkspaceName = async (db: LobeChatDatabase, workspaceId: string) => {
  const workspace = await db.query.workspaces.findFirst({
    columns: { name: true },
    where: eq(workspaces.id, workspaceId),
  });

  return workspace?.name ?? workspaceId;
};

/**
 * The invited person, when the address already belongs to an account. An
 * invitation to an address nobody has registered has no inbox to reach — that
 * one travels by e-mail/link only.
 */
const findUserByEmail = async (db: LobeChatDatabase, email: string) => {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  return db.query.users.findFirst({
    columns: { id: true },
    where: or(eq(users.normalizedEmail, normalized), eq(users.email, normalized)),
  });
};

/** Tell an existing account that they were invited to a workspace. */
export const notifyWorkspaceMemberInvited = async (
  db: LobeChatDatabase,
  params: {
    email?: string | null;
    invitationId: string;
    inviterUserId: string;
    role: string;
    workspaceId: string;
  },
): Promise<void> => {
  if (!params.email) return;

  const invitee = await findUserByEmail(db, params.email);
  if (!invitee || invitee.id === params.inviterUserId) return;

  const [inviterLabel, workspaceName, { t }] = await Promise.all([
    resolveUserLabel(db, params.inviterUserId),
    resolveWorkspaceName(db, params.workspaceId),
    notificationTranslation(db, invitee.id),
  ]);

  await deliverInboxNotification(db, {
    category: 'workspace',
    content: t('workspace_member_invited', {
      inviterLabel,
      role: params.role,
      workspaceName,
    }),
    dedupeKey: `workspace_member_invited:${params.invitationId}`,
    title: t('workspace_member_invited_title', { workspaceName }),
    type: 'workspace_member_invited',
    userId: invitee.id,
    // The invitee is not a member yet, so this one lands in their personal inbox.
    workspaceId: null,
  });
};

/** Tell the workspace managers that somebody accepted an invitation. */
export const notifyWorkspaceMemberJoined = async (
  db: LobeChatDatabase,
  params: {
    memberUserId: string;
    notifyUserIds: string[];
    role: string;
    workspaceId: string;
  },
): Promise<void> => {
  const recipients = params.notifyUserIds.filter((userId) => userId !== params.memberUserId);
  if (recipients.length === 0) return;

  const [memberLabel, workspaceName] = await Promise.all([
    resolveUserLabel(db, params.memberUserId),
    resolveWorkspaceName(db, params.workspaceId),
  ]);

  await Promise.all(
    recipients.map(async (userId) => {
      const { t } = await notificationTranslation(db, userId);

      return deliverInboxNotification(db, {
        category: 'workspace',
        content: t('workspace_member_joined', {
          memberLabel,
          role: params.role,
          workspaceName,
        }),
        dedupeKey: `workspace_member_joined:${params.workspaceId}:${params.memberUserId}`,
        title: t('workspace_member_joined_title', { workspaceName }),
        type: 'workspace_member_joined',
        userId,
        workspaceId: params.workspaceId,
      });
    }),
  );
};

/**
 * Tell somebody they were removed from a workspace. Delivered personally — the
 * workspace inbox they were removed from is no longer readable to them.
 */
export const notifyWorkspaceMemberRemoved = async (
  db: LobeChatDatabase,
  params: { removedUserId: string; workspaceId: string },
): Promise<void> => {
  const [workspaceName, { t }] = await Promise.all([
    resolveWorkspaceName(db, params.workspaceId),
    notificationTranslation(db, params.removedUserId),
  ]);

  await deliverInboxNotification(db, {
    category: 'workspace',
    content: t('workspace_member_removed', { workspaceName }),
    dedupeKey: `workspace_member_removed:${params.workspaceId}:${params.removedUserId}:${Date.now()}`,
    title: t('workspace_member_removed_title'),
    type: 'workspace_member_removed',
    userId: params.removedUserId,
    workspaceId: null,
  });
};
