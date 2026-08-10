import { TASK_TEMPLATE_RECOMMEND_MAX_COUNT } from '@lobechat/const';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { TaskTemplateService } from '@/server/services/taskTemplate';
import { toTaskTemplateRecommendationError } from '@/server/utils/taskTemplateError';

const listDailyRecommendSchema = z.object({
  count: z.number().int().min(1).max(TASK_TEMPLATE_RECOMMEND_MAX_COUNT).optional(),
  interestKeys: z.array(z.string().max(64)).max(32),
  locale: z.string().max(32).optional(),
  refreshSeed: z.string().min(1).max(32).optional(),
});

const templateIdSchema = z.object({
  templateId: z.number().int().positive(),
});

const taskTemplateProcedure = authedProcedure.use(serverDatabase);

export const taskTemplateRouter = router({
  dismiss: taskTemplateProcedure.input(templateIdSchema).mutation(async () => ({ success: true })),

  listDailyRecommend: taskTemplateProcedure
    .input(listDailyRecommendSchema)
    .query(async ({ input, ctx }) => {
      try {
        const service = new TaskTemplateService(ctx.userId, ctx.serverDB);
        const data = await service.listDailyRecommend(input.interestKeys, {
          count: input.count,
          locale: input.locale,
          refreshSeed: input.refreshSeed,
        });
        return { data, success: true };
      } catch (error) {
        const mappedError = toTaskTemplateRecommendationError(error);
        if (mappedError.code === 'INTERNAL_SERVER_ERROR') {
          console.error('[taskTemplate:listDailyRecommend]', error);
        }
        throw mappedError;
      }
    }),

  recordCreated: taskTemplateProcedure
    .input(templateIdSchema)
    .mutation(async () => ({ success: true })),
});
