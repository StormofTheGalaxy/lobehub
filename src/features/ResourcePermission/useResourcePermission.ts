import { toast } from '@lobehub/ui/base-ui';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import { useClientDataSWR } from '@/libs/swr';
import type { PermissionResourceType, ResourceAccessLevel } from '@/services/resourcePermission';
import { resourcePermissionService } from '@/services/resourcePermission';
import { useAgentStore } from '@/store/agent';
import { useAgentGroupStore } from '@/store/agentGroup';
import { usePageStore } from '@/store/page';
import { isTrpcErrorCode } from '@/utils/trpcError';

const FETCH_RESOURCE_PERMISSION_KEY = 'resource-permission';

/**
 * State + handlers of the Permission panel: publicity and the workspace
 * General-access level (Notion-style Share).
 */
export const useResourcePermission = (
  resourceType: PermissionResourceType,
  resourceId: string | undefined,
  resourceWorkspaceId?: string | null,
) => {
  const { t } = useTranslation('setting');
  const workspaceId = useActiveWorkspaceId();
  const storedAgentWorkspaceId = useAgentStore((s) =>
    resourceType === 'agent' && resourceId ? s.agentMap[resourceId]?.workspaceId : undefined,
  );
  const storedGroupWorkspaceId = useAgentGroupStore((s) =>
    resourceType === 'agentGroup' && resourceId ? s.groupMap[resourceId]?.workspaceId : undefined,
  );
  const storedDocumentWorkspaceId = usePageStore((s) =>
    resourceType === 'document' && resourceId
      ? s.documents?.find((document) => document.id === resourceId)?.workspaceId
      : undefined,
  );
  const storedResourceWorkspaceId =
    resourceType === 'agent'
      ? storedAgentWorkspaceId
      : resourceType === 'agentGroup'
        ? storedGroupWorkspaceId
        : storedDocumentWorkspaceId;
  const resolvedResourceWorkspaceId =
    resourceWorkspaceId !== undefined ? resourceWorkspaceId : storedResourceWorkspaceId;
  const scopeMatches =
    !!workspaceId &&
    !!resourceId &&
    resolvedResourceWorkspaceId !== undefined &&
    resolvedResourceWorkspaceId === workspaceId;

  const [updating, setUpdating] = useState(false);

  const { data, error, isLoading, mutate } = useClientDataSWR(
    scopeMatches ? [FETCH_RESOURCE_PERMISSION_KEY, resourceType, resourceId] : null,
    () => resourcePermissionService.getGeneralAccess(resourceType, resourceId!, workspaceId!),
    { shouldRetryOnError: (error) => !isTrpcErrorCode(error, 'NOT_FOUND') },
  );

  const run = useCallback(
    async (
      action: () => Promise<Awaited<ReturnType<typeof resourcePermissionService.getGeneralAccess>>>,
      optimisticData: Awaited<ReturnType<typeof resourcePermissionService.getGeneralAccess>>,
    ) => {
      const previousData = data;
      setUpdating(true);
      await mutate(optimisticData, false);
      try {
        const result = await action();
        await mutate(result, false);
      } catch (e) {
        await mutate(previousData, false);
        console.error('[ResourcePermission]', e);
        toast.error((e as Error)?.message || t('permission.updateError'));
      } finally {
        setUpdating(false);
      }
    },
    [data, mutate, t],
  );

  const setAccessLevel = useCallback(
    (accessLevel: ResourceAccessLevel) => {
      if (!data) return;
      return run(
        () =>
          resourcePermissionService.setAccessLevel(
            resourceType,
            resourceId!,
            accessLevel,
            workspaceId!,
          ),
        {
          ...data,
          accessLevel,
          generalAccess: accessLevel === 'edit' ? 'editor' : 'viewer',
        },
      );
    },
    [data, run, resourceType, resourceId, workspaceId],
  );

  return {
    data,
    error,
    isLoading,
    /** Re-fetch — used by the Permission page to retry a failed load. */
    mutate,
    setAccessLevel,
    updating,
  };
};
