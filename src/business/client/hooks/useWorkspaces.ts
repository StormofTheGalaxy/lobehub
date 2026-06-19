import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import type { WorkspaceListItem } from './useActiveWorkspace';

export const WORKSPACES_SWR_KEY = 'workspace:list';

export const useWorkspaces = (): WorkspaceListItem[] => {
  const { data } = useSWR(WORKSPACES_SWR_KEY, () => lambdaClient.workspace.list.query(), {
    revalidateOnFocus: false,
  });

  return (data ?? []) as WorkspaceListItem[];
};
