import { Flexbox, Input, Tag, Text } from '@lobehub/ui';
import { Button, confirmModal, Select, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { Link2, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import AsyncSection from '../components/AsyncSection';
import { runAction } from '../components/runAction';
import { useActiveWorkspace } from '../hooks/useActiveWorkspace';
import { useWorkspaceManageRights } from '../hooks/useWorkspacePermission';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    padding: 20px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 22px;
    background: ${cssVar.colorBgContainer};
  `,
  hero: css`
    padding: 24px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 26px;
    background:
      radial-gradient(circle at 100% 0, ${cssVar.colorPrimaryBg} 0, transparent 42%),
      linear-gradient(135deg, ${cssVar.colorBgContainer} 0%, ${cssVar.colorFillQuaternary} 100%);
  `,
  controls: css`
    display: grid;
    grid-template-columns: 150px auto;
    gap: 8px;

    @media (width <= 720px) {
      grid-template-columns: 1fr;
    }
  `,
  item: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;

    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 18px;

    background: ${cssVar.colorBgContainer};

    @media (width <= 720px) {
      grid-template-columns: 1fr;
    }
  `,
  mobileStack: css`
    @media (width <= 720px) {
      flex-direction: column;
      align-items: stretch;

      > * {
        width: 100% !important;
      }
    }
  `,
  muted: css`
    color: ${cssVar.colorTextSecondary};
  `,
}));

type WorkspaceRole = 'admin' | 'member' | 'owner' | 'viewer';

const roleOptions: { label: string; value: WorkspaceRole }[] = [
  { label: 'Владелец', value: 'owner' },
  { label: 'Администратор', value: 'admin' },
  { label: 'Участник', value: 'member' },
  { label: 'Наблюдатель', value: 'viewer' },
];

/**
 * Clipboard writes fail silently in insecure contexts and under permission
 * policies, so every copy path reports what actually happened instead of
 * assuming success.
 */
const copyLink = async (url: string, options?: { silent?: boolean }) => {
  try {
    await navigator.clipboard?.writeText(url);
    if (!options?.silent) toast.success({ title: 'Ссылка скопирована' });

    return true;
  } catch {
    if (!options?.silent) {
      toast.error({
        description: 'Скопируйте ссылку вручную из поля выше.',
        title: 'Не удалось скопировать',
      });
    }

    return false;
  }
};

const roleLabel = (role: string) =>
  roleOptions.find((option) => option.value === role)?.label ?? 'Участник';

export default function WorkspaceMembers() {
  const workspace = useActiveWorkspace();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [roleFilter, setRoleFilter] = useState<'all' | WorkspaceRole>('all');
  const [userId, setUserId] = useState('');
  const { canManage } = useWorkspaceManageRights();
  const {
    data = [],
    error: membersError,
    isLoading: membersLoading,
    mutate: mutateMembers,
  } = useSWR(workspace ? ['business/workspace-members', workspace.id] : null, () =>
    lambdaClient.workspaceMember.list.query({ workspaceId: workspace!.id }),
  );
  const { data: invitations = [], mutate: mutateInvitations } = useSWR(
    workspace && canManage ? ['business/workspace-invitations', workspace.id] : null,
    () => lambdaClient.workspaceMember.listInvitations.query({ workspaceId: workspace!.id }),
  );

  if (!workspace)
    return <Text type="secondary">Выберите workspace для управления участниками.</Text>;

  const addMember = async () => {
    if (!userId.trim()) return;
    setAdding(true);
    const ok = await runAction(
      () =>
        lambdaClient.workspaceMember.add.mutate({
          role,
          userId: userId.trim(),
          workspaceId: workspace.id,
        }),
      { errorTitle: 'Не удалось добавить участника', successTitle: 'Участник добавлен' },
    );
    setAdding(false);

    if (!ok) return;
    setUserId('');
    await mutateMembers();
  };

  const inviteMember = async () => {
    setInviting(true);
    const ok = await runAction(
      async () => {
        const invitation = await lambdaClient.workspaceMember.invite.mutate({
          role,
          workspaceId: workspace.id,
        });
        const origin = globalThis.location?.origin ?? '';
        const inviteUrl = `${origin}/invite/${invitation.token}`;
        setLastInviteUrl(inviteUrl);
        // The link is on screen either way, so a blocked clipboard must not
        // fail the invite — it only changes what the success copy promises.
        await copyLink(inviteUrl, { silent: true });
      },
      { errorTitle: 'Не удалось создать приглашение' },
    );
    setInviting(false);

    if (!ok) return;
    await mutateInvitations();
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredMembers = data.filter((member) => {
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesQuery =
      !normalizedQuery ||
      member.userId.toLowerCase().includes(normalizedQuery) ||
      (member.email ?? '').toLowerCase().includes(normalizedQuery);

    return matchesRole && matchesQuery;
  });

  return (
    <Flexbox gap={18} style={{ maxWidth: 960 }}>
      <Flexbox className={styles.hero} gap={14}>
        <Flexbox horizontal align="center" gap={10}>
          <UsersRound size={24} />
          <Text as="h1" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            Команда workspace
          </Text>
        </Flexbox>
        <Text type="secondary">
          Создавайте invite link как в Discord, назначайте роли и держите доступ к общим агентам,
          знаниям, провайдерам и кредитам под контролем.
        </Text>
        <Flexbox horizontal gap={8}>
          <Tag>{data.length} участников</Tag>
          <Tag>{invitations.length} ожидают</Tag>
          {canManage && <Tag color="green">Можно управлять</Tag>}
        </Flexbox>
      </Flexbox>
      {canManage && (
        <Flexbox className={styles.card} gap={12}>
          <Flexbox horizontal align="center" gap={10}>
            <UserPlus size={20} />
            <Text weight={700}>Пригласить в workspace</Text>
          </Flexbox>
          <Flexbox gap={4}>
            <Text fontSize={13} type="secondary">
              Нажмите кнопку, мы создадим одноразовую invite-ссылку и сразу скопируем ее в буфер.
              Новый пользователь после входа попадет в нужный workspace.
            </Text>
          </Flexbox>
          <div className={styles.controls}>
            <Select
              options={roleOptions}
              style={{ width: 150 }}
              value={role}
              onChange={(value) => setRole(value as WorkspaceRole)}
            />
            <Button
              icon={<Link2 size={16} />}
              loading={inviting}
              type="primary"
              onClick={inviteMember}
            >
              Создать invite link
            </Button>
          </div>
          {lastInviteUrl && (
            <Flexbox horizontal align="center" className={styles.mobileStack} gap={8}>
              <Input readOnly value={lastInviteUrl} />
              <Button icon={<Link2 size={16} />} onClick={() => void copyLink(lastInviteUrl)}>
                Скопировать
              </Button>
              <Text fontSize={13} type="secondary">
                Ссылка готова и уже скопирована.
              </Text>
            </Flexbox>
          )}
          <Flexbox horizontal className={styles.mobileStack} gap={8}>
            <Input
              placeholder="ID пользователя для прямого добавления"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <Button loading={adding} onClick={addMember}>
              Добавить без приглашения
            </Button>
          </Flexbox>
        </Flexbox>
      )}
      <Flexbox gap={8}>
        <Flexbox
          horizontal
          align="center"
          className={styles.mobileStack}
          gap={8}
          justify="space-between"
        >
          <Flexbox gap={2}>
            <Text weight={700}>Участники</Text>
            <Text className={styles.muted} fontSize={13}>
              {filteredMembers.length} из {data.length}
            </Text>
          </Flexbox>
          <Flexbox horizontal className={styles.mobileStack} gap={8}>
            <Input
              placeholder="Поиск по user id"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              options={[{ label: 'Все роли', value: 'all' }, ...roleOptions]}
              style={{ width: 150 }}
              value={roleFilter}
              onChange={(value) => setRoleFilter(value as 'all' | WorkspaceRole)}
            />
          </Flexbox>
        </Flexbox>
        <AsyncSection
          error={membersError}
          loading={membersLoading && data.length === 0}
          skeletonRows={4}
          onRetry={() => void mutateMembers()}
        >
          <Flexbox gap={8}>
            {filteredMembers.length === 0 && (
              <Flexbox align="center" className={styles.card} gap={4} padding={20}>
                <Text weight={600}>
                  {data.length === 0 ? 'В workspace пока только вы' : 'Никого не нашли'}
                </Text>
                <Text className={styles.muted} fontSize={13}>
                  {data.length === 0
                    ? 'Создайте invite-ссылку выше, чтобы позвать команду.'
                    : 'Измените поиск или фильтр роли.'}
                </Text>
              </Flexbox>
            )}
            {filteredMembers.map((member) => (
          <div className={styles.item} key={`${member.workspaceId}-${member.userId}`}>
            <Flexbox gap={2}>
              <Text>{member.email || member.userId}</Text>
              <Flexbox horizontal gap={6}>
                <Tag>{roleLabel(member.role)}</Tag>
                {member.userId === workspace.primaryOwnerId && <Tag>Основной владелец</Tag>}
              </Flexbox>
            </Flexbox>
            <Flexbox horizontal align="center" className={styles.mobileStack} gap={8}>
              {canManage ? (
                <Select
                  options={roleOptions}
                  style={{ width: 130 }}
                  value={member.role}
                  onChange={async (value) => {
                    const ok = await runAction(
                      () =>
                        lambdaClient.workspaceMember.updateRole.mutate({
                          role: value as WorkspaceRole,
                          userId: member.userId,
                          workspaceId: workspace.id,
                        }),
                      {
                        errorTitle: 'Не удалось изменить роль',
                        successTitle: `Роль изменена на «${roleLabel(value as string)}»`,
                      },
                    );
                    // Revalidate either way: on failure the select must snap
                    // back to the role the server still holds.
                    await mutateMembers();
                    void ok;
                  }}
                />
              ) : (
                <Text className={styles.muted} fontSize={13}>
                  Управлять ролями может только владелец workspace.
                </Text>
              )}
              {canManage && (
                <Button
                  danger
                  size="small"
                  onClick={() =>
                    confirmModal({
                      cancelText: 'Отмена',
                      content: `${member.email || member.userId} потеряет доступ к агентам, знаниям и провайдерам этого workspace. Личные данные пользователя не удаляются.`,
                      okButtonProps: { danger: true },
                      okText: 'Удалить',
                      onOk: async () => {
                        const ok = await runAction(
                          () =>
                            lambdaClient.workspaceMember.remove.mutate({
                              userId: member.userId,
                              workspaceId: workspace.id,
                            }),
                          {
                            errorTitle: 'Не удалось удалить участника',
                            successTitle: 'Участник удален из workspace',
                          },
                        );
                        await mutateMembers();
                        void ok;
                      },
                      title: 'Удалить участника?',
                    })
                  }
                >
                  Удалить
                </Button>
              )}
            </Flexbox>
          </div>
            ))}
          </Flexbox>
        </AsyncSection>
      </Flexbox>
      {canManage && invitations.length > 0 && (
        <Flexbox gap={8}>
          <Text weight={600}>Ожидающие приглашения</Text>
          {invitations.map((invitation) => (
            <div className={styles.item} key={invitation.id}>
              <Flexbox gap={2}>
                <Text>{invitation.email || 'Invite link'}</Text>
                <Text code fontSize={12} type="secondary">
                  /invite/{invitation.token}
                </Text>
              </Flexbox>
              <Flexbox horizontal className={styles.mobileStack} gap={8}>
                <Button size="small" onClick={() => navigate(`/invite/${invitation.token}`)}>
                  Открыть
                </Button>
                <Button
                  size="small"
                  onClick={() =>
                    void copyLink(
                      `${globalThis.location?.origin ?? ''}/invite/${invitation.token}`,
                    )
                  }
                >
                  Скопировать ссылку
                </Button>
                <Button
                  danger
                  size="small"
                  onClick={() =>
                    confirmModal({
                      cancelText: 'Отмена',
                      content:
                        'Ссылка перестанет работать. Тот, кому вы ее отправили, больше не сможет войти в workspace по ней.',
                      okButtonProps: { danger: true },
                      okText: 'Отозвать',
                      onOk: async () => {
                        await runAction(
                          () =>
                            lambdaClient.workspaceMember.revokeInvitation.mutate({
                              id: invitation.id,
                              workspaceId: workspace.id,
                            }),
                          {
                            errorTitle: 'Не удалось отозвать приглашение',
                            successTitle: 'Приглашение отозвано',
                          },
                        );
                        await mutateInvitations();
                      },
                      title: 'Отозвать приглашение?',
                    })
                  }
                >
                  Отозвать
                </Button>
              </Flexbox>
            </div>
          ))}
        </Flexbox>
      )}
      {!canManage && (
        <Flexbox horizontal align="center" className={styles.card} gap={10}>
          <ShieldCheck size={18} />
          <Text type="secondary">
            Роли и приглашения доступны владельцам workspace и super-admin.
          </Text>
        </Flexbox>
      )}
    </Flexbox>
  );
}
