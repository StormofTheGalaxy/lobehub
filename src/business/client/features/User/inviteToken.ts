export const parseInviteToken = (value: string): string | null => {
  const input = value.trim();
  if (!input) return null;

  if (!input.includes('/') && !input.includes('?') && !input.includes('#')) return input;

  try {
    const url = new URL(input, 'https://invite.local');
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 2 || segments[0] !== 'invite') return null;

    return decodeURIComponent(segments[1]);
  } catch {
    return null;
  }
};
