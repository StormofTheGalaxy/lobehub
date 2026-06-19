import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ServerConfigStoreProvider } from '@/store/serverConfig/Provider';

const settingsContextProviderMock = vi.fn(
  ({ children }: { children: React.ReactNode; value: Record<string, unknown> }) => (
    <div>{children}</div>
  ),
);

vi.mock('react-router-dom', () => ({
  Outlet: () => <div data-testid="outlet" />,
}));

vi.mock('@/routes/(main)/settings/_layout/SideBar', () => ({
  default: () => <div data-testid="sidebar" />,
}));

vi.mock('./ContextProvider', () => ({
  default: settingsContextProviderMock,
}));

import Layout from './index';

describe('Settings layout', () => {
  it('passes OpenAI field feature flags into settings context', () => {
    render(
      <ServerConfigStoreProvider
        featureFlags={{ openai_api_key: false, openai_proxy_url: false }}
      >
        <Layout />
      </ServerConfigStoreProvider>,
    );

    expect(settingsContextProviderMock).toHaveBeenCalled();
    expect(settingsContextProviderMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        value: expect.objectContaining({
          showOpenAIApiKey: false,
          showOpenAIProxyUrl: false,
        }),
      }),
    );
  });
});
