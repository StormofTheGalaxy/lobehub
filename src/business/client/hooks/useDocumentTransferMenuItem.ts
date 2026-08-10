import type { ItemType } from 'antd/es/menu/interface';

import { lambdaClient } from '@/libs/trpc/client';

import { useWorkspaceTransferItems } from './useWorkspaceTransferItems';

export interface DocumentTransferMenuItemOptions {
  defaultTargetVisibility?: 'private' | 'public';
  preferCurrentWorkspace?: boolean;
  transferLabel?: string;
}

export const useDocumentTransferMenuItem = (
  documentId?: string,
  options?: DocumentTransferMenuItemOptions,
): ItemType[] | null => {
  const items = useWorkspaceTransferItems({
    copy: (targetWorkspaceId) =>
      lambdaClient.document.copyDocumentToWorkspace.mutate({
        documentId: documentId!,
        targetVisibility: options?.defaultTargetVisibility,
        targetWorkspaceId,
      }),
    enabled: !!documentId,
    move: (targetWorkspaceId) =>
      lambdaClient.document.transferDocument.mutate({
        documentId: documentId!,
        targetVisibility: options?.defaultTargetVisibility,
        targetWorkspaceId,
      }),
  });

  if (!items || !options?.transferLabel) return items;

  return items.map((item) =>
    item && 'key' in item && item.key === 'move-to-workspace'
      ? { ...item, label: options.transferLabel }
      : item,
  );
};
