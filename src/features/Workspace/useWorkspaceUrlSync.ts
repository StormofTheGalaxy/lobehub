'use client';

import { useLayoutEffect } from 'react';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import { useIsWorkspaceLoading } from '@/business/client/hooks/useIsWorkspaceLoading';
import { useSilentSwitchWorkspace } from '@/business/client/hooks/useSwitchWorkspace';
import { useWorkspaces } from '@/business/client/hooks/useWorkspaces';

import { useWorkspaceSyncPathname } from './useWorkspaceSyncPathname';

/**
 * Top-level route segments that share the namespace with `:workspaceSlug`.
 * Anything starting with one of these is NOT a workspace slug — even if the
 * first segment happens to resemble one.
 *
 * Kept in sync with `sharedMainAreaChildren` (paths) + the personal-only list
 * in router configs. If you add a new root path segment, add it here too.
 */
const RESERVED_FIRST_SEGMENTS = new Set([
  // Shared (mirrored under /:workspaceSlug too):
  'agent',
  'agents',
  'group',
  'community',
  'memory',
  'page',
  'project',
  'resource',
  'image',
  'video',
  'eval',
  'tasks',
  'task',
  // Personal-only:
  'acceptance',
  'settings',
  'admin',
  'downloads',
  'invite',
  'onboarding',
  'me',
  'share',
  'devtools',
  'desktop-onboarding',
]);

const FIRST_SEGMENT_REGEX = /^\/([^/?#]+)/;

const parseFirstSegment = (pathname: string): string | null => {
  const match = pathname.match(FIRST_SEGMENT_REGEX);
  return match ? match[1] : null;
};

/**
 * Whether `pathname`'s first segment could be an (as-yet-unresolved) workspace
 * slug — i.e. it's present and not one of the reserved root segments.
 *
 * Top-level rendering only needs to block on the workspace list (to avoid a
 * false 404 / wrong-scope paint) when this is `true`. On personal / reserved
 * routes (`/`, `/agent/...`, `/settings/...`) the list isn't required to render,
 * so callers can show personal context immediately and let the list hydrate in
 * the background.
 */
export const isWorkspaceSlugCandidatePath = (pathname: string): boolean => {
  const first = parseFirstSegment(pathname);
  return !!first && !RESERVED_FIRST_SEGMENTS.has(first);
};

export const resolveWorkspaceIdFromPath = (
  pathname: string,
  workspaces: { id: string; slug: string }[],
  isLoading: boolean,
): string | null | undefined => {
  if (!isWorkspaceSlugCandidatePath(pathname)) return null;
  if (isLoading) return undefined;

  const slug = parseFirstSegment(pathname);
  return workspaces.find((workspace) => workspace.slug === slug)?.id ?? null;
};

/**
 * URL is the source of truth for workspace context.
 *
 * - `/{slug}/...` where `slug` is a known workspace → activate that workspace
 * - `/` or `/agent/...` / `/settings/...` etc. (or any non-slug surface) → personal
 * - `/{unknown}/...` (slug not in workspaces) → clear workspace context while
 *   `WorkspaceSlugBoundary` renders its 404
 */
export const useWorkspaceUrlSync = (): void => {
  const pathname = useWorkspaceSyncPathname();
  const workspaces = useWorkspaces();
  const activeId = useActiveWorkspaceId();
  const isLoading = useIsWorkspaceLoading();
  // URL is a passive source, not an explicit user intent — use the silent
  // variant so refreshing or following a `/{slug}` link is not treated as
  // a user-driven switch.
  const { switchWorkspace, switchToPersonal } = useSilentSwitchWorkspace();

  // `useLayoutEffect` (not `useEffect`) so the workspace switch is scheduled
  // before the browser paints. With `useEffect` there is one paintable frame
  // between `isWorkspaceLoading: false` and `switchWorkspace()` running, which
  // causes downstream consumers (e.g. `WorkspaceContextSlot`) to briefly see
  // `isContextReady === true` and unhide stale children before the splash
  // re-asserts itself.
  useLayoutEffect(() => {
    // Defer until the workspace list has loaded so we don't briefly flip the
    // store to "personal" on first paint of a `/{slug}` URL.
    if (isLoading) return;

    const expectedWorkspaceId = resolveWorkspaceIdFromPath(pathname, workspaces, isLoading);
    if (expectedWorkspaceId === undefined) return;

    if (expectedWorkspaceId) {
      if (activeId !== expectedWorkspaceId) void switchWorkspace(expectedWorkspaceId);
      return;
    }

    // Personal routes and unknown slugs must not retain a previous workspace
    // header while their route boundary renders.
    if (activeId !== null) void switchToPersonal();
  }, [pathname, workspaces, isLoading, activeId, switchWorkspace, switchToPersonal]);
};
