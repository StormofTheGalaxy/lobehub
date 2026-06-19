import type { WorkspaceMemberItem } from '@lobechat/database/schemas';

import { useFetchWorkspaceMembers } from './useFetchWorkspaceMembers';

export const useWorkspaceMembers = (): WorkspaceMemberItem[] => {
  const { data } = useFetchWorkspaceMembers();

  return (data ?? []) as WorkspaceMemberItem[];
};
