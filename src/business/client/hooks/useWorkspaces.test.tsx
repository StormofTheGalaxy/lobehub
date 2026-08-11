import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaces } from './useWorkspaces';

const mocks = vi.hoisted(() => ({
  activeId: 'workspace-1' as string | null,
  error: undefined as Error | undefined,
  isLoading: true,
  setActiveWorkspaceSnapshot: vi.fn(),
  workspaces: [] as { id: string; slug: string }[],
}));

vi.mock('swr', () => ({
  default: () => ({
    data: mocks.workspaces,
    error: mocks.error,
    isLoading: mocks.isLoading,
  }),
}));

vi.mock('@/store/user', () => ({
  useUserStore: () => true,
}));

vi.mock('./workspaceState', () => ({
  getWorkspaceSnapshot: () => ({ id: mocks.activeId, slug: null }),
  hydrateActiveWorkspaceId: () => mocks.activeId,
  setActiveWorkspaceSnapshot: mocks.setActiveWorkspaceSnapshot,
}));

describe('useWorkspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeId = 'workspace-1';
    mocks.error = undefined;
    mocks.isLoading = true;
    mocks.workspaces = [];
  });

  it('does not clear persisted workspace scope while the list is loading', () => {
    renderHook(() => useWorkspaces());

    expect(mocks.setActiveWorkspaceSnapshot).not.toHaveBeenCalled();
  });

  it('hydrates the validated workspace after the list loads', () => {
    mocks.isLoading = false;
    mocks.workspaces = [{ id: 'workspace-1', slug: 'acme' }];

    renderHook(() => useWorkspaces());

    expect(mocks.setActiveWorkspaceSnapshot).toHaveBeenCalledWith({
      id: 'workspace-1',
      slug: 'acme',
    });
  });

  it('clears a persisted workspace only after a successful list response', () => {
    mocks.isLoading = false;

    renderHook(() => useWorkspaces());

    expect(mocks.setActiveWorkspaceSnapshot).toHaveBeenCalledWith({ id: null, slug: null });
  });
});
