import { getServerDB } from '@/database/core/db-adaptor';

import { deliverInboxNotification, notificationTranslation } from '../notification/deliver';

interface NotifyImageCompletedParams {
  duration: number;
  generationBatchId: string;
  model: string;
  prompt: string;
  topicId?: string;
  userId: string;
  /** Present when the generation ran in a workspace — the notification then follows that context. */
  workspaceId?: string;
}

/** Keep the prompt echo short enough to read in the inbox list. */
const PROMPT_MAX_LENGTH = 80;

const shortenPrompt = (prompt: string) => {
  const text = prompt.replaceAll(/\s+/g, ' ').trim();

  return text.length > PROMPT_MAX_LENGTH ? `${text.slice(0, PROMPT_MAX_LENGTH - 1)}…` : text;
};

/**
 * Image generation runs asynchronously and often finishes after the user has
 * moved on, so completion lands in the inbox.
 */
export async function notifyImageCompleted(params: NotifyImageCompletedParams): Promise<void> {
  const { userId, workspaceId, topicId, prompt, model, generationBatchId } = params;

  const db = await getServerDB();
  const { t } = await notificationTranslation(db, userId);

  await deliverInboxNotification(db, {
    actionUrl: topicId ? `/image?topic=${topicId}` : '/image',
    category: 'generation',
    content: t('image_generation_completed', { prompt: shortenPrompt(prompt) }),
    context: model,
    dedupeKey: `image_generation_completed:${generationBatchId}`,
    title: t('image_generation_completed_title'),
    type: 'image_generation_completed',
    userId,
    workspaceId,
  });
}
