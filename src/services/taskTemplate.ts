import { lambdaClient } from '@/libs/trpc/client/lambda';

class TaskTemplateService {
  dismiss = async (templateId: number) => {
    return lambdaClient.taskTemplate.dismiss.mutate({ templateId });
  };

  listDailyRecommend = async (
    _interestKeys: string[],
    _options: { count?: number; locale?: string; refreshSeed?: string } = {},
  ) => {
    // Disabled: remote Market auth and rate limits made this optional Home
    // surface unstable.
    return { data: [], success: true as const };
  };

  recordCreated = async (templateId: number) => {
    return lambdaClient.taskTemplate.recordCreated.mutate({ templateId });
  };
}

export const taskTemplateService = new TaskTemplateService();
