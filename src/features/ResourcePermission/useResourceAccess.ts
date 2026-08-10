import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import { useClientDataSWR } from '@/libs/swr';
import type { PermissionResourceType } from '@/services/resourcePermission';
import { resourcePermissionService } from '@/services/resourcePermission';
import { isTrpcErrorCode } from '@/utils/trpcError';

// Same SWR key as useResourcePermission so both hooks share one fetch/cache entry.
const FETCH_RESOURCE_PERMISSION_KEY = 'resource-permission';

/**
 * Read-side derivation of the workspace General-access level for a resource.
 *
 * Edit/use checks stay permissive while workspace access is loading so chat
 * input does not flash disabled. A server-confirmed creator/admin (`canManage`)
 * bypasses the public resource's Member Permissions. Management checks are
 * deliberately fail-closed: destructive/ownership controls must not appear
 * until that access is confirmed. Personal mode keeps full access.
 */
export const useResourceAccess = (
  resourceType: PermissionResourceType,
  resourceId: string | undefined,
) => {
  const workspaceId = useActiveWorkspaceId();
  const enabled = !!workspaceId && !!resourceId;

  const { data, error, isLoading, mutate } = useClientDataSWR(
    enabled ? [FETCH_RESOURCE_PERMISSION_KEY, resourceType, resourceId] : null,
    () => resourcePermissionService.getGeneralAccess(resourceType, resourceId!, workspaceId!),
    { shouldRetryOnError: (error) => !isTrpcErrorCode(error, 'NOT_FOUND') },
  );

  return {
    accessError: error,
    canEditResource: !enabled || !data ? true : data.canManage || data.accessLevel === 'edit',
    canManageResource: !enabled || data?.canManage === true,
    canUseResource: !enabled || !data ? true : data.canManage || data.accessLevel !== 'view',
    isAccessResolved: !enabled || !!data,
    isLoading,
    retryAccess: mutate,
  };
};
