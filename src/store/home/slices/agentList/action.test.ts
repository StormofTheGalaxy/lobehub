import type { SidebarAgentListResponse } from '@lobechat/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentListActionImpl } from './action';
import { initialAgentListState } from './initialState';

const mocks = vi.hoisted(() => ({
  activeScope: 'user-1:workspace-1',
  activeWorkspaceId: 'workspace-1' as string | null,
  fetcher: undefined as (() => Promise<unknown>) | undefined,
  getSidebarAgentList: vi.fn(),
  mutateInWorkspace: vi.fn(),
  onData: undefined as ((data: SidebarAgentListResponse) => void) | undefined,
  useClientDataSWRWithSync: vi.fn(),
}));

vi.mock('@/business/client/hooks/useActiveWorkspaceId', () => ({
  getActiveWorkspaceId: () => mocks.activeWorkspaceId,
  useActiveWorkspaceId: () => mocks.activeWorkspaceId,
}));

vi.mock('@/libs/swr', () => ({
  mutateInWorkspace: mocks.mutateInWorkspace,
  useClientDataSWR: vi.fn(),
  useClientDataSWRWithSync: mocks.useClientDataSWRWithSync,
}));

vi.mock('@/libs/swr/useCacheScope', () => ({
  getCacheScope: () => mocks.activeScope,
}));

vi.mock('@/services/home', () => ({
  homeService: { getSidebarAgentList: mocks.getSidebarAgentList, searchAgents: vi.fn() },
}));

vi.mock('@/store/agent', () => ({
  getAgentStoreState: () => ({ invalidateAvailableAgents: vi.fn() }),
}));

const response = (id: string): SidebarAgentListResponse =>
  ({
    groups: [],
    pinned: [
      {
        id,
        pinned: true,
        title: id,
        type: 'agent',
        updatedAt: new Date('2026-08-10T00:00:00.000Z'),
      },
    ],
    privateGroups: [],
    privatePinned: [],
    privateUngrouped: [],
    ungrouped: [],
  }) as SidebarAgentListResponse;

describe('AgentListActionImpl', () => {
  let state = { ...initialAgentListState };
  let action: AgentListActionImpl;

  beforeEach(() => {
    state = { ...initialAgentListState };
    action = new AgentListActionImpl(
      ((patch: Partial<typeof state>) => Object.assign(state, patch)) as never,
      () => state as never,
    );
    mocks.activeScope = 'user-1:workspace-1';
    mocks.activeWorkspaceId = 'workspace-1';
    mocks.fetcher = undefined;
    mocks.onData = undefined;
    mocks.useClientDataSWRWithSync.mockImplementation((_key, fetcher, options) => {
      mocks.fetcher = fetcher;
      mocks.onData = options?.onData;
      return { data: undefined, isValidating: false, mutate: vi.fn() };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('clears the previous scope before the replacement list arrives', () => {
    Object.assign(state, {
      agentListScope: 'user-1:personal',
      isAgentListInit: true,
      pinnedAgents: response('personal-agent').pinned,
    });

    renderHook(() => action.useFetchAgentList(true, 'user-1:workspace-1'));

    expect(state.agentListScope).toBe('user-1:workspace-1');
    expect(state.isAgentListInit).toBe(false);
    expect(state.pinnedAgents).toEqual([]);
  });

  it('ignores a response from a scope that is no longer active', () => {
    mocks.activeScope = 'user-1:workspace-2';
    renderHook(() => action.useFetchAgentList(true, 'user-1:workspace-1'));

    act(() => mocks.onData?.(response('stale-agent')));

    expect(state.pinnedAgents).toEqual([]);
    expect(state.isAgentListInit).toBe(false);
  });

  it('publishes data only for the matching active scope', () => {
    renderHook(() => action.useFetchAgentList(true, 'user-1:workspace-1'));

    act(() => mocks.onData?.(response('workspace-agent')));

    expect(state.agentListScope).toBe('user-1:workspace-1');
    expect(state.isAgentListInit).toBe(true);
    expect(state.pinnedAgents).toEqual(response('workspace-agent').pinned);
  });

  it('pins the list request to the workspace captured by the hook', async () => {
    mocks.getSidebarAgentList.mockResolvedValue(response('workspace-agent'));
    renderHook(() => action.useFetchAgentList(true, 'user-1:workspace-1', 'workspace-1'));

    await mocks.fetcher?.();

    expect(mocks.getSidebarAgentList).toHaveBeenCalledWith('workspace-1');
  });

  it('refreshes the explicitly captured source scope', async () => {
    await action.refreshAgentList('user-1:workspace-1', 'workspace-1');

    expect(mocks.mutateInWorkspace).toHaveBeenCalledWith('workspace-1', [
      'home:sidebarAgentList:v3',
      true,
      'user-1:workspace-1',
    ]);
  });

  it('clears stale source data when its workspace is no longer active', async () => {
    mocks.activeScope = 'user-1:workspace-2';
    mocks.activeWorkspaceId = 'workspace-2';

    await action.refreshAgentList('user-1:workspace-1', 'workspace-1');

    expect(mocks.mutateInWorkspace).toHaveBeenCalledWith(
      'workspace-1',
      ['home:sidebarAgentList:v3', true, 'user-1:workspace-1'],
      undefined,
      { revalidate: false },
    );
  });
});
