import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import NameSuggestions from './NameSuggestions';

const translations: Record<string, string> = {
  'agent.welcome.suggestion.avatarHint': 'Use {{emoji}} as the avatar.',
  'agent.welcome.suggestion.switch': '换一组',
  'agent.welcome.suggestion.title': '一下子没灵感？先挑一个吧',
};

const updateInputMessage = vi.fn();
const setDocument = vi.fn();
const focus = vi.fn();
const editor = { focus, setDocument };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string, params?: Record<string, string>) => {
      const template = translations[key] ?? key;
      if (!params) return template;
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
        template,
      );
    },
  }),
}));

vi.mock('@/features/Conversation', () => ({
  useConversationStore: (
    selector: (state: { editor: unknown; updateInputMessage: unknown }) => unknown,
  ) =>
    selector({
      editor,
      updateInputMessage,
    }),
}));

const useServerConfigStore = vi.fn(
  (selector: (state: { featureFlags: { showWelcomeSuggest: boolean } }) => unknown) =>
    selector({
      featureFlags: {
        showWelcomeSuggest: true,
      },
    }),
);

vi.mock('@/store/serverConfig', () => ({
  featureFlagsSelectors: (state: { featureFlags: { showWelcomeSuggest: boolean } }) =>
    state.featureFlags,
  useServerConfigStore,
}));

describe('NameSuggestions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    updateInputMessage.mockClear();
    setDocument.mockClear();
    focus.mockClear();
  });

  it('fills the chat input with the selected preset prompt', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<NameSuggestions />);

    fireEvent.click(screen.getByText('Lumi'));

    const expected =
      'Let’s call you Lumi first. Warm, thoughtful, and a little dreamy. Use 🌙 as the avatar.';
    expect(updateInputMessage).toHaveBeenCalledWith(expected);
    expect(setDocument).toHaveBeenCalledWith('text', expected);
    expect(focus).toHaveBeenCalled();
  });

  it('switches to a different set of names when refreshed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<NameSuggestions />);

    expect(screen.getByText('Lumi')).toBeInTheDocument();

    fireEvent.click(screen.getByText('换一组'));

    expect(screen.queryByText('Lumi')).not.toBeInTheDocument();
    expect(screen.getByText('Nova')).toBeInTheDocument();
  });

  it('renders nothing when welcome suggestions are disabled', () => {
    useServerConfigStore.mockImplementationOnce(
      (selector: (state: { featureFlags: { showWelcomeSuggest: boolean } }) => unknown) =>
        selector({
          featureFlags: {
            showWelcomeSuggest: false,
          },
        }),
    );

    const { container } = render(<NameSuggestions />);

    expect(container).toBeEmptyDOMElement();
  });
});
