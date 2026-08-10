import { describe, expect, it } from 'vitest';

import { parseInviteToken } from './inviteToken';

describe('parseInviteToken', () => {
  it.each([
    ['token-123', 'token-123'],
    ['/invite/token-123', 'token-123'],
    ['/invite/token-123/', 'token-123'],
    ['https://example.com/invite/token-123', 'token-123'],
    ['https://example.com/invite/token%2D123?source=email', 'token-123'],
  ])('parses %s', (input, expected) => {
    expect(parseInviteToken(input)).toBe(expected);
  });

  it.each(['', '/agent/token-123', '/invite/token-123/extra', 'https://example.com/invite'])(
    'rejects %s',
    (input) => {
      expect(parseInviteToken(input)).toBeNull();
    },
  );
});
