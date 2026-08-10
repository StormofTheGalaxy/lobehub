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
