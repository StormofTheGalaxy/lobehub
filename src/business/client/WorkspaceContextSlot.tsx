import { type PropsWithChildren } from 'react';

import { useWorkspaceSyncPathname } from '@/features/Workspace/useWorkspaceSyncPathname';
import {
  resolveWorkspaceIdFromPath,
  useWorkspaceUrlSync,
} from '@/features/Workspace/useWorkspaceUrlSync';

import { useActiveWorkspaceId } from './hooks/useActiveWorkspaceId';
import { useIsWorkspaceLoading } from './hooks/useIsWorkspaceLoading';
import { useWorkspaces } from './hooks/useWorkspaces';

export default function WorkspaceContextSlot({ children }: PropsWithChildren) {
  const activeWorkspaceId = useActiveWorkspaceId();
  const isWorkspaceLoading = useIsWorkspaceLoading();
  const pathname = useWorkspaceSyncPathname();
  const workspaces = useWorkspaces();
  useWorkspaceUrlSync();

  const expectedWorkspaceId = resolveWorkspaceIdFromPath(pathname, workspaces, isWorkspaceLoading);
  if (expectedWorkspaceId === undefined || activeWorkspaceId !== expectedWorkspaceId) return null;

  return (
    <div key={activeWorkspaceId ?? 'personal'} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
