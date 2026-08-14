import type { TaskTemplate } from '@lobechat/const';

import { lambdaClient } from '@/libs/trpc/client/lambda';

class TaskTemplateService {
  dismiss = async (templateId: number) => {
    return lambdaClient.taskTemplate.dismiss.mutate({ templateId });
  };

  /**
   * Disabled: remote Market auth and rate limits made this optional Home
   * surface unstable. The empty result keeps the caller's shape — an untyped
   * `[]` would collapse to `never[]` and break every consumer that maps over
   * the list.
   */
  listDailyRecommend = async (
    _interestKeys: string[],
    _options: { count?: number; locale?: string; refreshSeed?: string } = {},
  ): Promise<{ data: TaskTemplate[]; success: true }> => {
    return { data: [], success: true };
  };

  recordCreated = async (templateId: number) => {
    return lambdaClient.taskTemplate.recordCreated.mutate({ templateId });
  };
}

export const taskTemplateService = new TaskTemplateService();
