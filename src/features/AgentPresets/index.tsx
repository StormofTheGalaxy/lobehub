import { Empty, Flexbox, Grid, SearchBar, Skeleton, Text } from '@lobehub/ui';
import { App, Button } from 'antd';
import { BotIcon, Settings2 } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { agentPresetService } from '@/services/agentPreset';

import PresetCard from './PresetCard';

const AgentPresets = memo(() => {
  const { t } = useTranslation('discover');
  const navigate = useWorkspaceAwareNavigate();
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const { data, isLoading } = useSWR('agent-presets:list', () => agentPresetService.list());

  const presets = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return data ?? [];

    return (data ?? []).filter((preset) => {
      const haystack = [preset.title, preset.description, preset.category, ...preset.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [data, keyword]);

  const handleInstall = async (id: string) => {
    if (installingId) return;

    setInstallingId(id);
    try {
      const { agentId } = await agentPresetService.install(id);
      message.success(t('agentPresets.install.success'));
      navigate(`/agent/${agentId}/profile`);
    } catch (error) {
      console.error('[agentPresets:install]', error);
      message.error(t('agentPresets.install.failed'));
    } finally {
      setInstallingId(null);
    }
  };

  return (
    <Flexbox gap={24} padding={24} style={{ maxWidth: 1120, width: '100%' }}>
      <Flexbox horizontal align="flex-start" gap={12} justify="space-between">
        <Flexbox gap={8}>
          <Text fontSize={32} weight={700}>
            {t('agentPresets.title')}
          </Text>
          <Text type="secondary">{t('agentPresets.description')}</Text>
        </Flexbox>
        <Button icon={<Settings2 size={16} />} onClick={() => navigate('/agent-presets/admin')}>
          {t('agentPresets.manage')}
        </Button>
      </Flexbox>
      <SearchBar
        allowClear
        placeholder={t('agentPresets.search.placeholder')}
        onInputChange={setKeyword}
        onSearch={setKeyword}
      />
      {isLoading ? (
        <Grid gap={16} maxItemWidth={280} rows={4} width="100%">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton.Button active block key={index} style={{ height: 188 }} />
          ))}
        </Grid>
      ) : presets.length === 0 ? (
        <Empty
          description={t('agentPresets.empty.description')}
          icon={BotIcon}
          title={t('agentPresets.empty.title')}
        />
      ) : (
        <Grid gap={16} maxItemWidth={280} rows={4} width="100%">
          {presets.map((preset) => (
            <PresetCard
              installing={installingId === preset.id}
              key={preset.id}
              preset={preset}
              onInstall={handleInstall}
            />
          ))}
        </Grid>
      )}
    </Flexbox>
  );
});

export default AgentPresets;
