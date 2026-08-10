import { MarketAPIError } from '@lobehub/market-sdk';
import { describe, expect, it } from 'vitest';

import { toTaskTemplateRecommendationError } from './taskTemplateError';

describe('toTaskTemplateRecommendationError', () => {
  it('preserves Market rate limiting as a tRPC 429', () => {
    const cause = new MarketAPIError(429, 'Too Many Requests', { error: 'rate limited' });

    expect(toTaskTemplateRecommendationError(cause)).toMatchObject({
      cause,
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('maps unrelated failures to an internal error', () => {
    const cause = new Error('market unavailable');

    expect(toTaskTemplateRecommendationError(cause)).toMatchObject({
      cause,
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});
