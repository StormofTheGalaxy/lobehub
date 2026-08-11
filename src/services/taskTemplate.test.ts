import { beforeEach, describe, expect, it, vi } from 'vitest';

import { taskTemplateService } from './taskTemplate';

const mocks = vi.hoisted(() => ({
  listDailyRecommend: vi.fn(),
}));

vi.mock('@/libs/trpc/client/lambda', () => ({
  lambdaClient: {
    taskTemplate: {
      dismiss: { mutate: vi.fn() },
      listDailyRecommend: { query: mocks.listDailyRecommend },
      recordCreated: { mutate: vi.fn() },
    },
  },
}));

describe('taskTemplateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps daily Market recommendations disabled', async () => {
    await expect(
      taskTemplateService.listDailyRecommend(['coding'], { count: 3, locale: 'en-US' }),
    ).resolves.toEqual({ data: [], success: true });
    expect(mocks.listDailyRecommend).not.toHaveBeenCalled();
  });
});
