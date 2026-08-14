import { SOCIAL_URL } from '@lobechat/business-const';
import { describe, expect, it } from 'vitest';

import { EMAIL_SUPPORT_ADDRESS, getEmailSupportHtml, getEmailSupportText } from './support';

describe('email support helpers', () => {
  it('renders actionable support links for HTML and plain-text emails', () => {
    const html = getEmailSupportHtml();
    const text = getEmailSupportText();

    // Brand-agnostic: the support address comes from the active brand config,
    // so assert it is a usable mailto target rather than one brand's inbox.
    expect(EMAIL_SUPPORT_ADDRESS).toMatch(/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/);
    expect(html).toContain(`href="mailto:${EMAIL_SUPPORT_ADDRESS}"`);
    expect(text).toContain(EMAIL_SUPPORT_ADDRESS);
  });

  // A brand without a community server leaves `SOCIAL_URL.discord` unset; the
  // footer must then omit the link instead of emitting `href="undefined"`.
  it('includes the Discord link only when the brand has one', () => {
    const html = getEmailSupportHtml();
    const text = getEmailSupportText();

    if (SOCIAL_URL.discord) {
      expect(html).toContain(SOCIAL_URL.discord);
      expect(text).toContain(SOCIAL_URL.discord);
    } else {
      expect(html).not.toContain('undefined');
      expect(text).not.toContain('undefined');
      expect(html).not.toContain('<span');
    }
  });

  it('escapes localized labels before rendering HTML', () => {
    const html = getEmailSupportHtml({
      contactSupport: '<script>alert("support")</script>',
      joinDiscord: '<strong>Discord</strong>',
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<strong>');
    expect(html).toContain('&lt;script&gt;');
    if (SOCIAL_URL.discord) expect(html).toContain('&lt;strong&gt;');
  });
});
