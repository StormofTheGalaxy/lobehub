import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentService } from './agent';
import { homeService } from './home';
import { resourcePermissionService } from './resourcePermission';
import { workspaceUserSettingsService } from './workspaceUserSettings';

const mocks = vi.hoisted(() => ({
  createWorkspaceLambdaClient: vi.fn(),
  getBuiltinAgent: vi.fn(),
  getGeneralAccess: vi.fn(),
  getPreference: vi.fn(),
  getSidebarAgentList: vi.fn(),
  searchAgents: vi.fn(),
  setGeneralAccess: vi.fn(),
  updatePreference: vi.fn(),
}));

vi.mock('@/libs/trpc/client', () => ({
  createWorkspaceLambdaClient: mocks.createWorkspaceLambdaClient,
  lambdaClient: {
    agent: { getBuiltinAgent: { query: mocks.getBuiltinAgent } },
  },
}));

describe('workspace-scoped services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createWorkspaceLambdaClient.mockReturnValue({
      agent: { getBuiltinAgent: { query: mocks.getBuiltinAgent } },
      home: {
        getSidebarAgentList: { query: mocks.getSidebarAgentList },
        searchAgents: { query: mocks.searchAgents },
      },
      resourcePermission: {
        getGeneralAccess: { query: mocks.getGeneralAccess },
        setGeneralAccess: { mutate: mocks.setGeneralAccess },
      },
      workspaceUserSettings: {
        getPreference: { query: mocks.getPreference },
        updatePreference: { mutate: mocks.updatePreference },
      },
    });
  });

  it('pins builtin agent provisioning to its workspace', async () => {
    await agentService.getBuiltinAgent('inbox', 'workspace-3');

    expect(mocks.createWorkspaceLambdaClient).toHaveBeenCalledWith('workspace-3');
    expect(mocks.getBuiltinAgent).toHaveBeenCalledWith({ slug: 'inbox' });
  });

  it('pins resource permission requests to their workspace', async () => {
    await resourcePermissionService.getGeneralAccess('agent', 'agent-1', 'workspace-1');

    expect(mocks.createWorkspaceLambdaClient).toHaveBeenCalledWith('workspace-1');
    expect(mocks.getGeneralAccess).toHaveBeenCalledWith({
      resourceId: 'agent-1',
      resourceType: 'agent',
    });
  });

  it('pins home list and search requests to their workspace', async () => {
    await homeService.getSidebarAgentList('workspace-1');
    await homeService.searchAgents('agent', 'workspace-1');

    expect(mocks.createWorkspaceLambdaClient).toHaveBeenCalledWith('workspace-1');
    expect(mocks.getSidebarAgentList).toHaveBeenCalledWith();
    expect(mocks.searchAgents).toHaveBeenCalledWith({ keyword: 'agent' });
  });

  it('pins workspace preference requests to their workspace', async () => {
    await workspaceUserSettingsService.getPreference('workspace-2');

    expect(mocks.createWorkspaceLambdaClient).toHaveBeenCalledWith('workspace-2');
    expect(mocks.getPreference).toHaveBeenCalledWith();
  });
});
