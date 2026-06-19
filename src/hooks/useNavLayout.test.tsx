import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServerConfigStoreProvider } from '@/store/serverConfig/Provider';

interface GlobalStateMock {
  toggleCommandMenu: () => void;
}

const mocks = vi.hoisted(() => ({
  activeWorkspaceSlug: null as string | null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/config/routes', () => ({
  getRouteById: (id: string) => ({
    icon: () => id,
  }),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: (state: GlobalStateMock) => unknown) =>
    selector({ toggleCommandMenu: vi.fn() }),
}));

vi.mock('@/business/client/hooks/useActiveWorkspaceSlug', () => ({
  useActiveWorkspaceSlug: () => mocks.activeWorkspaceSlug,
}));

import { useNavLayout } from './useNavLayout';

describe('useNavLayout', () => {
  beforeEach(() => {
    mocks.activeWorkspaceSlug = null;
  });

  it('keeps Memory visible in personal mode', () => {
    const { result } = renderHook(() => useNavLayout());

    const memoryItem = result.current.bottomMenuItems.find((item) => item.key === 'memory');

    expect(memoryItem?.hidden).not.toBe(true);
  });

  it('hides Memory in workspace mode', () => {
    mocks.activeWorkspaceSlug = 'lobe-team';

    const { result } = renderHook(() => useNavLayout());

    const memoryItem = result.current.bottomMenuItems.find((item) => item.key === 'memory');

    expect(memoryItem?.hidden).toBe(true);
  });

  it('maps changelog and eval footer entries from feature flags', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ServerConfigStoreProvider featureFlags={{ changelog: false, rag_eval: true }}>
        {children}
      </ServerConfigStoreProvider>
    );

    const { result } = renderHook(() => useNavLayout(), { wrapper });

    expect(result.current.footer.showChangelog).toBe(false);
    expect(result.current.footer.showEvalEntry).toBe(true);
  });
});
