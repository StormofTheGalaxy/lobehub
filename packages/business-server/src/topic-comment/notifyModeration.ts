import { eq } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';
import { topics } from '@/database/schemas';

import { deliverInboxNotification, notificationTranslation } from '../notification/deliver';

export interface NotifyTopicCommentModerationParams {
  authorUserId: string;
  commentId: string;
  event: 'removed' | 'restored';
  eventId: string;
  rootCommentId: string;
  topicId: string;
  workspaceId: string;
}

/**
 * Tell the author when a moderator removes or restores their comment. Silence
 * here is worse than a notification: a comment can vanish mid-conversation with
 * no other trace the author can see.
 */
export async function notifyTopicCommentModeration(
  params: NotifyTopicCommentModerationParams,
): Promise<void> {
  const { authorUserId, commentId, event, eventId, rootCommentId, topicId, workspaceId } = params;

  const db = await getServerDB();
  const { t } = await notificationTranslation(db, authorUserId);

  // A removed comment has nothing to open — only a restore links back.
  let actionUrl: string | undefined;
  if (event === 'restored') {
    const topic = await db.query.topics.findFirst({
      columns: { agentId: true },
      where: eq(topics.id, topicId),
    });

    if (topic?.agentId) {
      const search = new URLSearchParams({
        comment: commentId,
        commentThread: rootCommentId,
        source: 'inbox',
      });
      actionUrl = `/agent/${topic.agentId}/${topicId}?${search.toString()}`;
    }
  }

  // Upstream ships the copy for both outcomes under these keys.
  const copyKey =
    event === 'removed'
      ? 'topic_comment_removed_by_workspace_owner'
      : 'topic_comment_restored_by_workspace_owner';

  await deliverInboxNotification(db, {
    actionUrl,
    category: 'workspace',
    content: t(copyKey),
    // The moderation event id keeps a retried delivery idempotent.
    dedupeKey: `topic_comment_moderation:${eventId}`,
    title: t(`${copyKey}_title`),
    type: copyKey,
    userId: authorUserId,
    workspaceId,
  });
}
