import type { ItemType } from 'antd/es/menu/interface';

import { lambdaClient } from '@/libs/trpc/client';

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
): ItemType[] | null =>
  useWorkspaceTransferItems({
    enabled: !!groupId,
    move: (targetWorkspaceId) =>
      lambdaClient.group.transferGroup.mutate({ groupId: groupId!, targetWorkspaceId }),
  });
