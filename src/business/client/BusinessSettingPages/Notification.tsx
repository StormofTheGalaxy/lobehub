'use client';

import type { NotificationSettings } from '@lobechat/types';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';

import NotificationPreferences, {
  type NotificationScenarioGroup,
} from './NotificationPreferences';

/**
 * Scenarios delivered outside a workspace. Workspace-scoped ones live in the
 * workspace's own Notification tab, which reads the member preference bag.
 */
const PERSONAL_GROUPS: NotificationScenarioGroup[] = [
  { category: 'generation', types: ['image_generation_completed', 'video_generation_completed'] },
  { category: 'schedule', types: ['agent_run_completed'] },
  {
    category: 'workspace',
    types: ['workspace_member_invited', 'workspace_member_removed'],
  },
];

const Notification = memo(() => {
  const { t } = useTranslation('setting');
  const notification = useUserStore(
    (s) => settingsSelectors.currentSettings(s).notification as NotificationSettings | undefined,
  );
  const setSettings = useUserStore((s) => s.setSettings);

  const handleChange = useCallback(
    (next: NotificationSettings) => {
      void setSettings({ notification: next });
    },
    [setSettings],
  );

  return (
    <NotificationPreferences
      groups={PERSONAL_GROUPS}
      scopeDescription={t('notification.scope.personal')}
      value={notification}
      onChange={handleChange}
    />
  );
});

Notification.displayName = 'PersonalNotificationSettings';

export default Notification;
