import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import { useActiveWorkspaceId } from './useActiveWorkspaceId';

export interface FetchWorkspaceMembersOptions {
  includeDeleted?: boolean;
  workspaceId?: string;
}

export const useFetchWorkspaceMembers = (options: FetchWorkspaceMembersOptions = {}) => {
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaceId = options.workspaceId ?? activeWorkspaceId;

  return useSWR(
    workspaceId ? ['workspaceMember:list', workspaceId, options.includeDeleted] : null,
    () =>
      lambdaClient.workspaceMember.list.query({
        includeDeleted: options.includeDeleted,
        workspaceId: workspaceId!,
      }),
    { revalidateOnFocus: false },
  );
};
