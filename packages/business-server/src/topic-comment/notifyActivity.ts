import { eq } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';
import { topics, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import { deliverInboxNotification, notificationTranslation } from '../notification/deliver';

export type TopicCommentActivityKind = 'commented' | 'commentedOnMessage' | 'mentioned' | 'replied';

export interface TopicCommentActivityRecipient {
  kind: TopicCommentActivityKind;
  userId: string;
}

export interface NotifyTopicCommentActivityParams {
  actorUserId: string;
  commentId: string;
  recipients: TopicCommentActivityRecipient[];
  rootCommentId: string;
  topicId: string;
  workspaceId: string;
}

/** Locale keys per activity kind — content key doubles as the notification type. */
const COPY_KEY_BY_KIND: Record<TopicCommentActivityKind, string> = {
  commented: 'topic_comment_activity',
  commentedOnMessage: 'topic_comment_activity_message',
  mentioned: 'topic_comment_activity_mentioned',
  replied: 'topic_comment_activity_replied',
};

const resolveActorLabel = async (db: LobeChatDatabase, actorUserId: string) => {
  const actor = await db.query.users.findFirst({
    columns: { email: true, fullName: true, username: true },
    where: eq(users.id, actorUserId),
  });

  return actor?.fullName || actor?.username || actor?.email || actorUserId;
};

/**
 * Deep link that reopens the comment thread on the topic route. The agent id
 * makes the chat addressable; the `comment` / `commentThread` params are the
 * contract `useTopicCommentDeepLink` reads to focus the right thread.
 */
const buildActionUrl = async (
  db: LobeChatDatabase,
  params: { commentId: string; rootCommentId: string; topicId: string },
) => {
  const topic = await db.query.topics.findFirst({
    columns: { agentId: true },
    where: eq(topics.id, params.topicId),
  });
  if (!topic?.agentId) return undefined;

  const search = new URLSearchParams({
    comment: params.commentId,
    commentThread: params.rootCommentId,
    source: 'inbox',
  });

  return `/agent/${topic.agentId}/${params.topicId}?${search.toString()}`;
};

/**
 * Fan a new comment out to its recipients' inboxes. Recipients arrive already
 * authorized for the topic, and each one gets the copy for how the comment
 * reached them (mention, reply, own message, or plain participation).
 */
export async function notifyTopicCommentActivity(
  params: NotifyTopicCommentActivityParams,
): Promise<void> {
  const { actorUserId, commentId, recipients, rootCommentId, topicId, workspaceId } = params;
  if (recipients.length === 0) return;

  const db = await getServerDB();
  const [actorLabel, actionUrl] = await Promise.all([
    resolveActorLabel(db, actorUserId),
    buildActionUrl(db, { commentId, rootCommentId, topicId }),
  ]);

  await Promise.all(
    recipients
      // The author of the comment never gets notified about their own writing.
      .filter(({ userId }) => userId !== actorUserId)
      .map(async ({ kind, userId }) => {
        const { t } = await notificationTranslation(db, userId);
        const copyKey = COPY_KEY_BY_KIND[kind];

        return deliverInboxNotification(db, {
          actionUrl,
          category: 'workspace',
          content: t(copyKey, { actorLabel }),
          // One row per recipient per comment, so a retry cannot double-post.
          dedupeKey: `topic_comment_activity:${commentId}:${kind}`,
          title: t(`${copyKey}_title`),
          type: copyKey,
          userId,
          workspaceId,
        });
      }),
  );
}
