import { getServerDB } from '@/database/core/db-adaptor';

import { deliverInboxNotification, notificationTranslation } from '../notification/deliver';

interface NotifyVideoCompletedParams {
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

/** Video generation is the longest-running job in the product — always recall. */
export async function notifyVideoCompleted(params: NotifyVideoCompletedParams): Promise<void> {
  const { userId, workspaceId, topicId, prompt, model, generationBatchId } = params;

  const db = await getServerDB();
  const { t } = await notificationTranslation(db, userId);

  await deliverInboxNotification(db, {
    actionUrl: topicId ? `/video?topic=${topicId}` : '/video',
    category: 'generation',
    content: t('video_generation_completed', { prompt: shortenPrompt(prompt) }),
    context: model,
    dedupeKey: `video_generation_completed:${generationBatchId}`,
    title: t('video_generation_completed_title'),
    type: 'video_generation_completed',
    userId,
    workspaceId,
  });
}
