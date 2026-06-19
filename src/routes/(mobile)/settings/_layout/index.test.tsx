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

vi.mock('@/components/server/MobileNavLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('./Header', () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock('../../../(main)/settings/_layout/ContextProvider', () => ({
  default: settingsContextProviderMock,
}));

import MobileSettingsWrapper from './index';

describe('Mobile settings layout', () => {
  it('passes OpenAI field feature flags into settings context', () => {
    render(
      <ServerConfigStoreProvider
        featureFlags={{ openai_api_key: false, openai_proxy_url: false }}
      >
        <MobileSettingsWrapper />
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
