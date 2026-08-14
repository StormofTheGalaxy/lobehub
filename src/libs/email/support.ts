import { BRANDING_EMAIL, SOCIAL_URL } from '@lobechat/business-const';

interface EmailSupportCopy {
  contactSupport?: string;
  joinDiscord?: string;
}

const DEFAULT_SUPPORT_COPY = {
  contactSupport: 'Contact support',
  joinDiscord: 'Join Discord',
} satisfies Required<EmailSupportCopy>;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const EMAIL_SUPPORT_ADDRESS = BRANDING_EMAIL.support;
export const EMAIL_SUPPORT_REPLY_TO = BRANDING_EMAIL.replyTo;

/**
 * Brands that ship without a community server leave `SOCIAL_URL.discord`
 * unset — the footer then has to drop the Discord half entirely rather than
 * emit a `href="undefined"` link into every transactional email.
 */
export const getEmailSupportHtml = ({
  contactSupport = DEFAULT_SUPPORT_COPY.contactSupport,
  joinDiscord = DEFAULT_SUPPORT_COPY.joinDiscord,
}: EmailSupportCopy = {}) => {
  const supportEmail = escapeHtml(EMAIL_SUPPORT_ADDRESS);
  const linkStyle = 'color: #6b7280; text-decoration: underline;';
  const supportLink = `<a href="mailto:${supportEmail}" style="${linkStyle}">${escapeHtml(contactSupport)}</a>`;

  if (!SOCIAL_URL.discord) return supportLink;

  const discordUrl = escapeHtml(SOCIAL_URL.discord);
  const discordLink = `<a href="${discordUrl}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${escapeHtml(joinDiscord)}</a>`;

  return `${supportLink}<span style="color: #a1a1aa;"> · </span>${discordLink}`;
};

export const getEmailSupportText = ({
  contactSupport = DEFAULT_SUPPORT_COPY.contactSupport,
  joinDiscord = DEFAULT_SUPPORT_COPY.joinDiscord,
}: EmailSupportCopy = {}) => {
  const support = `${contactSupport}: ${EMAIL_SUPPORT_ADDRESS}`;

  return SOCIAL_URL.discord ? `${support} | ${joinDiscord}: ${SOCIAL_URL.discord}` : support;
};
