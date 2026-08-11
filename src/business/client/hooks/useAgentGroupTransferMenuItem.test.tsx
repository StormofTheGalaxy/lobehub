import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAgentGroupTransferMenuItem } from './useAgentGroupTransferMenuItem';

describe('useAgentGroupTransferMenuItem', () => {
  it('does not expose the unsafe transfer action', () => {
    const { result } = renderHook(() => useAgentGroupTransferMenuItem('group-1'));

    expect(result.current).toBeNull();
  });
});
