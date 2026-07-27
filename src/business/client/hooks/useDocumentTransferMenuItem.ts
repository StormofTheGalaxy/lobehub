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
  _options?: DocumentTransferMenuItemOptions,
): ItemType[] | null =>
  useWorkspaceTransferItems({
    copy: (targetWorkspaceId) =>
      lambdaClient.document.copyDocumentToWorkspace.mutate({
        documentId: documentId!,
        targetWorkspaceId,
      }),
    enabled: !!documentId,
    move: (targetWorkspaceId) =>
      lambdaClient.document.transferDocument.mutate({ documentId: documentId!, targetWorkspaceId }),
  });
