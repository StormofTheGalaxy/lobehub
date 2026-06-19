import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import StarterList from './StarterList';

const navigate = vi.fn();
const mockState = vi.hoisted(() => ({
  canCreateContent: true,
  items: [
    { model: 'glm-5.2', provider: 'lobehub', title: 'GLM-5.2', type: 'chat' },
    { model: 'gpt-image-2', title: 'GPT Image 2', type: 'image' },
    { model: 'seedance-2', title: 'Seedance 2.0', type: 'video' },
  ],
  reason: 'No permission',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'starter.newLabel') return 'New';
      if (key === 'starter.modelInUse') return `${params?.name} is already in use`;
      if (key === 'starter.modelSwitched') return `Switched to ${params?.name}`;
      return key;
    },
  }),
}));

vi.mock('@lobehub/icons', () => ({
  ModelIcon: () => null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({ message: { info: vi.fn(), success: vi.fn() } }),
  },
}));

vi.mock('@/business/client/hooks/useBusinessAgentMode', () => ({
  useBusinessModelModeConfig: () => (config: unknown) => config,
}));

vi.mock('@/business/client/hooks/useHomeNewModels', () => ({
  useHomeNewModels: () => ({ isLoading: false, items: mockState.items }),
}));

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ allowed: mockState.canCreateContent, reason: mockState.reason }),
}));

vi.mock('@/hooks/useStableNavigate', () => ({
  useStableNavigate: () => navigate,
}));

vi.mock('@/services/agent', () => ({
  agentService: { getAgentConfigById: vi.fn() },
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      agentMap: {},
      internal_dispatchAgentMap: vi.fn(),
      updateAgentConfigById: vi.fn(),
    }),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentByIdSelectors: {
    getAgentEnableModeById: () => () => false,
    getAgentModelById: () => () => 'old-model',
    getAgentModelProviderById: () => () => 'old-provider',
  },
}));

vi.mock('../AgentSelect/useResolvedHomeAgentId', () => ({
  useResolvedHomeAgentId: () => ({ agentId: 'agent-1' }),
}));

vi.mock('./useStarterModelDefaults', () => ({
  useStarterModelDefaults: () => ({
    defaultHomeNewModels: mockState.items,
    fallbackChatProvider: 'lobehub',
  }),
}));

describe('StarterList', () => {
  afterEach(() => {
    navigate.mockReset();
    mockState.canCreateContent = true;
  });

  it('renders model-driven starter items', () => {
    render(<StarterList />);

    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GLM-5.2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GPT Image 2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Seedance 2.0/i })).toBeInTheDocument();
  });

  it('routes image and video starters to generation pages', () => {
    render(<StarterList />);

    fireEvent.click(screen.getByRole('button', { name: /GPT Image 2/i }));
    fireEvent.click(screen.getByRole('button', { name: /Seedance 2.0/i }));

    expect(navigate).toHaveBeenCalledWith('/image?model=gpt-image-2');
    expect(navigate).toHaveBeenCalledWith('/video?model=seedance-2');
  });

  it('disables starters when content creation is forbidden', () => {
    mockState.canCreateContent = false;

    render(<StarterList />);

    expect(screen.getByRole('button', { name: /GLM-5.2/i })).toBeDisabled();
  });
});
