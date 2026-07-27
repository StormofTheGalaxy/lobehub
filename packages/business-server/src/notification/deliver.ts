import type { NotificationSettings } from '@lobechat/types';
import { eq } from 'drizzle-orm';

import { NotificationModel } from '@/database/models/notification';
import { WorkspaceUserSettingsModel } from '@/database/models/workspaceUserSettings';
import { userSettings } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { translation } from '@/libs/i18n/serverTranslation';

export interface DeliverInboxNotificationParams {
  /** In-app link opened from the notification; workspace links are slug-free. */
  actionUrl?: string;
  /** Preference grouping — must match the keys used by the settings UI. */
  category: string;
  /** Localized body. */
  content: string;
  /** Optional secondary line shown in the detail modal. */
  context?: string;
  /**
   * Idempotency key. The table has a unique (user_id, dedupe_key) index, so a
   * retried delivery for the same event silently no-ops instead of duplicating
   * the row.
   */
  dedupeKey?: string;
  /** Localized headline. */
  title: string;
  /** Scenario id — also the locale key prefix and the inbox icon selector. */
  type: string;
  userId: string;
  /** Workspace scope; omit for personal notifications. */
  workspaceId?: string | null;
}

const isChannelEnabled = (
  settings: NotificationSettings | undefined,
  category: string,
  type: string,
) => {
  const inbox = settings?.inbox;
  // Missing settings = every scenario on, matching DEFAULT_NOTIFICATION_SETTINGS.
  if (!inbox) return true;
  if (inbox.enabled === false) return false;

  return inbox.items?.[category]?.[type] !== false;
};

/**
 * The notification-preference bag that governs this scenario. Workspace-scoped
 * notifications read the member's per-workspace bag only (see
 * `WorkspaceUserPreference.notification`); personal ones read
 * `user_settings.notification`.
 */
const resolveNotificationSettings = async (
  db: LobeChatDatabase,
  userId: string,
  workspaceId?: string | null,
): Promise<NotificationSettings | undefined> => {
  if (workspaceId) {
    const preference = await new WorkspaceUserSettingsModel(db, userId, workspaceId).getPreference();
    return preference.notification;
  }

  const row = await db.query.userSettings.findFirst({
    columns: { notification: true },
    where: eq(userSettings.id, userId),
  });

  return (row?.notification as NotificationSettings | null) ?? undefined;
};

/**
 * Language for stored notification copy. The UI locale lives client-side, so
 * the server uses the same signal the rest of the backend uses for generated
 * user-facing text (`general.responseLanguage`, see
 * `UserModel.getInfoForAIGeneration`), falling back to the app default.
 */
export const resolveUserLocale = async (db: LobeChatDatabase, userId: string): Promise<string> => {
  const row = await db.query.userSettings.findFirst({
    columns: { general: true },
    where: eq(userSettings.id, userId),
  });
  const general = row?.general as { responseLanguage?: string } | null;
  const language = general?.responseLanguage;

  return !language || language === 'auto' ? 'en-US' : language;
};

/** `notification` namespace translator bound to the recipient's language. */
export const notificationTranslation = async (db: LobeChatDatabase, userId: string) => {
  const locale = await resolveUserLocale(db, userId);

  return translation('notification', locale);
};

/**
 * Write one inbox notification, honouring the recipient's channel preferences.
 * Delivery is best-effort by contract: callers fire it without awaiting the
 * outcome, so a disabled scenario or a duplicate dedupe key is a normal no-op
 * rather than an error.
 */
export const deliverInboxNotification = async (
  db: LobeChatDatabase,
  params: DeliverInboxNotificationParams,
) => {
  const { userId, workspaceId, category, type, ...rest } = params;

  const settings = await resolveNotificationSettings(db, userId, workspaceId);
  if (!isChannelEnabled(settings, category, type)) return null;

  return new NotificationModel(db, userId).create({
    actionUrl: rest.actionUrl,
    category,
    content: rest.content,
    context: rest.context,
    dedupeKey: rest.dedupeKey,
    title: rest.title,
    type,
    workspaceId: workspaceId ?? null,
  });
};
