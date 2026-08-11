import { describe, expect, it } from 'vitest';

import { resolveScopedPermissionCodes } from './rbacPermissionCodes';

describe('resolveScopedPermissionCodes', () => {
  it('expands resource actions into all and owner alternatives', () => {
    expect(resolveScopedPermissionCodes('file:upload')).toEqual([
      'file:upload:all',
      'file:upload:owner',
    ]);
  });

  it('preserves an exact scoped permission', () => {
    expect(resolveScopedPermissionCodes('workspace:delete:all')).toEqual(['workspace:delete:all']);
  });
});
