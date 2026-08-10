import { useCacheScope } from '@/libs/swr/useCacheScope';
import { useHomeStore } from '@/store/home';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';

export const useIsAgentListScopeReady = () => {
  const scope = useCacheScope();

  return useHomeStore((s) => s.agentListScope === scope && s.isAgentListInit);
};

/**
 * Hook to fetch agent list
 * @returns isRevalidating - true when background revalidation is in progress (has cached data but fetching new)
 * @returns error - the thrown SWR error, so consumers can surface a failure state instead of a permanent skeleton
 * @returns mutate - retry the same request (wired into the error state's Retry)
 */
export const useFetchAgentList = () => {
  const isLogin = useUserStore(authSelectors.isLogin);
  const scope = useCacheScope();
  const useFetchAgentListHook = useHomeStore((s) => s.useFetchAgentList);
  const isScopeReady = useHomeStore((s) => s.agentListScope === scope && s.isAgentListInit);

  const { isValidating, data, error, mutate } = useFetchAgentListHook(isLogin, scope);

  return {
    error,
    isScopeReady,
    // isRevalidating: has cached data, updating in background
    isRevalidating: isValidating && !!data,
    mutate,
  };
};
