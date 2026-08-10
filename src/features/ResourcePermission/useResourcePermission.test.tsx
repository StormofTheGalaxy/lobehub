import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useResourcePermission } from './useResourcePermission';

const testState = vi.hoisted(() => ({
  activeWorkspaceId: 'workspace-1' as string | null,
  agentMap: {} as Record<string, { workspaceId?: string | null }>,
  documents: [] as { id: string; workspaceId?: string | null }[],
  groupMap: {} as Record<string, { workspaceId?: string | null }>,
  swrKey: undefined as unknown,
}));

vi.mock('@/business/client/hooks/useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => testState.activeWorkspaceId,
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: (key: unknown) => {
    testState.swrKey = key;
    return { data: undefined, error: undefined, isLoading: false, mutate: vi.fn() };
  },
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (state: typeof testState) => unknown) => selector(testState),
}));

vi.mock('@/store/agentGroup', () => ({
  useAgentGroupStore: (selector: (state: typeof testState) => unknown) => selector(testState),
}));

vi.mock('@/store/page', () => ({
  usePageStore: (selector: (state: typeof testState) => unknown) => selector(testState),
}));

describe('useResourcePermission', () => {
  beforeEach(() => {
    testState.activeWorkspaceId = 'workspace-1';
    testState.agentMap = {};
    testState.documents = [];
    testState.groupMap = {};
    testState.swrKey = undefined;
  });

  it('waits until the resource workspace is known', () => {
    renderHook(() => useResourcePermission('agent', 'agent-1'));

    expect(testState.swrKey).toBeNull();
  });

  it('loads permissions only for a resource in the active workspace', () => {
    testState.agentMap = { 'agent-1': { workspaceId: 'workspace-1' } };

    renderHook(() => useResourcePermission('agent', 'agent-1'));

    expect(testState.swrKey).not.toBeNull();
  });

  it('blocks a stale resource from another workspace', () => {
    testState.groupMap = { 'group-1': { workspaceId: 'workspace-2' } };

    renderHook(() => useResourcePermission('agentGroup', 'group-1'));

    expect(testState.swrKey).toBeNull();
  });
});
