import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import { WORKSPACES_SWR_KEY } from './useWorkspaces';

export const useIsWorkspaceLoading = (): boolean => {
  const { isLoading } = useSWR(WORKSPACES_SWR_KEY, () => lambdaClient.workspace.list.query(), {
    revalidateOnFocus: false,
  });

  return isLoading;
};
