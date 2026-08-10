import { type AgentItem, type LobeAgentConfig } from '@lobechat/types';
import { useEffect } from 'react';
import { type SWRResponse } from 'swr';
import { type PartialDeep } from 'type-fest';

import {
  getActiveWorkspaceId,
  useActiveWorkspaceId,
} from '@/business/client/hooks/useActiveWorkspaceId';
import { useOnlyFetchOnceSWR } from '@/libs/swr';
import { builtinAgentKeys } from '@/libs/swr/keys';
import { getCacheScope, useCacheScope } from '@/libs/swr/useCacheScope';
import { agentService } from '@/services/agent';
import { type StoreSetter } from '@/store/types';

import { type AgentStore } from '../../store';

interface UseInitBuiltinAgentContext {
  /**
   * Whether the user is logged in.
   * When false or undefined, the hook will not fetch the agent.
   */
  isLogin?: boolean;
}

/**
 * Builtin Agent Slice Actions
 * Handles initialization and management of builtin agents (page-agent, inbox, etc.)
 */

type Setter = StoreSetter<AgentStore>;
export const createBuiltinAgentSlice = (set: Setter, get: () => AgentStore, _api?: unknown) =>
  new BuiltinAgentSliceActionImpl(set, get, _api);

export class BuiltinAgentSliceActionImpl {
  readonly #get: () => AgentStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => AgentStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  refreshBuiltinAgent = async (slug: string): Promise<void> => {
    const workspaceId = getActiveWorkspaceId();
    const scope = getCacheScope();
    const data = await agentService.getBuiltinAgent(slug, workspaceId);
    if (getCacheScope() !== scope) return;

    if (data?.id) {
      this.#get().internal_dispatchAgentMap(data.id, data as PartialDeep<LobeAgentConfig>);
      // Mirror useInitBuiltinAgent's onSuccess: keep builtinAgentIdMap in sync
      // so callers can rely on this as a real "ensure" path instead of just a
      // post-init refresh.
      this.#set(
        {
          builtinAgentIdMap: { ...this.#get().builtinAgentIdMap, [slug]: data.id },
          builtinAgentScope: scope,
        },
        false,
        `refreshBuiltinAgent/${slug}`,
      );
    }
  };

  useInitBuiltinAgent = (
    slug: string,
    context?: UseInitBuiltinAgentContext,
  ): SWRResponse<AgentItem | null> => {
    const workspaceId = useActiveWorkspaceId();
    const scope = useCacheScope();

    useEffect(() => {
      if (this.#get().builtinAgentScope === scope) return;

      this.#set(
        { builtinAgentIdMap: {}, builtinAgentScope: scope },
        false,
        'useInitBuiltinAgent/scopeChanged',
      );
    }, [scope]);

    return useOnlyFetchOnceSWR(
      context?.isLogin === false ? null : builtinAgentKeys.init(slug, scope),
      async () => {
        const data = await agentService.getBuiltinAgent(slug, workspaceId);

        return data as AgentItem | null;
      },
      {
        onSuccess: (data: AgentItem | null) => {
          if (getCacheScope() !== scope) return;

          if (data?.id) {
            // Update builtinAgentIdMap with the agent id
            // Update agentMap with the agent config
            // AgentItem contains all fields needed for LobeAgentConfig
            this.#get().internal_dispatchAgentMap(data.id, data as PartialDeep<LobeAgentConfig>);

            this.#set(
              {
                builtinAgentIdMap: { ...this.#get().builtinAgentIdMap, [slug]: data.id },
                builtinAgentScope: scope,
              },
              false,
              `useInitBuiltinAgent/${slug}`,
            );
          }
        },
      },
    );
  };
}

export type BuiltinAgentSliceAction = Pick<
  BuiltinAgentSliceActionImpl,
  keyof BuiltinAgentSliceActionImpl
>;
