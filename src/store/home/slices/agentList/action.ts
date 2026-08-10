import isEqual from 'fast-deep-equal';
import { useEffect } from 'react';
import { type SWRResponse } from 'swr';

import {
  getActiveWorkspaceId,
  useActiveWorkspaceId,
} from '@/business/client/hooks/useActiveWorkspaceId';
import { type SidebarAgentItem, type SidebarAgentListResponse } from '@/database/repositories/home';
import { mutateInWorkspace, useClientDataSWR, useClientDataSWRWithSync } from '@/libs/swr';
import { agentConfigKeys, agentKeys } from '@/libs/swr/keys';
import { getCacheScope } from '@/libs/swr/useCacheScope';
import { homeService } from '@/services/home';
import { getAgentStoreState } from '@/store/agent';
import { type HomeStore } from '@/store/home/store';
import { type StoreSetter } from '@/store/types';
import { setNamespace } from '@/utils/storeDebug';

import { mapResponseToState } from './initialState';

const n = setNamespace('agentList');

const EMPTY_AGENT_LIST: SidebarAgentListResponse = {
  groups: [],
  pinned: [],
  privateGroups: [],
  privatePinned: [],
  privateUngrouped: [],
  ungrouped: [],
};

type Setter = StoreSetter<HomeStore>;
export const createAgentListSlice = (set: Setter, get: () => HomeStore, _api?: unknown) =>
  new AgentListActionImpl(set, get, _api);

export class AgentListActionImpl {
  readonly #get: () => HomeStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => HomeStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  closeAllAgentsDrawer = (): void => {
    this.#set({ allAgentsDrawerOpen: false }, false, n('closeAllAgentsDrawer'));
  };

  openAllAgentsDrawer = (): void => {
    this.#set({ allAgentsDrawerOpen: true }, false, n('openAllAgentsDrawer'));
  };

  refreshAgentList = async (
    scope = getCacheScope(),
    workspaceId = getActiveWorkspaceId(),
  ): Promise<void> => {
    getAgentStoreState().invalidateAvailableAgents();
    const key = [...agentKeys.list(true), scope];
    if (getCacheScope() === scope && getActiveWorkspaceId() === workspaceId) {
      await mutateInWorkspace(workspaceId, key);
      return;
    }

    await mutateInWorkspace(workspaceId, key, undefined, { revalidate: false });
  };

  useFetchAgentList = (
    isLogin: boolean | undefined,
    scope: string,
    workspaceId?: string | null,
  ): SWRResponse<SidebarAgentListResponse> => {
    useEffect(() => {
      if (this.#get().agentListScope === scope) return;

      this.#set(
        { ...mapResponseToState(EMPTY_AGENT_LIST), agentListScope: scope, isAgentListInit: false },
        false,
        n('useFetchAgentList/scopeChanged'),
      );
    }, [scope]);

    return useClientDataSWRWithSync<SidebarAgentListResponse>(
      isLogin === true ? [...agentKeys.list(isLogin), scope] : null,
      () => homeService.getSidebarAgentList(workspaceId),
      {
        onData: (data) => {
          if (getCacheScope() !== scope) return;

          const state = this.#get();
          const newState = mapResponseToState(data);

          // Skip update if data is the same
          if (
            state.isAgentListInit &&
            state.agentListScope === scope &&
            isEqual(state.pinnedAgents, newState.pinnedAgents) &&
            isEqual(state.agentGroups, newState.agentGroups) &&
            isEqual(state.ungroupedAgents, newState.ungroupedAgents) &&
            isEqual(state.privateAgentGroups, newState.privateAgentGroups) &&
            isEqual(state.privatePinnedAgents, newState.privatePinnedAgents) &&
            isEqual(state.privateUngroupedAgents, newState.privateUngroupedAgents)
          ) {
            return;
          }

          this.#set(
            {
              ...newState,
              agentListScope: scope,
              isAgentListInit: true,
            },
            false,
            n('useFetchAgentList/onData'),
          );
        },
      },
    );
  };

  useSearchAgents = (keyword?: string): SWRResponse<SidebarAgentItem[]> => {
    const workspaceId = useActiveWorkspaceId();

    return useClientDataSWR<SidebarAgentItem[]>(agentConfigKeys.search(keyword), async () => {
      if (!keyword) return [];

      return homeService.searchAgents(keyword, workspaceId);
    });
  };
}

export type AgentListAction = Pick<AgentListActionImpl, keyof AgentListActionImpl>;
