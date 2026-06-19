import { useMemo } from 'react';

import { getActiveWorkspaceId, useActiveWorkspaceId } from './useActiveWorkspaceId';
import { useWorkspaces } from './useWorkspaces';

const RESERVED_FIRST_SEGMENTS = new Set([
  'agent',
  'agent-presets',
  'group',
  'community',
  'memory',
  'page',
  'resource',
  'image',
  'video',
  'eval',
  'tasks',
  'task',
  'settings',
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

export const getActiveWorkspaceSlug = (): string | null => {
  if (typeof window === 'undefined') return null;

  const activeWorkspaceId = getActiveWorkspaceId();
  const firstSegment = parseFirstSegment(window.location.pathname);
  if (!firstSegment || RESERVED_FIRST_SEGMENTS.has(firstSegment)) return null;

  if (activeWorkspaceId) {
    return firstSegment;
  }

  return firstSegment;
};

export const useActiveWorkspaceSlug = (): string | null => {
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaces = useWorkspaces();

  return useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.slug ?? null,
    [activeWorkspaceId, workspaces],
  );
};
