import { useMemo } from 'react';

import { useWorkspaceMembers } from './useWorkspaceMembers';

/**
 * userId → display profile for the members of the active workspace.
 *
 * Business slot. In personal mode (and in OSS, which has no workspace concept)
 * this is an empty map, so a home surface that resolves a topic's triggerer
 * through it simply renders no author — degrading to the personal inbox with no
 * extra branching.
 *
 * A workspace topic already carries `userId` (its creator / triggerer); this is
 * the client-side lookup that turns that id into a face and a name.
 */
export interface WorkspaceMemberProfile {
  avatar?: string | null;
  fullName?: string | null;
  username?: string | null;
}

const EMPTY: ReadonlyMap<string, WorkspaceMemberProfile> = new Map();

export const useWorkspaceMemberProfiles = (): ReadonlyMap<string, WorkspaceMemberProfile> => {
  // `useWorkspaceMembers` already returns an empty list outside a workspace, so
  // personal mode falls back to the shared empty map without an extra branch.
  const members = useWorkspaceMembers();

  return useMemo(() => {
    if (members.length === 0) return EMPTY;

    return new Map(
      members.map((member) => [
        member.userId,
        {
          avatar: member.user?.avatar,
          fullName: member.user?.fullName,
          username: member.user?.username,
        },
      ]),
    );
  }, [members]);
};
