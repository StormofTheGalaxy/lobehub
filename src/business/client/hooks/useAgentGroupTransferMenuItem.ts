import type { ItemType } from 'antd/es/menu/interface';

import { useCacheScope } from '@/libs/swr/useCacheScope';
import { createWorkspaceLambdaClient } from '@/libs/trpc/client';
import { useHomeStore } from '@/store/home';

import { useActiveWorkspaceId } from './useActiveWorkspaceId';
import { useWorkspaceTransferItems } from './useWorkspaceTransferItems';

interface AgentGroupTransferMeta {
  avatar?: string | null;
  backgroundColor?: string | null;
  description?: string | null;
  memberAvatars?: { avatar?: string; background?: string }[];
  title?: string | null;
}

/**
 * Move a chat group (and the agents / conversations it owns) to another
 * workspace. The server rehomes group membership in the same transaction and
 * refuses the move when a member agent is inaccessible in the target, so the
 * menu only has to report the outcome — `useWorkspaceTransferItems` does that.
 */
export const useAgentGroupTransferMenuItem = (
  groupId?: string,
  _providedGroupMeta?: AgentGroupTransferMeta,
): ItemType[] | null => {
  const sourceWorkspaceId = useActiveWorkspaceId();
  const sourceScope = useCacheScope();
  const refreshAgentList = useHomeStore((s) => s.refreshAgentList);

  return useWorkspaceTransferItems({
    enabled: !!groupId,
    move: async (targetWorkspaceId) => {
      const client = createWorkspaceLambdaClient(sourceWorkspaceId);
      await client.group.transferGroup.mutate({ groupId: groupId!, targetWorkspaceId });
      await refreshAgentList(sourceScope, sourceWorkspaceId);
    },
  });
};
