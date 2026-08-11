import { defineConfig } from '@/libs/next/proxy/define-config';

const { middleware } = defineConfig();

// required to be literal
export const config = {
  matcher: [
    // NOTE: `/api`, `/trpc`, `/webapi` are intentionally NOT matched. The
    // middleware is a no-op for them — `defaultMiddleware` short-circuits the
    // rewrite half via `backendApiEndpoints`, and they're all public routes, so
    // the better-auth session lookup is skipped. Auth lives in the route
    // handlers (`checkAuth`, trpc `protectedProcedure`), which return JSON 401s
    // rather than the HTML redirect-to-signin. Skipping the matcher avoids a
    // needless middleware invocation on the hottest backend traffic. (/oidc and
    // /oauth stay matched below — their middleware pass is still load-bearing.)
    // include the /
    '/',
    '/acceptance',
    '/acceptance(.*)',
    '/community',
    '/community(.*)',
    '/labs',
    '/eval',
    '/eval(.*)',
    '/agent',
    '/agent(.*)',
    '/group',
    '/group(.*)',
    '/changelog(.*)',
    '/settings(.*)',
    '/image',
    '/invite',
    '/invite/(.*)',
    '/video',
    '/resource',
    '/resource(.*)',
    '/profile(.*)',
    '/page',
    '/page(.*)',
    '/tasks',
    '/tasks(.*)',
    '/task',
    '/task(.*)',
    '/me',
    '/me(.*)',
    '/share(.*)',

    '/onboarding',
    '/onboarding(.*)',

    '/signup(.*)',
    '/signin(.*)',
    '/verify-email(.*)',
    '/verify-im(.*)',
    '/verify',
    '/verify/(.*)',
    '/reset-password(.*)',
    '/auth-error(.*)',
    '/oauth(.*)',
    '/oidc(.*)',
    '/market-auth-callback(.*)',
    // Dynamic workspace slugs cannot be enumerated above. Match document
    // navigations only, while keeping backend, internal SPA, and asset paths
    // away from the HTML rewrite (serving HTML for a JS chunk causes reload loops).
    {
      has: [{ key: 'accept', type: 'header', value: '.*text/html.*' }],
      source:
        '/((?!(?:api|trpc|webapi|market|f|_next|_spa(?:-auth|-workbench)?|spa(?:-auth|-workbench)?|_dangerous_local_dev_proxy|discover)(?:/|$)|.*\\.(?:avif|css|eot|gif|ico|jpe?g|js|json|map|mjs|png|svg|ttf|txt|webmanifest|webp|woff2?)$).*)',
    },
  ],
};

export default middleware;
