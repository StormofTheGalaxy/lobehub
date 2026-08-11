// @vitest-environment node
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';

import { config } from './proxy';

const matches = (pathname: string, accept = 'text/html') =>
  unstable_doesMiddlewareMatch({
    config,
    headers: { accept },
    nextConfig: {},
    url: `https://example.com${pathname}`,
  });

describe('proxy matcher', () => {
  it.each([
    '/acme',
    '/acme/agent/agent-1',
    '/acme/community/model/gpt-4.1',
    '/acme/settings/members',
  ])('serves workspace deep link %s through the SPA proxy', (pathname) => {
    expect(matches(pathname)).toBe(true);
  });

  it.each([
    '/api/auth/session',
    '/trpc/lambda',
    '/webapi/chat',
    '/_next/static/app.js',
    '/spa/en-US/acme',
    '/favicon.ico',
  ])('does not catch internal or asset path %s', (pathname) => {
    expect(matches(pathname)).toBe(false);
  });

  it('does not treat a non-document workspace request as SPA HTML', () => {
    expect(matches('/acme/agent/agent-1', 'application/json')).toBe(false);
  });
});
