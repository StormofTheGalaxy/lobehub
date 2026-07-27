import type { UserItem, WorkspaceMemberItem } from '@lobechat/database/schemas';
import { useMemo } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import { useActiveWorkspaceId } from './useActiveWorkspaceId';

export interface WorkspaceMemberUserProfile {
  avatar?: string | null;
  email?: string | null;
  fullName?: string | null;
  username?: string | null;
}

/**
 * Membership row enriched with the member's display profile. The flat columns
 * are kept for the workspace-settings roster, while `user` carries the same
 * data in the shape shared UI (mentions, author columns) expects.
 */
export type WorkspaceMemberWithProfile = WorkspaceMemberItem &
  Pick<UserItem, 'email' | 'normalizedEmail' | 'username'> & {
    user?: WorkspaceMemberUserProfile | null;
  };

export const useWorkspaceMembers = (): WorkspaceMemberWithProfile[] => {
  const workspaceId = useActiveWorkspaceId();
  const { data } = useSWR(
    workspaceId ? ['business/workspace-members', workspaceId] : null,
    () => lambdaClient.workspaceMember.list.query({ workspaceId: workspaceId! }),
  );

  return useMemo(
    () =>
      (data ?? []).map((member) => ({
        ...member,
        user: {
          avatar: member.avatar,
          email: member.email,
          fullName: member.fullName,
          username: member.username,
        },
      })) as WorkspaceMemberWithProfile[],
    [data],
  );
};
