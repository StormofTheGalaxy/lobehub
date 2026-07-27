import { BRANDING_PROVIDER } from './branding';

export * from './branding';
export * from './llm';
export * from './url';

export const ENABLE_BUSINESS_FEATURES = true;

/**
 * Master switch for the conversational agent-onboarding flow.
 *
 * Upstream keeps this soft-disabled; this deployment enables it so onboarding
 * uses the agent-driven flow instead of the classic form flow.
 */
export const AGENT_ONBOARDING_ENABLED = true;

export const OFFICIAL_PROVIDER_DISABLE_ERROR = 'The official provider cannot be disabled.';

export const isOfficialProvider = (id: string) =>
  ENABLE_BUSINESS_FEATURES && id === BRANDING_PROVIDER;
