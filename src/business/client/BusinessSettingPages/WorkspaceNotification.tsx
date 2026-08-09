'use client';

import type { NotificationSettings } from '@lobechat/types';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserStore } from '@/store/user';

import NotificationPreferences, {
  type NotificationScenarioGroup,
} from './NotificationPreferences';

/**
 * Workspace-scoped scenarios. These read and write the member's per-workspace
 * preference bag (`WorkspaceUserPreference.notification`) — deliberately
 * separate from personal settings, so muting a busy workspace never silences
 * the user's own account notifications.
 */
const WORKSPACE_GROUPS: NotificationScenarioGroup[] = [
  {
    category: 'workspace',
    types: [
      'topic_comment_activity_mentioned',
      'topic_comment_activity_replied',
      'topic_comment_activity_message',
      'topic_comment_activity',
      'workspace_member_joined',
    ],
  },
  { category: 'generation', types: ['image_generation_completed', 'video_generation_completed'] },
  { category: 'schedule', types: ['agent_run_completed'] },
];

const WorkspaceNotification = memo(() => {
  const { t } = useTranslation('setting');
  const [notification, updateWorkspaceUserPreference] = useUserStore((s) => [
    s.workspaceUserPreference.notification,
    s.updateWorkspaceUserPreference,
  ]);

  const handleChange = useCallback(
    (next: NotificationSettings) => {
      void updateWorkspaceUserPreference({ notification: next });
    },
    [updateWorkspaceUserPreference],
  );

  return (
    <NotificationPreferences
      groups={WORKSPACE_GROUPS}
      scopeDescription={t('notification.scope.workspace')}
      value={notification}
      onChange={handleChange}
    />
  );
});

WorkspaceNotification.displayName = 'WorkspaceNotificationSettings';

export default WorkspaceNotification;
