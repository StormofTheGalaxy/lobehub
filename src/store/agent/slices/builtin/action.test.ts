import type { AgentItem } from '@lobechat/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BuiltinAgentSliceActionImpl } from './action';
import { initialBuiltinAgentSliceState } from './initialState';

const mocks = vi.hoisted(() => ({
  activeScope: 'user-1:workspace-1',
  activeWorkspaceId: 'workspace-1' as string | null,
  getBuiltinAgent: vi.fn(),
  onSuccess: undefined as ((data: AgentItem | null) => void) | undefined,
  useOnlyFetchOnceSWR: vi.fn(),
}));

vi.mock('@/business/client/hooks/useActiveWorkspaceId', () => ({
  getActiveWorkspaceId: () => mocks.activeWorkspaceId,
  useActiveWorkspaceId: () => mocks.activeWorkspaceId,
}));

vi.mock('@/libs/swr', () => ({
  useOnlyFetchOnceSWR: mocks.useOnlyFetchOnceSWR,
}));

vi.mock('@/libs/swr/useCacheScope', () => ({
  getCacheScope: () => mocks.activeScope,
  useCacheScope: () => mocks.activeScope,
}));

vi.mock('@/services/agent', () => ({
  agentService: { getBuiltinAgent: mocks.getBuiltinAgent },
}));

describe('BuiltinAgentSliceActionImpl', () => {
  let state = {
    ...initialBuiltinAgentSliceState,
    internal_dispatchAgentMap: vi.fn(),
  };
  let action: BuiltinAgentSliceActionImpl;

  beforeEach(() => {
    state = {
      ...initialBuiltinAgentSliceState,
      internal_dispatchAgentMap: vi.fn(),
    };
    action = new BuiltinAgentSliceActionImpl(
      ((patch: Partial<typeof state>) => Object.assign(state, patch)) as never,
      () => state as never,
    );
    mocks.activeScope = 'user-1:workspace-1';
    mocks.activeWorkspaceId = 'workspace-1';
    mocks.onSuccess = undefined;
    mocks.useOnlyFetchOnceSWR.mockImplementation((_key, _fetcher, options) => {
      mocks.onSuccess = options?.onSuccess;
      return { data: undefined, isValidating: false, mutate: vi.fn() };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('clears builtin IDs produced by the previous scope', () => {
    Object.assign(state, {
      builtinAgentIdMap: { inbox: 'agent-from-personal' },
      builtinAgentScope: 'user-1:personal',
    });

    renderHook(() => action.useInitBuiltinAgent('inbox'));

    expect(state.builtinAgentScope).toBe('user-1:workspace-1');
    expect(state.builtinAgentIdMap).toEqual({});
  });

  it('ignores builtin IDs returned after the active scope changed', () => {
    renderHook(() => action.useInitBuiltinAgent('inbox'));
    mocks.activeScope = 'user-1:workspace-2';

    act(() => mocks.onSuccess?.({ id: 'agent-from-workspace-1' } as AgentItem));

    expect(state.builtinAgentIdMap).toEqual({});
  });

  it('stores builtin IDs only for the matching scope', () => {
    renderHook(() => action.useInitBuiltinAgent('inbox'));

    act(() => mocks.onSuccess?.({ id: 'agent-from-workspace-1' } as AgentItem));

    expect(state.builtinAgentScope).toBe('user-1:workspace-1');
    expect(state.builtinAgentIdMap).toEqual({ inbox: 'agent-from-workspace-1' });
  });

  it('replaces IDs from a previous scope when refresh resolves first', async () => {
    Object.assign(state, {
      builtinAgentIdMap: { 'page-agent': 'agent-from-personal' },
      builtinAgentScope: 'user-1:personal',
    });
    mocks.getBuiltinAgent.mockResolvedValue({ id: 'agent-from-workspace-1' });

    await action.refreshBuiltinAgent('inbox');

    expect(state.builtinAgentScope).toBe('user-1:workspace-1');
    expect(state.builtinAgentIdMap).toEqual({ inbox: 'agent-from-workspace-1' });
  });
});
