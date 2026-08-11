import { describe, expect, it } from 'vitest';

import { resolveWorkbenchWorkspace } from './WorkbenchWorkspaceContext';

describe('resolveWorkbenchWorkspace', () => {
  const workspaces = [
    { id: 'workspace-1', slug: 'acme' },
    { id: 'workspace-2', slug: 'beta' },
  ];

  it('resolves the workspace encoded in the document URL', () => {
    expect(resolveWorkbenchWorkspace(workspaces, 'beta')).toEqual(workspaces[1]);
  });

  it('does not reuse another workspace for an unknown slug', () => {
    expect(resolveWorkbenchWorkspace(workspaces, 'missing')).toBeUndefined();
  });
});
