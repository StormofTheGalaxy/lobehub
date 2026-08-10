import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resourcePermissionService } from './resourcePermission';
import { workspaceUserSettingsService } from './workspaceUserSettings';

const mocks = vi.hoisted(() => ({
  createWorkspaceLambdaClient: vi.fn(),
  getGeneralAccess: vi.fn(),
  getPreference: vi.fn(),
  setGeneralAccess: vi.fn(),
  updatePreference: vi.fn(),
}));

vi.mock('@/libs/trpc/client', () => ({
  createWorkspaceLambdaClient: mocks.createWorkspaceLambdaClient,
}));

describe('workspace-scoped services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createWorkspaceLambdaClient.mockReturnValue({
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

  it('pins resource permission requests to their workspace', async () => {
    await resourcePermissionService.getGeneralAccess('agent', 'agent-1', 'workspace-1');

    expect(mocks.createWorkspaceLambdaClient).toHaveBeenCalledWith('workspace-1');
    expect(mocks.getGeneralAccess).toHaveBeenCalledWith({
      resourceId: 'agent-1',
      resourceType: 'agent',
    });
  });

  it('pins workspace preference requests to their workspace', async () => {
    await workspaceUserSettingsService.getPreference('workspace-2');

    expect(mocks.createWorkspaceLambdaClient).toHaveBeenCalledWith('workspace-2');
    expect(mocks.getPreference).toHaveBeenCalledWith();
  });
});
