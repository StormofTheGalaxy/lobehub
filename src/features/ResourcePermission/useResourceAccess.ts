import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';

import { useActiveWorkspaceId } from '@/business/client/hooks/useActiveWorkspaceId';
import { useClientDataSWR } from '@/libs/swr';
import type { PermissionResourceType } from '@/services/resourcePermission';
import { resourcePermissionService } from '@/services/resourcePermission';
import { useAgentStore } from '@/store/agent';
import { useAgentGroupStore } from '@/store/agentGroup';
import { usePageStore } from '@/store/page';
import { isTrpcErrorCode } from '@/utils/trpcError';

// Same SWR key as useResourcePermission so both hooks share one fetch/cache entry.
const FETCH_RESOURCE_PERMISSION_KEY = 'resource-permission';
const builtinAgentSlugs = new Set<string>(Object.values(BUILTIN_AGENT_SLUGS));

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
  resourceWorkspaceId?: string | null,
) => {
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
  const hasKnownResourceWorkspace =
    resourceWorkspaceId !== undefined || storedResourceWorkspaceId !== undefined;
  const unresolvedBuiltinSlug =
    resourceType === 'agent' && !!resourceId && builtinAgentSlugs.has(resourceId);
  const blockedByResourceScope =
    !!workspaceId &&
    (!hasKnownResourceWorkspace ||
      resolvedResourceWorkspaceId !== workspaceId ||
      unresolvedBuiltinSlug);
  const enabled = !!workspaceId && !!resourceId && !blockedByResourceScope;

  const { data, error, isLoading, mutate } = useClientDataSWR(
    enabled ? [FETCH_RESOURCE_PERMISSION_KEY, resourceType, resourceId] : null,
    () => resourcePermissionService.getGeneralAccess(resourceType, resourceId!, workspaceId!),
    { shouldRetryOnError: (error) => !isTrpcErrorCode(error, 'NOT_FOUND') },
  );

  return {
    accessError: error,
    canEditResource: blockedByResourceScope
      ? false
      : !enabled || !data
        ? true
        : data.canManage || data.accessLevel === 'edit',
    canManageResource: blockedByResourceScope ? false : !enabled || data?.canManage === true,
    canUseResource: blockedByResourceScope
      ? false
      : !enabled || !data
        ? true
        : data.canManage || data.accessLevel !== 'view',
    isAccessResolved: blockedByResourceScope ? false : !enabled || !!data,
    isLoading,
    retryAccess: mutate,
  };
};
