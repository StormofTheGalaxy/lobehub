import type { WorkspaceItem } from '@lobechat/database/schemas';
import { useMemo } from 'react';

import { useActiveWorkspaceId } from './useActiveWorkspaceId';
import { useWorkspaces } from './useWorkspaces';

export type WorkspaceListItem = WorkspaceItem & { plan?: 'hobby' | 'pro'; role?: string };

export const useActiveWorkspace = (): WorkspaceListItem | null => {
  const activeId = useActiveWorkspaceId();
  const workspaces = useWorkspaces();

  return useMemo(
    () => workspaces.find((workspace) => workspace.id === activeId) ?? null,
    [activeId, workspaces],
  );
};
