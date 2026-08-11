import type { ItemType } from 'antd/es/menu/interface';

interface AgentGroupTransferMeta {
  avatar?: string | null;
  backgroundColor?: string | null;
  description?: string | null;
  memberAvatars?: { avatar?: string; background?: string }[];
  title?: string | null;
}

/** Disabled until the upstream group-membership transfer lifecycle is merged. */
export const useAgentGroupTransferMenuItem = (
  _groupId?: string,
  _providedGroupMeta?: AgentGroupTransferMeta,
): ItemType[] | null => null;
