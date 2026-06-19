import { Flexbox } from '@lobehub/ui';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import DragUploadZone, { useUploadFiles } from '@/components/DragUploadZone';
import AgentPresetsHomeEntry from '@/features/AgentPresets/HomeEntry';
import { type ActionKeys } from '@/features/ChatInput';
import { ChatInputProvider, DesktopChatInput } from '@/features/ChatInput';
import { useHomeDailyBrief } from '@/hooks/useHomeDailyBrief';
import { useInitAgentConfig } from '@/hooks/useInitAgentConfig';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { builtinAgentSelectors } from '@/store/agent/selectors/builtinAgentSelectors';
import { useChatStore } from '@/store/chat';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useHomeStore } from '@/store/home';
import {
  featureFlagsSelectors,
  serverConfigSelectors,
  useServerConfigStore,
} from '@/store/serverConfig';

import CommunityRecommend from '../CommunityRecommend';
import SuggestQuestions from '../SuggestQuestions';
import BotIntegrationBanner, { BOT_INTEGRATION_BANNER_ID } from './BotIntegrationBanner';
import { stripMarkdownLinks } from './hintFormat';
import MessengerBanner, { MESSENGER_BANNER_ID } from './MessengerBanner';
import SkillInstallBanner, { SKILL_INSTALL_BANNER_ID } from './SkillInstallBanner';
import StarterList from './StarterList';
import { useSend } from './useSend';

const leftActions: ActionKeys[] = ['agentMode', 'plus'];
const rightActions: ActionKeys[] = ['modelLabel'];

type BannerKind = 'skill' | 'botIntegration' | 'messenger';

const InputArea = () => {
  const { loading, send, agentId } = useSend();
  // Subscribe to the SWR key so `internal_refreshAgentConfig`'s `mutate(...)`
  // has a listener after toggleFile / toggleKnowledgeBase — otherwise the
  // Library submenu doesn't reflect server-side toggles. Pass `agentId`
  // explicitly so AgentSelect switches refetch too.
  useInitAgentConfig(agentId);
  // Use the "config absent from agentMap" loading shape (same as Memory /
  // Search / History) instead of SWR's `isLoading`, which would flash on
  // every mount-time revalidation even when inbox data is already cached.
  const isAgentConfigLoading = useAgentStore((s) =>
    agentByIdSelectors.isAgentConfigLoadingById(agentId ?? '')(s),
  );
  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);
  const inputActiveMode = useHomeStore((s) => s.inputActiveMode);
  const { showMarket, showWelcomeSuggest } = useServerConfigStore(featureFlagsSelectors);
  const isLobehubSkillEnabled = useServerConfigStore(serverConfigSelectors.enableLobehubSkill);
  const isComposioEnabled = useServerConfigStore(serverConfigSelectors.enableComposio);
  const serverConfigInit = useServerConfigStore((s) => s.serverConfigInit);
  const isSkillBannerDismissed = useGlobalStore(
    systemStatusSelectors.isBannerDismissed(SKILL_INSTALL_BANNER_ID),
  );
  const isBotIntegrationBannerDismissed = useGlobalStore(
    systemStatusSelectors.isBannerDismissed(BOT_INTEGRATION_BANNER_ID),
  );
  const isMessengerBannerDismissed = useGlobalStore(
    systemStatusSelectors.isBannerDismissed(MESSENGER_BANNER_ID),
  );
  const chatInputRef = useRef<HTMLDivElement>(null);

  // Wait for both stores to finish hydrating before drawing — server config
  // (skill flags) and the agent store (inboxAgentId) hydrate at different
  // times, and picking too early biases the draw toward whichever arrived
  // first. After picking, dismissing the active banner only hides it for
  // this mount — re-mounting re-rolls from the still-undismissed pool.
  const [activeBanner, setActiveBanner] = useState<BannerKind | null>(null);
  const hasPickedRef = useRef(false);

  useEffect(() => {
    if (hasPickedRef.current) return;
    if (!serverConfigInit || !inboxAgentId) return;

    const candidates: BannerKind[] = [];
    if ((isLobehubSkillEnabled || isComposioEnabled) && !isSkillBannerDismissed) {
      candidates.push('skill');
    }
    if (!isBotIntegrationBannerDismissed) candidates.push('botIntegration');
    if (!isMessengerBannerDismissed) candidates.push('messenger');
    if (candidates.length === 0) return;

    hasPickedRef.current = true;
    setActiveBanner(candidates[Math.floor(Math.random() * candidates.length)]);
  }, [
    inboxAgentId,
    isBotIntegrationBannerDismissed,
    isComposioEnabled,
    isLobehubSkillEnabled,
    isMessengerBannerDismissed,
    isSkillBannerDismissed,
    serverConfigInit,
  ]);

  useEffect(() => {
    if (!inputActiveMode) return;

    requestAnimationFrame(() => {
      chatInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      useChatStore.getState().mainInputEditor?.focus();
    });
  }, [inputActiveMode]);

  const isActiveBannerDismissed =
    (activeBanner === 'skill' && isSkillBannerDismissed) ||
    (activeBanner === 'botIntegration' && isBotIntegrationBannerDismissed) ||
    (activeBanner === 'messenger' && isMessengerBannerDismissed);
  const visibleBanner = isActiveBannerDismissed ? null : activeBanner;

  // Get agent's model info for vision support check. Falls back to an empty
  // id while the agent id resolves; the selectors return DEFAULT_MODEL /
  // DEFAULT_PROVIDER for unknown ids.
  const resolvedAgentId = agentId ?? '';
  const model = useAgentStore((s) => agentByIdSelectors.getAgentModelById(resolvedAgentId)(s));
  const provider = useAgentStore((s) =>
    agentByIdSelectors.getAgentModelProviderById(resolvedAgentId)(s),
  );
  const { handleUploadFiles } = useUploadFiles({ agentId: resolvedAgentId, model, provider });

  // A slot to insert content above the chat input
  // Override some default behavior of the chat input
  const inputContainerProps = useMemo(
    () => ({
      minHeight: 88,
      resize: false,
      style: {
        borderRadius: 20,
        boxShadow: '0 12px 32px rgba(0,0,0,.04)',
      },
    }),
    [],
  );

  // Daily-generated input hint paired with the home WelcomeText. The hint
  // tracks whichever pair the WelcomeText typewriter is currently showing,
  // via the shared rotating index inside `useHomeDailyBrief`.
  const { currentPair } = useHomeDailyBrief();
  const dailyHint = currentPair?.hint ? stripMarkdownLinks(currentPair.hint) : undefined;

  const hideStarterList =
    !!inputActiveMode && ['agent', 'group', 'write'].includes(inputActiveMode);
  const isSuggestionMode =
    !inputActiveMode || ['agent', 'group', 'write'].includes(inputActiveMode);
  const showSuggestQuestions = showWelcomeSuggest && isSuggestionMode;
  const showCommunityRecommend =
    !!inputActiveMode && ['agent', 'group', 'write'].includes(inputActiveMode) && showMarket;

  return (
    <Flexbox gap={16} style={{ marginBottom: 16 }}>
      <Flexbox
        ref={chatInputRef}
        style={{ paddingBottom: visibleBanner ? 32 : 0, position: 'relative' }}
      >
        {visibleBanner === 'skill' && <SkillInstallBanner />}
        {visibleBanner === 'botIntegration' && <BotIntegrationBanner />}
        {visibleBanner === 'messenger' && <MessengerBanner />}
        <DragUploadZone
          style={{ position: 'relative', zIndex: 1 }}
          onUploadFiles={handleUploadFiles}
        >
          <ChatInputProvider
            agentId={agentId}
            allowExpand={false}
            leftActions={leftActions}
            rightActions={rightActions}
            slashPlacement="bottom"
            chatInputEditorRef={(instance) => {
              if (!instance) return;
              useChatStore.setState({ mainInputEditor: instance });
            }}
            sendButtonProps={{
              disabled: loading || isAgentConfigLoading,
              generating: loading,
              onStop: () => {},
              shape: 'round',
            }}
            onSend={send}
            onMarkdownContentChange={(content) => {
              useChatStore.setState({ inputMessage: content });
            }}
          >
            <DesktopChatInput
              dropdownPlacement="bottomLeft"
              inputContainerProps={inputContainerProps}
              isConfigLoading={isAgentConfigLoading}
              placeholder={dailyHint}
              showControlBar={false}
            />
          </ChatInputProvider>
        </DragUploadZone>
      </Flexbox>

      {/* Keep StarterList mounted so returning to default mode preserves its local UI state. */}
      <div style={{ display: hideStarterList ? 'none' : undefined }}>
        <StarterList />
      </div>
      {!hideStarterList && <AgentPresetsHomeEntry />}
      <AnimatePresence mode="popLayout">
        {(showSuggestQuestions || showCommunityRecommend) && (
          <m.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            key={inputActiveMode ?? 'chat'}
            style={{ marginTop: inputActiveMode ? 0 : 24 }}
            transition={{
              duration: 0.2,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <Flexbox gap={24}>
              {showSuggestQuestions && <SuggestQuestions mode={inputActiveMode} />}
              {showCommunityRecommend && <CommunityRecommend mode={inputActiveMode} />}
            </Flexbox>
          </m.div>
        )}
      </AnimatePresence>
    </Flexbox>
  );
};

export default InputArea;
