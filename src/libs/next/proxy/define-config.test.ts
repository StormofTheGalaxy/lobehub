/**
 * @vitest-environment node
 */
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  LOBE_ROUTE_VIEW_COOKIE,
  LOBE_ROUTE_VIEW_QUERY,
  RouteViewPreference,
} from '@/const/routeView';
import { DEFAULT_LANG, RouteVariants } from '@/utils/server/routeVariants';

import { defineConfig, resolveIsMobileVariant, resolveRouteViewPreference } from './define-config';

vi.mock('@/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }) } },
}));

const { middleware } = defineConfig();

// Takes a full `NextRequest` init (not just a user-agent) because the route-view
// tests below assert on `set-cookie`, so they need the whole response back.
const run = async (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => {
  const res = await middleware(new NextRequest(url, init));
  return {
    response: res,
    rewrite: res?.headers.get('x-middleware-rewrite'),
  };
};

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

const mobile = { headers: { 'user-agent': MOBILE_USER_AGENT } };

describe('defineConfig locale path-traversal hardening', () => {
  it('rewrites a normal locale into /spa-auth/<locale>', async () => {
    const { rewrite } = await run('http://localhost:3010/signin?hl=ja-JP');
    expect(new URL(rewrite!).pathname).toBe('/spa-auth/ja-JP/signin');
  });

  it('falls back to en-US for a traversal locale (plain)', async () => {
    const { rewrite } = await run('http://localhost:3010/signin?hl=../../api/dev/x');
    const { pathname } = new URL(rewrite!);
    expect(pathname.startsWith('/spa-auth/')).toBe(true);
    expect(pathname).toBe('/spa-auth/en-US/signin');
  });

  it('falls back to en-US for a traversal locale (percent-encoded)', async () => {
    const { rewrite } = await run('http://localhost:3010/signin?hl=..%2F..%2Fapi%2Fdev%2Fx');
    const { pathname } = new URL(rewrite!);
    expect(pathname.startsWith('/spa-auth/')).toBe(true);
    expect(pathname).toBe('/spa-auth/en-US/signin');
  });

  it('does not treat workspace slugs beginning with an auth route as auth SPA pages', async () => {
    const { rewrite } = await run(
      'http://localhost:3010/oauth-preview-e2e-20260716/settings/oauth-apps?hl=en-US',
    );
    expect(new URL(rewrite!).pathname).toMatch(
      /^\/spa\/[^/]+\/oauth-preview-e2e-20260716\/settings\/oauth-apps$/,
    );
  });
});

describe('defineConfig route view preference', () => {
  it('resolves query preference before cookie preference', () => {
    const url = new URL(`http://localhost:3010/me?${LOBE_ROUTE_VIEW_QUERY}=desktop`);

    expect(resolveRouteViewPreference(url, RouteViewPreference.Mobile)).toBe(
      RouteViewPreference.Desktop,
    );
  });

  it('ignores invalid route view preferences', () => {
    const url = new URL(`http://localhost:3010/me?${LOBE_ROUTE_VIEW_QUERY}=tablet`);

    expect(resolveRouteViewPreference(url, 'watch')).toBeUndefined();
  });

  it('uses desktop preference to override mobile user-agent routing', () => {
    expect(
      resolveIsMobileVariant({
        isMobileDevice: true,
        isDesktopOnlyPath: false,
        routeViewPreference: RouteViewPreference.Desktop,
      }),
    ).toBe(false);
  });

  it('uses mobile preference to override desktop user-agent routing', () => {
    expect(
      resolveIsMobileVariant({
        isMobileDevice: false,
        isDesktopOnlyPath: false,
        routeViewPreference: RouteViewPreference.Mobile,
      }),
    ).toBe(true);
  });

  it('rewrites mobile user-agent SPA requests to desktop when query preference is desktop', async () => {
    const desktopRoute = RouteVariants.serializeVariants({ isMobile: false, locale: DEFAULT_LANG });
    const { response, rewrite } = await run(
      `http://localhost:3010/verify/example?tab=profile&${LOBE_ROUTE_VIEW_QUERY}=desktop`,
      {
        headers: {
          'user-agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        },
      },
    );
    const rewriteUrl = new URL(rewrite!, 'http://localhost:3010');

    expect(rewriteUrl.pathname).toBe(`/spa/${desktopRoute}/verify/example`);
    expect(rewriteUrl.searchParams.get(LOBE_ROUTE_VIEW_QUERY)).toBeNull();
    expect(response?.headers.get('set-cookie')).toContain(
      `${LOBE_ROUTE_VIEW_COOKIE}=${RouteViewPreference.Desktop}`,
    );
  });

  it('rewrites mobile user-agent SPA requests to desktop when cookie preference is desktop', async () => {
    const desktopRoute = RouteVariants.serializeVariants({ isMobile: false, locale: DEFAULT_LANG });
    const { rewrite } = await run('http://localhost:3010/verify/example?tab=profile', {
      headers: {
        'cookie': `${LOBE_ROUTE_VIEW_COOKIE}=${RouteViewPreference.Desktop}`,
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      },
    });

    expect(new URL(rewrite!, 'http://localhost:3010').pathname).toBe(
      `/spa/${desktopRoute}/verify/example`,
    );
  });
});

describe('defineConfig Workbench SPA rewrite', () => {
  it('routes Workbench-owned paths only for mobile devices', async () => {
    const { rewrite: mobileAcceptance } = await run(
      'http://localhost:3010/acceptance/acceptance-1?hl=en-US',
      mobile,
    );
    const { rewrite: desktopAcceptance } = await run(
      'http://localhost:3010/acceptance/acceptance-1?hl=en-US',
    );

    expect(new URL(mobileAcceptance!).pathname).toBe('/spa-workbench/en-US/acceptance/acceptance-1');
    expect(new URL(desktopAcceptance!).pathname).toMatch(
      /^\/spa\/[^/]+\/acceptance\/acceptance-1$/,
    );
  });

  it('keeps the agent documents index in the Main Mobile SPA', async () => {
    const { rewrite: detail } = await run(
      'http://localhost:3010/agent/agt_1/docs/doc_1?hl=en-US',
      mobile,
    );
    const { rewrite: index } = await run('http://localhost:3010/agent/agt_1/docs?hl=en-US', mobile);

    expect(new URL(detail!).pathname).toBe('/spa-workbench/en-US/agent/agt_1/docs/doc_1');
    expect(new URL(index!).pathname).toMatch(/^\/spa\/[^/]+\/agent\/agt_1\/docs$/);
  });
});
