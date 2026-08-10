import type { MetaData } from '@lobechat/types';
import type { ItemType } from 'antd/es/menu/interface';

import { useCacheScope } from '@/libs/swr/useCacheScope';
import { createWorkspaceLambdaClient } from '@/libs/trpc/client';
import { useHomeStore } from '@/store/home';

import { useActiveWorkspaceId } from './useActiveWorkspaceId';
import { useWorkspaceTransferItems } from './useWorkspaceTransferItems';

export interface AgentTransferScope {
  userId?: string | null;
  visibility?: 'private' | 'public';
}

export const useAgentTransferMenuItem = (
  agentId?: string,
  _agentMeta?: MetaData,
  _scope?: AgentTransferScope,
): ItemType[] | null => {
  const sourceWorkspaceId = useActiveWorkspaceId();
  const sourceScope = useCacheScope();
  const refreshAgentList = useHomeStore((s) => s.refreshAgentList);

  return useWorkspaceTransferItems({
    enabled: !!agentId,
    move: async (targetWorkspaceId) => {
      const client = createWorkspaceLambdaClient(sourceWorkspaceId);
      await client.agent.transferAgent.mutate({ agentId: agentId!, targetWorkspaceId });
      await refreshAgentList(sourceScope, sourceWorkspaceId);
    },
  });
};
