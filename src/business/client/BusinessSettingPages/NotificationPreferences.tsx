'use client';

import type { NotificationSettings } from '@lobechat/types';
import { Flexbox, Text } from '@lobehub/ui';
import { Switch } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    padding: 20px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 22px;
    background: ${cssVar.colorBgContainer};
  `,
  row: css`
    padding-block: 10px;

    & + & {
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    }
  `,
}));

export interface NotificationScenarioGroup {
  category: string;
  types: string[];
}

interface NotificationPreferencesProps {
  /** Scenario rows to render, grouped by preference category. */
  groups: NotificationScenarioGroup[];
  onChange: (next: NotificationSettings) => void;
  /** Extra line under the heading explaining the scope of these toggles. */
  scopeDescription: string;
  value?: NotificationSettings;
}

/**
 * Inbox notification preferences for one scope (personal or workspace). Only
 * the inbox channel is offered: it is the one this deployment delivers on, and
 * a switch that changes nothing is worse than no switch.
 */
const NotificationPreferences = memo<NotificationPreferencesProps>(
  ({ groups, onChange, scopeDescription, value }) => {
    const { t } = useTranslation('setting');
    const { t: tNotification } = useTranslation('notification');

    const inboxEnabled = value?.inbox?.enabled !== false;

    const isTypeEnabled = useCallback(
      (category: string, type: string) => value?.inbox?.items?.[category]?.[type] !== false,
      [value],
    );

    const setChannelEnabled = (enabled: boolean) => {
      onChange({ ...value, inbox: { ...value?.inbox, enabled } });
    };

    const setTypeEnabled = (category: string, type: string, enabled: boolean) => {
      const items = value?.inbox?.items ?? {};
      onChange({
        ...value,
        inbox: {
          ...value?.inbox,
          items: { ...items, [category]: { ...items[category], [type]: enabled } },
        },
      });
    };

    return (
      <Flexbox gap={16}>
        <Flexbox className={styles.card} gap={4}>
          <Flexbox horizontal align="center" justify="space-between">
            <Text weight={600}>{t('notification.inbox.title')}</Text>
            <Switch checked={inboxEnabled} onChange={setChannelEnabled} />
          </Flexbox>
          <Text type="secondary">{t('notification.inbox.desc')}</Text>
          <Text type="secondary">{scopeDescription}</Text>
        </Flexbox>

        {groups.map(({ category, types }) => (
          <Flexbox className={styles.card} gap={4} key={category}>
            <Text weight={600}>{t(`notification.category.${category}.title` as any)}</Text>
            {types.map((type) => (
              <Flexbox
                horizontal
                align="center"
                className={styles.row}
                justify="space-between"
                key={type}
              >
                {/* The scenario titles are already translated for the inbox
                    itself, so preferences and notifications read alike. */}
                <Text>{tNotification(`${type}_title` as any)}</Text>
                <Switch
                  checked={inboxEnabled && isTypeEnabled(category, type)}
                  disabled={!inboxEnabled}
                  onChange={(checked) => setTypeEnabled(category, type, checked)}
                />
              </Flexbox>
            ))}
          </Flexbox>
        ))}
      </Flexbox>
    );
  },
);

NotificationPreferences.displayName = 'NotificationPreferences';

export default NotificationPreferences;
