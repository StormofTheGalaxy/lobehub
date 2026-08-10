import { MarketAPIError } from '@lobehub/market-sdk';
import { TRPCError } from '@trpc/server';

export const toTaskTemplateRecommendationError = (error: unknown): TRPCError => {
  if (error instanceof MarketAPIError && error.status === 429) {
    return new TRPCError({
      cause: error,
      code: 'TOO_MANY_REQUESTS',
      message: 'Task template recommendations are temporarily rate limited',
    });
  }

  return new TRPCError({
    cause: error,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to list recommended task templates',
  });
};
