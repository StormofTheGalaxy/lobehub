import { createWorkspaceLambdaClient } from '@/libs/trpc/client';

export type PermissionResourceType = 'agent' | 'agentGroup' | 'document';
export type ResourceAccessLevel = 'edit' | 'use' | 'view';

export interface ResourceGeneralAccess {
  accessLevel: ResourceAccessLevel;
  canManage: boolean;
  creatorId: string;
  /** @deprecated Compatibility value returned for released clients. */
  generalAccess: 'editor' | 'viewer';
  visibility: 'private' | 'public';
}

class ResourcePermissionService {
  getGeneralAccess = async (
    resourceType: PermissionResourceType,
    resourceId: string,
    workspaceId: string,
  ): Promise<ResourceGeneralAccess> => {
    return createWorkspaceLambdaClient(workspaceId).resourcePermission.getGeneralAccess.query({
      resourceId,
      resourceType,
    });
  };

  setAccessLevel = async (
    resourceType: PermissionResourceType,
    resourceId: string,
    accessLevel: ResourceAccessLevel,
    workspaceId: string,
  ): Promise<ResourceGeneralAccess> => {
    return createWorkspaceLambdaClient(workspaceId).resourcePermission.setGeneralAccess.mutate({
      accessLevel,
      resourceId,
      resourceType,
    });
  };
}

export const resourcePermissionService = new ResourcePermissionService();
