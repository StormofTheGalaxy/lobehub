import { useActiveLocation } from '@/hooks/useActiveLocation';
import { usePathname, useSearchParams } from '@/libs/router/navigation';
import { ProfileTabs, SettingsTabs, SidebarTabKey } from '@/store/global/initialState';

interface ActiveTabKeyOptions {
  activeWorkspaceSlug?: string;
  rootTabKey?: SidebarTabKey;
}

export const getWorkspaceNormalizedPathname = (pathname: string, activeWorkspaceSlug?: string) => {
  if (!activeWorkspaceSlug) return pathname;

  const workspacePrefix = `/${activeWorkspaceSlug}`;
  if (pathname === workspacePrefix || pathname === `${workspacePrefix}/`) return '/';
  if (!pathname.startsWith(`${workspacePrefix}/`)) return pathname;

  return pathname.slice(workspacePrefix.length) || '/';
};

export const getActiveTabKeyFromPathname = (
  pathname: string,
  options: ActiveTabKeyOptions = {},
) => {
  const normalizedPathname = getWorkspaceNormalizedPathname(pathname, options.activeWorkspaceSlug);
  const firstSegment = normalizedPathname.split('/').find(Boolean);

  if (!firstSegment) return options.rootTabKey ?? SidebarTabKey.Home;
  if (firstSegment === 'agent') return SidebarTabKey.Chat;

  return firstSegment as SidebarTabKey;
};

/**
 * Returns the active tab key (chat/market/settings/...)
 * React Router version for SPA
 */
export const useActiveTabKey = (options: ActiveTabKeyOptions = {}) => {
  // Pathname source is upstream's `useActiveLocation`; the segment mapping stays
  // the fork's `getActiveTabKeyFromPathname`, which strips the `/:slug` workspace
  // prefix before picking the tab (upstream has no workspace-scoped URLs).
  const { pathname } = useActiveLocation();
  return getActiveTabKeyFromPathname(pathname, options);
};

/**
 * Returns the active setting page key (?active=common/sync/agent/...)
 * React Router version for SPA
 */
export const useActiveSettingsKey = () => {
  const [searchParams] = useSearchParams();
  const tabs = searchParams.get('active');
  if (!tabs) return SettingsTabs.Appearance;
  return tabs as SettingsTabs;
};

/**
 * Returns the active profile page key (profile/security/stats/...)
 * React Router version for SPA
 */
export const useActiveProfileKey = () => {
  const pathname = usePathname();

  const tabs = pathname.split('/').at(-1);

  if (tabs === 'profile') return ProfileTabs.Profile;

  return tabs as ProfileTabs;
};
