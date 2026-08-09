import { getServerDB } from '@/database/core/db-adaptor';

import { deliverInboxNotification, notificationTranslation } from '../notification/deliver';

export interface NotifyAgentRunCompletedParams {
  agentId?: string;
  duration?: number;
  lastAssistantContent?: string;
  operationId: string;
  topicId?: string;
  userId: string;
  workspaceId?: string;
}

/** Inbox preview length — the full reply is one click away in the topic. */
const PREVIEW_MAX_LENGTH = 160;

const buildPreview = (content?: string) => {
  const text = content?.replaceAll(/\s+/g, ' ').trim();
  if (!text) return '';

  return text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH - 1)}…` : text;
};

/**
 * Recall the user to a finished background run through the inbox. Called
 * fire-and-forget from the completion lifecycle, once per successful terminal
 * of a top-level run.
 */
export async function notifyAgentRunCompleted(
  params: NotifyAgentRunCompletedParams,
): Promise<void> {
  const { userId, workspaceId, operationId, topicId, agentId, lastAssistantContent } = params;

  const db = await getServerDB();
  const { t } = await notificationTranslation(db, userId);
  const preview = buildPreview(lastAssistantContent);

  // `/agent/:aid/:topicId` — the inbox navigates workspace-aware, so the path
  // stays slug-free. Without an agent there is no addressable chat to open.
  const actionUrl = agentId ? `/agent/${agentId}${topicId ? `/${topicId}` : ''}` : undefined;

  await deliverInboxNotification(db, {
    actionUrl,
    category: 'schedule',
    content: preview || t('agent_run_completed_title'),
    // One run produces at most one recall, even if the terminal event is retried.
    dedupeKey: `agent_run_completed:${operationId}`,
    title: t('agent_run_completed_title'),
    type: 'agent_run_completed',
    userId,
    workspaceId,
  });
}
