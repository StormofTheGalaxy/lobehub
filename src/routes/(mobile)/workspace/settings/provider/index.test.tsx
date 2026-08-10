import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MobileWorkspaceProviderSetting from './index';

vi.mock('@/features/Settings/provider/(list)', () => ({
  default: ({ mobile }: { mobile?: boolean }) => (
    <div data-testid="provider-page">{String(mobile)}</div>
  ),
}));

describe('MobileWorkspaceProviderSetting', () => {
  it('renders the provider feature in mobile mode', () => {
    render(<MobileWorkspaceProviderSetting />);

    expect(screen.getByTestId('provider-page')).toHaveTextContent('true');
  });
});
