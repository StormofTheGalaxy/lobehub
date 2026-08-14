import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTaskTransferMenuItem } from './useTaskTransferMenuItem';

const mocks = vi.hoisted(() => ({
  useWorkspaceTransferItems: vi.fn((_params: Record<string, unknown>) => []),
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: { task: { copyTaskToWorkspace: { mutate: vi.fn() } } },
}));

vi.mock('./useWorkspaceTransferItems', () => ({
  useWorkspaceTransferItems: mocks.useWorkspaceTransferItems,
}));

describe('useTaskTransferMenuItem', () => {
  // `task.transferTask` is a hard 400 upstream ("no longer supported; use
  // copyTaskToWorkspace instead") — offering a Move entry would only ever fail.
  it('offers copy only because task transfer is not supported', () => {
    renderHook(() => useTaskTransferMenuItem('task-1'));

    expect(mocks.useWorkspaceTransferItems).toHaveBeenCalledWith(
      expect.objectContaining({ copy: expect.any(Function), enabled: true }),
    );
    expect(mocks.useWorkspaceTransferItems.mock.calls[0][0]).not.toHaveProperty('move');
  });
});
