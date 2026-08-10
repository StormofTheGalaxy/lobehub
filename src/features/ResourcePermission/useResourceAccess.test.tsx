import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResourceGeneralAccess } from '@/services/resourcePermission';
import { resourcePermissionService } from '@/services/resourcePermission';

import { useResourceAccess } from './useResourceAccess';

const testState = vi.hoisted(() => ({
  activeWorkspaceId: 'workspace-1' as string | null,
  data: undefined as ResourceGeneralAccess | undefined,
  fetcher: undefined as (() => Promise<unknown>) | undefined,
  swrKey: undefined as unknown,
}));

vi.mock('@/business/client/hooks/useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => testState.activeWorkspaceId,
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: (key: unknown, fetcher: () => Promise<unknown>) => {
    testState.fetcher = fetcher;
    testState.swrKey = key;

    return {
      data: testState.data,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    };
  },
}));

describe('useResourceAccess', () => {
  beforeEach(() => {
    testState.activeWorkspaceId = 'workspace-1';
    testState.data = undefined;
    testState.fetcher = undefined;
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
