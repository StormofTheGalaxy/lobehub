import { ActionIcon, Block, Button, Flexbox, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { ArrowRight, PlusIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { AgentPresetListItem } from '@/database/models/agentPreset';

const styles = createStaticStyles(({ css }) => ({
  avatar: css`
    display: grid;
    place-items: center;

    width: 44px;
    height: 44px;
    border-radius: 14px;

    font-size: 24px;
  `,
  card: css`
    min-height: 188px;
    border-color: ${cssVar.colorFillSecondary};
    background: linear-gradient(180deg, ${cssVar.colorBgContainer}, ${cssVar.colorBgLayout});
  `,
  featured: css`
    border-color: ${cssVar.colorPrimaryBorder};
    box-shadow: 0 16px 48px -28px ${cssVar.colorPrimary};
  `,
}));

interface PresetCardProps {
  compact?: boolean;
  installing?: boolean;
  onInstall: (id: string) => void;
  onOpen?: (id: string) => void;
  preset: AgentPresetListItem;
}

const PresetCard = memo<PresetCardProps>(({ compact, installing, preset, onInstall, onOpen }) => {
  const { t } = useTranslation('discover');

  return (
    <Block
      className={cx(styles.card, preset.featured && styles.featured)}
      clickable={!!onOpen}
      padding={compact ? 14 : 18}
      variant="outlined"
      onClick={() => onOpen?.(preset.id)}
    >
      <Flexbox gap={16} height="100%" justify="space-between">
        <Flexbox gap={12}>
          <Flexbox horizontal align="center" gap={12} justify="space-between">
            <Flexbox
              className={styles.avatar}
              style={{ background: preset.backgroundColor ?? cssVar.colorFillSecondary }}
            >
              {preset.avatar ?? '🤖'}
            </Flexbox>
            {onOpen && <ActionIcon icon={ArrowRight} size="small" />}
          </Flexbox>
          <Flexbox gap={6}>
            <Text ellipsis={{ rows: 1 }} fontSize={compact ? 15 : 17} weight={600}>
              {preset.title}
            </Text>
            <Text ellipsis={{ rows: compact ? 2 : 3 }} fontSize={13} type="secondary">
              {preset.description || t('agentPresets.card.noDescription')}
            </Text>
          </Flexbox>
          {!compact && preset.tags.length > 0 && (
            <Flexbox horizontal gap={6} wrap="wrap">
              {preset.tags.slice(0, 3).map((tag) => (
                <Tag key={tag} size="small">
                  {tag}
                </Tag>
              ))}
            </Flexbox>
          )}
        </Flexbox>
        <Button
          block
          icon={PlusIcon}
          loading={installing}
          size={compact ? 'small' : 'middle'}
          type={preset.featured ? 'primary' : undefined}
          onClick={(event) => {
            event.stopPropagation();
            onInstall(preset.id);
          }}
        >
          {t('agentPresets.actions.install')}
        </Button>
      </Flexbox>
    </Block>
  );
});

export default PresetCard;
