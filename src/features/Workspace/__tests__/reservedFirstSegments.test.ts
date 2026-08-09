import { describe, expect, it } from 'vitest';

import { isWorkspaceSlugCandidatePath } from '@/features/Workspace/useWorkspaceUrlSync';
import { buildWorkspaceAwarePath } from '@/features/Workspace/workspaceAwarePath';
import { createMainAreaChildren, sharedMainAreaChildren } from '@/spa/router/desktopRouter.config';

interface RouteLike {
  children?: RouteLike[];
  path?: string;
}

/**
 * First URL segment of every route reachable at depth 1.
 *
 * A pathless (layout) route contributes its children at the same URL depth, so
 * the walk has to descend through those instead of reading one level.
 */
const rootSegments = (routes: RouteLike[] | undefined): string[] => {
  const out: string[] = [];
  for (const route of routes ?? []) {
    if (route?.path) out.push(route.path.replace(/^\//, '').split('/')[0]!);
    else if (route?.children) out.push(...rootSegments(route.children));
  }
  return out;
};

const uniqueSorted = (values: string[]) =>
  [...new Set(values)].filter((p) => p && p !== '*' && !p.startsWith(':')).sort();

const allRootSegments = () => uniqueSorted(rootSegments(createMainAreaChildren() as RouteLike[]));
const sharedRootSegments = () => uniqueSorted(rootSegments(sharedMainAreaChildren as RouteLike[]));

/**
 * `useWorkspaceUrlSync` and `workspaceAwarePath` each hand-maintain a list of
 * root path segments, and their comments say to keep them in sync with the
 * router. Nothing enforced that, so an upstream sync that adds a root route
 * (`/agents`, `/downloads`) silently turned it into a workspace-slug candidate:
 * the URL sync then refused to drop workspace context on that personal route
 * while workspace-aware navigation kept re-prefixing back into the workspace —
 * the app ping-ponged between personal and workspace scope.
 *
 * These tests derive the expectation from the router itself, so a new root
 * route fails here instead of in the browser.
 */
describe('workspace root-segment lists track the router', () => {
  it('treats no router root route as a workspace slug', () => {
    const leaked = allRootSegments().filter((segment) =>
      isWorkspaceSlugCandidatePath(`/${segment}`),
    );

    expect(leaked).toEqual([]);
  });

  it('prefixes exactly the shared segments when a workspace is active', () => {
    // `/:slug/settings` exists, so the bare segment is prefixed as well; which
    // of its tabs follow is decided by the WORKSPACE_SETTINGS_TABS allowlist
    // rather than a whole-segment rule, asserted below.
    const expected = [...new Set([...sharedRootSegments(), 'settings'])].sort();
    const prefixed = allRootSegments().filter(
      (segment) => buildWorkspaceAwarePath(`/${segment}`, 'acme') === `/acme/${segment}`,
    );

    expect(prefixed).toEqual(expected);
    expect(buildWorkspaceAwarePath('/settings/members', 'acme')).toBe('/acme/settings/members');
    expect(buildWorkspaceAwarePath('/settings/profile', 'acme')).toBe('/settings/profile');
  });

  it('never prefixes a personal-only root route', () => {
    const shared = new Set(sharedRootSegments());
    const personalOnly = allRootSegments().filter((segment) => !shared.has(segment));

    // Guards the reported bounce directly: `/agents` and `/downloads` arrived
    // with an upstream sync and were missing from both lists.
    expect(personalOnly).toContain('downloads');

    for (const segment of personalOnly) {
      if (segment === 'settings') continue;
      expect(buildWorkspaceAwarePath(`/${segment}`, 'acme')).toBe(`/${segment}`);
    }
  });

  it('keeps personal scope on a personal route while a workspace is active', () => {
    // The bounce, stated as behaviour: entering `/agents` or `/downloads` must
    // read as "no workspace slug here" so the sync hook switches to personal
    // instead of hunting for a workspace named `agents`.
    expect(isWorkspaceSlugCandidatePath('/agents')).toBe(false);
    expect(isWorkspaceSlugCandidatePath('/downloads')).toBe(false);

    // A genuine slug still resolves as one.
    expect(isWorkspaceSlugCandidatePath('/acme')).toBe(true);
    expect(isWorkspaceSlugCandidatePath('/acme/agent/x')).toBe(true);
  });
});
