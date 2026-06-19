import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SuggestQuestions from './index';

const mockState = vi.hoisted(() => ({
  showWelcomeSuggest: true,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          'home.suggestQuestions': 'Try these examples',
          switch: 'Switch',
        } as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('@/store/serverConfig', () => ({
  featureFlagsSelectors: (state: { featureFlags: { showWelcomeSuggest: boolean } }) =>
    state.featureFlags,
  useServerConfigStore: <T,>(
    selector: (state: { featureFlags: { showWelcomeSuggest: boolean } }) => T,
  ) =>
    selector({
      featureFlags: {
        showWelcomeSuggest: mockState.showWelcomeSuggest,
      },
    }),
}));

vi.mock('./useRandomQuestions', () => ({
  useRandomQuestions: () => ({
    questions: [{ id: 1, promptKey: 'agent.01.prompt', titleKey: 'agent.01.title' }],
    refresh: vi.fn(),
  }),
}));

vi.mock('./List', () => ({
  default: () => <div>Question List</div>,
}));

vi.mock('../components/GroupBlock', () => ({
  default: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

vi.mock('./Skeleton', () => ({
  default: () => <div>Loading</div>,
}));

describe('SuggestQuestions', () => {
  afterEach(() => {
    mockState.showWelcomeSuggest = true;
  });

  it('renders suggestions when the welcome flag is enabled', () => {
    render(<SuggestQuestions mode={null} />);

    expect(screen.getByText('Try these examples')).toBeInTheDocument();
    expect(screen.getByText('Question List')).toBeInTheDocument();
  });

  it('renders nothing when the welcome flag is disabled', () => {
    mockState.showWelcomeSuggest = false;

    const { container } = render(<SuggestQuestions mode={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
