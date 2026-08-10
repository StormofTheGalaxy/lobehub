import { describe, expect, it } from 'vitest';

import { isWorkspaceSlugCandidatePath } from '@/features/Workspace/useWorkspaceUrlSync';
import { buildWorkspaceAwarePath } from '@/features/Workspace/workspaceAwarePath';
import { createMainAreaChildren, sharedMainAreaChildren } from '@/spa/router/desktopRouter.config';

interface RouteLike {
  children?: RouteLike[];
  path?: string;
}

const rootSegments = (routes: RouteLike[] | undefined): string[] => {
  const segments: string[] = [];

  for (const route of routes ?? []) {
    if (route.path) segments.push(route.path.replace(/^\//, '').split('/')[0]!);
    else if (route.children) segments.push(...rootSegments(route.children));
  }

  return segments;
};

const uniqueSorted = (values: string[]) =>
  [...new Set(values)].filter((path) => path && path !== '*' && !path.startsWith(':')).sort();

const allRootSegments = () => uniqueSorted(rootSegments(createMainAreaChildren() as RouteLike[]));
const sharedRootSegments = () => uniqueSorted(rootSegments(sharedMainAreaChildren as RouteLike[]));

describe('workspace root-segment lists track the router', () => {
  it('treats no router root route as a workspace slug', () => {
    const leaked = allRootSegments().filter((segment) =>
      isWorkspaceSlugCandidatePath(`/${segment}`),
    );

    expect(leaked).toEqual([]);
  });

  it('prefixes exactly the shared segments when a workspace is active', () => {
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

    for (const segment of personalOnly) {
      if (segment === 'settings') continue;
      expect(buildWorkspaceAwarePath(`/${segment}`, 'acme')).toBe(`/${segment}`);
    }
  });
});
