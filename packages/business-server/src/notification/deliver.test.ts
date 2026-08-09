// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '@/database/core/getTestDB';
import {
  notifications,
  users,
  userSettings,
  workspaces,
  workspaceUserSettings,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { deliverInboxNotification, resolveUserLocale } from './deliver';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'notification-deliver-user';
const workspaceId = 'notification-deliver-workspace';

const cleanup = async () => {
  await serverDB.delete(notifications);
  await serverDB.delete(workspaceUserSettings);
  await serverDB.delete(workspaces);
  await serverDB.delete(userSettings);
  await serverDB.delete(users);
};

const listRows = () =>
  serverDB.query.notifications.findMany({ where: eq(notifications.userId, userId) });

const params = {
  category: 'workspace',
  content: 'content',
  title: 'title',
  type: 'topic_comment_activity_mentioned',
  userId,
};

beforeEach(async () => {
  await cleanup();
  await serverDB.insert(users).values({ id: userId });
  await serverDB.insert(workspaces).values({
    id: workspaceId,
    name: 'Workspace',
    primaryOwnerId: userId,
    slug: workspaceId,
  });
});

afterEach(async () => {
  await cleanup();
});

describe('deliverInboxNotification', () => {
  it('writes a personal notification when no preferences are stored', async () => {
    await deliverInboxNotification(serverDB, params);

    const rows = await listRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'workspace', title: 'title', workspaceId: null });
  });

  it('scopes the row to the workspace it was raised in', async () => {
    await deliverInboxNotification(serverDB, { ...params, workspaceId });

    const rows = await listRows();
    expect(rows[0]?.workspaceId).toBe(workspaceId);
  });

  it('skips delivery when the inbox channel is switched off', async () => {
    await serverDB
      .insert(userSettings)
      .values({ id: userId, notification: { inbox: { enabled: false } } });

    await deliverInboxNotification(serverDB, params);

    await expect(listRows()).resolves.toHaveLength(0);
  });

  it('skips delivery when the scenario is switched off', async () => {
    await serverDB.insert(userSettings).values({
      id: userId,
      notification: {
        inbox: { enabled: true, items: { workspace: { [params.type]: false } } },
      },
    });

    await deliverInboxNotification(serverDB, params);

    await expect(listRows()).resolves.toHaveLength(0);
  });

  it('keeps sibling scenarios enabled when one is switched off', async () => {
    await serverDB.insert(userSettings).values({
      id: userId,
      notification: {
        inbox: { enabled: true, items: { workspace: { topic_comment_activity: false } } },
      },
    });

    await deliverInboxNotification(serverDB, params);

    await expect(listRows()).resolves.toHaveLength(1);
  });

  it('reads workspace-scoped scenarios from the member preference bag, not the personal one', async () => {
    // Personal settings switch the scenario off, the workspace bag leaves it on:
    // a workspace notification must follow the workspace bag.
    await serverDB.insert(userSettings).values({
      id: userId,
      notification: { inbox: { enabled: false } },
    });
    await serverDB.insert(workspaceUserSettings).values({
      preference: { notification: { inbox: { enabled: true } } },
      userId,
      workspaceId,
    });

    await deliverInboxNotification(serverDB, { ...params, workspaceId });

    await expect(listRows()).resolves.toHaveLength(1);
  });

  it('honours the member preference bag when it disables the workspace scenario', async () => {
    await serverDB.insert(workspaceUserSettings).values({
      preference: { notification: { inbox: { items: { workspace: { [params.type]: false } } } } },
      userId,
      workspaceId,
    });

    await deliverInboxNotification(serverDB, { ...params, workspaceId });

    await expect(listRows()).resolves.toHaveLength(0);
  });

  it('does not duplicate a retried delivery carrying the same dedupe key', async () => {
    await deliverInboxNotification(serverDB, { ...params, dedupeKey: 'event-1' });
    await deliverInboxNotification(serverDB, { ...params, dedupeKey: 'event-1' });

    await expect(listRows()).resolves.toHaveLength(1);
  });
});

describe('resolveUserLocale', () => {
  it('falls back to the app default when the user has no language preference', async () => {
    await expect(resolveUserLocale(serverDB, userId)).resolves.toBe('en-US');
  });

  it('uses the stored response language', async () => {
    await serverDB.insert(userSettings).values({ id: userId, general: { responseLanguage: 'ru-RU' } });

    await expect(resolveUserLocale(serverDB, userId)).resolves.toBe('ru-RU');
  });

  it('treats an automatic language as the app default', async () => {
    await serverDB.insert(userSettings).values({ id: userId, general: { responseLanguage: 'auto' } });

    await expect(resolveUserLocale(serverDB, userId)).resolves.toBe('en-US');
  });
});
