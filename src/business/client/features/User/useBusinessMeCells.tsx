import { BriefcaseBusiness, MonitorSmartphone, Plus, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import useSWR, { useSWRConfig } from 'swr';

import { type CellProps } from '@/components/Cell';
import { openDesktopVersion } from '@/features/RouteViewSwitch/url';
import { lambdaClient } from '@/libs/trpc/client';

import { useActiveWorkspaceId } from '../../hooks/useActiveWorkspaceId';
import { useSwitchWorkspace } from '../../hooks/useSwitchWorkspace';
import { useWorkspaces, WORKSPACE_LIST_KEY } from '../../hooks/useWorkspaces';
import { openCreateWorkspaceModal } from './createWorkspaceModal';

export default function useBusinessMeCells(): CellProps[] {
  const activeWorkspaceId = useActiveWorkspaceId();
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { mutate } = useSWRConfig();
  const { switchToPersonal, switchWorkspace } = useSwitchWorkspace();
  const workspaces = useWorkspaces();
  const { data: personalBilling } = useSWR(['business/personal-billing'], () =>
    lambdaClient.personalBilling.get.query(),
  );

  const createWorkspace = () =>
    openCreateWorkspaceModal(async (workspace) => {
      await mutate(WORKSPACE_LIST_KEY);
      await switchWorkspace(workspace.id);
      navigate(`/${workspace.slug}`);
    });

  return [
    { type: 'divider' },
    {
      icon: UserRound,
      key: 'personal-workspace',
      label: activeWorkspaceId ? 'Перейти в личное пространство' : 'Личное пространство активно',
      onClick: async () => {
        await switchToPersonal();
        navigate('/');
      },
    },
    ...workspaces.map(
      (workspace): CellProps => ({
        icon: BriefcaseBusiness,
        key: `workspace-${workspace.id}`,
        label: `${activeWorkspaceId === workspace.id ? '✓ ' : ''}${workspace.name}`,
        onClick: async () => {
          await switchWorkspace(workspace.id);
          navigate(`/${workspace.slug}`);
        },
      }),
    ),
    {
      icon: Plus,
      key: 'create-workspace',
      label: 'Создать workspace',
      onClick: createWorkspace,
    },
    {
      icon: MonitorSmartphone,
      key: 'desktop-version',
      label: t('routeView.desktopVersion'),
      onClick: openDesktopVersion,
    },
    ...(personalBilling?.isSuperAdmin
      ? [
          {
            icon: ShieldCheck,
            key: 'business-admin-mobile',
            label: 'Super-admin: Business',
            onClick: () => navigate('/admin/business'),
          },
        ]
      : []),
    { type: 'divider' },
  ];
}
