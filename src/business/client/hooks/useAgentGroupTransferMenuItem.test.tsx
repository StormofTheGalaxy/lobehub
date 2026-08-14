import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentGroupTransferMenuItem } from './useAgentGroupTransferMenuItem';

const mocks = vi.hoisted(() => ({
  transferGroup: vi.fn(),
  useWorkspaceTransferItems: vi.fn((_params: Record<string, unknown>) => []),
}));

vi.mock('@/libs/swr/useCacheScope', () => ({ useCacheScope: () => 'scope' }));

vi.mock('@/libs/trpc/client', () => ({
  createWorkspaceLambdaClient: () => ({
    group: { transferGroup: { mutate: mocks.transferGroup } },
  }),
}));

vi.mock('@/store/home', () => ({
  useHomeStore: (selector: (state: unknown) => unknown) =>
    selector({ refreshAgentList: vi.fn() } as never),
}));

vi.mock('./useActiveWorkspaceId', () => ({ useActiveWorkspaceId: () => 'ws-1' }));

vi.mock('./useWorkspaceTransferItems', () => ({
  useWorkspaceTransferItems: mocks.useWorkspaceTransferItems,
}));

describe('useAgentGroupTransferMenuItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Group transfer stayed disabled here until upstream landed the
  // membership-lifecycle fix (#18126); the Move entry is safe again.
  it('offers a move action for a known group', () => {
    renderHook(() => useAgentGroupTransferMenuItem('group-1'));

    const params = mocks.useWorkspaceTransferItems.mock.calls[0][0];
    expect(params).toMatchObject({ enabled: true, move: expect.any(Function) });
  });

  it('stays disabled without a group id', () => {
    renderHook(() => useAgentGroupTransferMenuItem());

    expect(mocks.useWorkspaceTransferItems.mock.calls[0][0]).toMatchObject({ enabled: false });
  });

  it('routes the move through the source workspace client', async () => {
    renderHook(() => useAgentGroupTransferMenuItem('group-1'));

    const params = mocks.useWorkspaceTransferItems.mock.calls[0][0] as {
      move: (target: string | null) => Promise<void>;
    };
    await params.move('ws-2');

    expect(mocks.transferGroup).toHaveBeenCalledWith({
      groupId: 'group-1',
      targetWorkspaceId: 'ws-2',
    });
  });
});
