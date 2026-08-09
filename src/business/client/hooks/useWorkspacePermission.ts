import { useActiveWorkspace } from './useActiveWorkspace';

/**
 * Workspace management rights for the current member, mirroring the built-in
 * role matrix: Owner and Admin administer the workspace, Member and Viewer do
 * not. `super_admin` is the synthetic role `workspace.list` reports for
 * instance super-admins.
 *
 * Keep the client checks aligned with `assertWorkspaceAdmin` /
 * `assertWorkspaceOwner` on the server — a control shown to a role the API
 * rejects is worse than a hidden one.
 */
export const useWorkspaceManageRights = () => {
  const workspace = useActiveWorkspace();
  const role = workspace?.role;

  return {
    /** Settings, members, credentials, audit log. */
    canManage: role === 'owner' || role === 'admin' || role === 'super_admin',
    /** Money and ownership: credit balance, plans, deleting the workspace. */
    canOwn: role === 'owner' || role === 'super_admin',
    role,
  };
};
