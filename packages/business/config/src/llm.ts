import type { UserModelProviderConfig } from '@lobechat/types';
import { ModelProvider } from 'model-bank/modelProvider';

/**
 * Upstream turned `genUserLLMConfig` into a no-arg function driven by this map,
 * so the fork's former argument list moves here.
 *
 * The provider set stays the fork's, not upstream's: this deployment bills
 * through credits, so only the LobeHub gateway is on by default. Enabling
 * upstream's direct Anthropic / DeepSeek / Google / OpenAI defaults would show
 * users providers that bypass billing and that they have no key for.
 * Local runtimes stay client-fetched.
 */
const providerDefaults: Partial<
  Record<ModelProvider, { enabled?: boolean; enabledModels?: string[]; fetchOnClient?: boolean }>
> = {
  [ModelProvider.LMStudio]: { fetchOnClient: true },
  [ModelProvider.LobeHub]: { enabled: true },
  [ModelProvider.Ollama]: { fetchOnClient: true },
};

const genUserLLMConfig = (): UserModelProviderConfig => {
  return Object.values(ModelProvider).reduce((config, provider) => {
    const providerConfig = providerDefaults[provider];

    config[provider] = {
      enabled: providerConfig?.enabled ?? false,
      enabledModels: providerConfig?.enabledModels ?? [],
      ...(providerConfig?.fetchOnClient !== undefined && {
        fetchOnClient: providerConfig.fetchOnClient,
      }),
    };

    return config;
  }, {} as UserModelProviderConfig);
};

export const DEFAULT_LLM_CONFIG = genUserLLMConfig();
