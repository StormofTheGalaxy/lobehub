'use client';

import { type PropsWithChildren, useLayoutEffect } from 'react';
import { useParams } from 'react-router';
import useSWR from 'swr';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import { setActiveWorkspaceSnapshot } from '@/business/client/hooks/workspaceState';
import { lambdaClient } from '@/libs/trpc/client';

interface WorkspaceListItem {
  id: string;
  slug: string;
}

export const resolveWorkbenchWorkspace = (
  workspaces: WorkspaceListItem[] | undefined,
  slug: string | undefined,
) => workspaces?.find((workspace) => workspace.slug === slug);

export default function WorkbenchWorkspaceContext({ children }: PropsWithChildren) {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const activeWorkspaceId = useActiveWorkspaceId();
  const { data, isLoading } = useSWR<WorkspaceListItem[]>(
    workspaceSlug ? ['workbench:workspaces', workspaceSlug] : null,
    () => lambdaClient.workspace.list.query(),
  );
  const workspace = resolveWorkbenchWorkspace(data, workspaceSlug);

  useLayoutEffect(() => {
    if (isLoading || !workspace || activeWorkspaceId === workspace.id) return;
    setActiveWorkspaceSnapshot({ id: workspace.id, slug: workspace.slug });
  }, [activeWorkspaceId, isLoading, workspace]);

  if (isLoading || !workspace || activeWorkspaceId !== workspace.id) return null;
  return children;
}
