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
 * Membership row enriched with the member's display profile. Flat columns are
 * retained for the settings roster while shared UI reads the nested profile.
 */
export type WorkspaceMemberWithProfile = WorkspaceMemberItem & {
  user?: WorkspaceMemberUserProfile | null;
} & Pick<UserItem, 'email' | 'normalizedEmail' | 'username'>;

export const useWorkspaceMembers = (): WorkspaceMemberWithProfile[] => {
  const workspaceId = useActiveWorkspaceId();
  const { data } = useSWR(workspaceId ? ['business/workspace-members', workspaceId] : null, () =>
    lambdaClient.workspaceMember.list.query({ workspaceId: workspaceId! }),
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
