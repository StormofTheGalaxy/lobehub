import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResourceGeneralAccess } from '@/services/resourcePermission';
import { resourcePermissionService } from '@/services/resourcePermission';

import { useResourceAccess } from './useResourceAccess';

const testState = vi.hoisted(() => ({
  activeWorkspaceId: 'workspace-1' as string | null,
  agentMap: {} as Record<string, { workspaceId?: string | null }>,
  data: undefined as ResourceGeneralAccess | undefined,
  documents: [] as { id: string; workspaceId?: string | null }[],
  fetcher: undefined as (() => Promise<unknown>) | undefined,
  groupMap: {} as Record<string, { workspaceId?: string | null }>,
  swrConfig: undefined as { shouldRetryOnError?: (error: unknown) => boolean } | undefined,
  swrKey: undefined as unknown,
}));

vi.mock('@/business/client/hooks/useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => testState.activeWorkspaceId,
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: (
    key: unknown,
    fetcher: () => Promise<unknown>,
    config?: { shouldRetryOnError?: (error: unknown) => boolean },
  ) => {
    testState.fetcher = fetcher;
    testState.swrConfig = config;
    testState.swrKey = key;

    return {
      data: testState.data,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    };
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

describe('useResourceAccess', () => {
  beforeEach(() => {
    testState.activeWorkspaceId = 'workspace-1';
    testState.agentMap = { 'agent-1': { workspaceId: 'workspace-1' } };
    testState.data = undefined;
    testState.documents = [];
    testState.fetcher = undefined;
    testState.groupMap = {};
    testState.swrConfig = undefined;
    testState.swrKey = undefined;
    vi.restoreAllMocks();
  });

  it('pins the workspace captured when the request was created', async () => {
    const getGeneralAccess = vi
      .spyOn(resourcePermissionService, 'getGeneralAccess')
      .mockResolvedValue({} as ResourceGeneralAccess);

    renderHook(() => useResourceAccess('agent', 'agent-1'));
    testState.activeWorkspaceId = null;
    await testState.fetcher?.();

    expect(getGeneralAccess).toHaveBeenCalledWith('agent', 'agent-1', 'workspace-1');
  });

  it('does not request workspace permissions in personal mode', () => {
    testState.activeWorkspaceId = null;

    renderHook(() => useResourceAccess('agent', 'agent-1'));

    expect(testState.swrKey).toBeNull();
  });

  it('keeps unbound and inbox inputs usable without requesting permissions', () => {
    const { result } = renderHook(() => useResourceAccess('agent', undefined));

    expect(testState.swrKey).toBeNull();
    expect(result.current).toMatchObject({
      canEditResource: true,
      canManageResource: true,
      canUseResource: true,
      isAccessResolved: true,
    });
  });

  it('does not automatically retry missing or cross-workspace resources', () => {
    renderHook(() => useResourceAccess('agent', 'agent-1'));

    expect(testState.swrConfig?.shouldRetryOnError?.({ data: { code: 'NOT_FOUND' } })).toBe(false);
    expect(
      testState.swrConfig?.shouldRetryOnError?.({ data: { code: 'INTERNAL_SERVER_ERROR' } }),
    ).toBe(true);
  });

  it('does not request permissions for an agent from another workspace', () => {
    testState.agentMap = { 'agent-1': { workspaceId: 'workspace-2' } };

    const { result } = renderHook(() => useResourceAccess('agent', 'agent-1'));

    expect(testState.swrKey).toBeNull();
    expect(result.current).toMatchObject({
      canEditResource: false,
      canManageResource: false,
      canUseResource: false,
      isAccessResolved: false,
    });
  });

  it('does not request permissions until resource ownership is known', () => {
    testState.agentMap = {};

    const { result } = renderHook(() => useResourceAccess('agent', 'agent-1'));

    expect(testState.swrKey).toBeNull();
    expect(result.current.isAccessResolved).toBe(false);
  });

  it('uses group ownership from the group store', () => {
    testState.groupMap = { 'group-1': { workspaceId: 'workspace-1' } };

    renderHook(() => useResourceAccess('agentGroup', 'group-1'));

    expect(testState.swrKey).not.toBeNull();
  });

  it('blocks documents from another workspace', () => {
    testState.documents = [{ id: 'document-1', workspaceId: 'workspace-2' }];

    renderHook(() => useResourceAccess('document', 'document-1'));

    expect(testState.swrKey).toBeNull();
  });

  it('uses authoritative sidebar workspace metadata before requesting permissions', () => {
    const personal = renderHook(() => useResourceAccess('agent', 'agent-1', null));

    expect(testState.swrKey).toBeNull();
    expect(personal.result.current.isAccessResolved).toBe(false);

    renderHook(() => useResourceAccess('agent', 'agent-1', 'workspace-1'));
    expect(testState.swrKey).not.toBeNull();
  });

  it('waits for a builtin slug to resolve to its workspace agent ID', () => {
    const { result } = renderHook(() => useResourceAccess('agent', 'inbox'));

    expect(testState.swrKey).toBeNull();
    expect(result.current.isAccessResolved).toBe(false);
  });

  it('does not apply view-only Member Permissions to an Agent author or admin', () => {
    testState.data = {
      accessLevel: 'view',
      canManage: true,
      creatorId: 'creator',
      generalAccess: 'viewer',
      visibility: 'public',
    };

    const { result } = renderHook(() => useResourceAccess('agent', 'agent-1'));

    expect(result.current).toMatchObject({
      canEditResource: true,
      canManageResource: true,
      canUseResource: true,
    });
  });

  it('still applies view-only Member Permissions to an ordinary member', () => {
    testState.data = {
      accessLevel: 'view',
      canManage: false,
      creatorId: 'creator',
      generalAccess: 'viewer',
      visibility: 'public',
    };

    const { result } = renderHook(() => useResourceAccess('agent', 'agent-1'));

    expect(result.current).toMatchObject({
      canEditResource: false,
      canManageResource: false,
      canUseResource: false,
    });
  });
});
