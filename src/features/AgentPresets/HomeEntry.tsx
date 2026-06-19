import { Button, Flexbox, Grid, Skeleton, Text } from '@lobehub/ui';
import { ArrowRight } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { agentPresetService } from '@/services/agentPreset';

import PresetCard from './PresetCard';

const AgentPresetsHomeEntry = memo(() => {
  const { t } = useTranslation('discover');
  const navigate = useWorkspaceAwareNavigate();
  const [installingId, setInstallingId] = useState<string | null>(null);
  const { data, isLoading } = useSWR('agent-presets:home', () => agentPresetService.list());
  const presets = (data ?? []).filter((preset) => preset.featured).slice(0, 3);

  const handleInstall = async (id: string) => {
    if (installingId) return;

    setInstallingId(id);
    try {
      const { agentId } = await agentPresetService.install(id);
      navigate(`/agent/${agentId}/profile`);
    } finally {
      setInstallingId(null);
    }
  };

  if (isLoading) {
    return <Skeleton.Button active block style={{ height: 160 }} />;
  }

  if (presets.length === 0) return null;

  return (
    <Flexbox gap={12}>
      <Flexbox horizontal align="center" justify="space-between">
        <Flexbox gap={4}>
          <Text fontSize={18} weight={600}>
            {t('agentPresets.home.title')}
          </Text>
          <Text fontSize={13} type="secondary">
            {t('agentPresets.home.description')}
          </Text>
        </Flexbox>
        <Button icon={ArrowRight} size="small" onClick={() => navigate('/agent-presets')}>
          {t('agentPresets.home.open')}
        </Button>
      </Flexbox>
      <Grid gap={12} maxItemWidth={260} rows={3} width="100%">
        {presets.map((preset) => (
          <PresetCard
            compact
            installing={installingId === preset.id}
            key={preset.id}
            preset={preset}
            onInstall={handleInstall}
          />
        ))}
      </Grid>
    </Flexbox>
  );
});

export default AgentPresetsHomeEntry;
