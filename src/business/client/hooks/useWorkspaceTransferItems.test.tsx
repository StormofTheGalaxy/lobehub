import { renderHook } from '@testing-library/react';
import type { ItemType } from 'antd/es/menu/interface';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceTransferItems } from './useWorkspaceTransferItems';

const mocks = vi.hoisted(() => ({
  activeWorkspaceId: null as string | null,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  workspaces: [] as { id: string; name: string }[],
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Echo the key + interpolation so assertions read as the copy contract.
    t: (key: string, params?: Record<string, unknown>) =>
      params?.name ? `${key}:${params.name}` : key,
  }),
}));

vi.mock('./useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => mocks.activeWorkspaceId,
}));
vi.mock('./useWorkspaces', () => ({ useWorkspaces: () => mocks.workspaces }));

interface SubMenu {
  children: { key: string; label: string; onClick: () => void }[];
  key: string;
  label: string;
}

const asSubMenus = (items: ItemType[] | null) => (items ?? []) as unknown as SubMenu[];

describe('useWorkspaceTransferItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeWorkspaceId = 'ws-1';
    mocks.workspaces = [
      { id: 'ws-1', name: 'Current' },
      { id: 'ws-2', name: 'Other' },
    ];
  });

  it('labels the menu from i18n instead of hardcoded copy', () => {
    const { result } = renderHook(() =>
      useWorkspaceTransferItems({ copy: vi.fn(), move: vi.fn() }),
    );

    expect(asSubMenus(result.current).map((item) => item.label)).toEqual([
      'workspaceTransfer.moveTo',
      'workspaceTransfer.copyTo',
    ]);
  });

  it('excludes the active workspace and keeps personal as a target', () => {
    const { result } = renderHook(() => useWorkspaceTransferItems({ move: vi.fn() }));

    expect(asSubMenus(result.current)[0].children.map((child) => child.key)).toEqual([
      'move-personal',
      'move-ws-2',
    ]);
  });

  it('reports success so a completed move is not silent', async () => {
    const move = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useWorkspaceTransferItems({ move }));

    await asSubMenus(result.current)[0].children[1].onClick();

    expect(move).toHaveBeenCalledWith('ws-2');
    expect(mocks.toastSuccess).toHaveBeenCalledWith('workspaceTransfer.moveSuccess:Other');
  });

  it('reports a failed transfer instead of swallowing the rejection', async () => {
    const move = vi.fn().mockRejectedValue(new Error('No write access to target workspace'));
    const { result } = renderHook(() => useWorkspaceTransferItems({ move }));

    await asSubMenus(result.current)[0].children[1].onClick();

    expect(mocks.toastError).toHaveBeenCalledWith({
      description: 'No write access to target workspace',
      title: 'workspaceTransfer.moveError:Other',
    });
  });

  it('hides the menu entirely when there is nowhere to move to', () => {
    // Personal scope with no workspaces: the only candidate target is the
    // scope the resource already lives in.
    mocks.activeWorkspaceId = null;
    mocks.workspaces = [];
    const { result } = renderHook(() => useWorkspaceTransferItems({ move: vi.fn() }));

    expect(result.current).toBeNull();
  });
});
