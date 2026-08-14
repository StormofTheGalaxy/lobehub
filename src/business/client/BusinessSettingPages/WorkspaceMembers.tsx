import { DEFAULT_USER_AVATAR_URL } from '@lobechat/const';
import { Avatar, Flexbox, Input, Tag, Text } from '@lobehub/ui';
import { Button, confirmModal, Select, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { Link2, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import useSWR from 'swr';

import { useAppOrigin } from '@/hooks/useAppOrigin';
import { lambdaClient } from '@/libs/trpc/client';

import { useActiveWorkspace } from '../hooks/useActiveWorkspace';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    padding: 20px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 22px;
    background: ${cssVar.colorBgContainer};
  `,
  controls: css`
    display: grid;
    grid-template-columns: 150px auto;
    gap: 8px;

    @media (width <= 720px) {
      grid-template-columns: 1fr;
    }
  `,
  hero: css`
    padding: 24px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 26px;
    background:
      radial-gradient(circle at 100% 0, ${cssVar.colorPrimaryBg} 0, transparent 42%),
      linear-gradient(135deg, ${cssVar.colorBgContainer} 0%, ${cssVar.colorFillQuaternary} 100%);
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

    transition: border-color 0.2s ${cssVar.motionEaseOut};

    &:hover {
      border-color: ${cssVar.colorBorder};
    }

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
  skeletonRow: css`
    height: 66px;
    border-radius: 18px;
    background: ${cssVar.colorFillQuaternary};
  `,
}));

type MemberRole = 'admin' | 'member' | 'viewer';
type RoleFilter = 'all' | 'owner' | MemberRole;

/**
 * `workspace_members.role` still carries un-converged legacy `owner` labels for
 * co-owners; the primary owner is the one pinned on `workspaces.primaryOwnerId`,
 * so everyone else labelled `owner` is displayed (and editable) as an Admin —
 * exactly how the server resolves them.
 */
const resolveMemberRole = (role: string, isPrimaryOwner: boolean): MemberRole | 'owner' =>
  isPrimaryOwner ? 'owner' : role === 'owner' ? 'admin' : (role as MemberRole);

interface MemberRow {
  avatar?: string | null;
  email?: string | null;
  fullName?: string | null;
  username?: string | null;
}

const displayName = (member: MemberRow, fallback: string) =>
  member.fullName || member.username || member.email || fallback;

export default function WorkspaceMembers() {
  const { t } = useTranslation('setting');
  const workspace = useActiveWorkspace();
  const appOrigin = useAppOrigin();
  const inviteOrigin = appOrigin.replace(/\/$/, '');
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [userId, setUserId] = useState('');

  const canManage = workspace?.role === 'owner' || workspace?.role === 'super_admin';
  const {
    data = [],
    isLoading,
    mutate: mutateMembers,
  } = useSWR(workspace ? ['business/workspace-members', workspace.id] : null, () =>
    lambdaClient.workspaceMember.list.query({ workspaceId: workspace!.id }),
  );
  const { data: invitations = [], mutate: mutateInvitations } = useSWR(
    workspace && canManage ? ['business/workspace-invitations', workspace.id] : null,
    () => lambdaClient.workspaceMember.listInvitations.query({ workspaceId: workspace!.id }),
  );

  const roleOptions = useMemo(
    () => [
      { label: t('workspaceSetting.members.role.admin'), value: 'admin' },
      { label: t('workspaceSetting.members.role.member'), value: 'member' },
      { label: t('workspaceSetting.members.role.viewer'), value: 'viewer' },
    ],
    [t],
  );

  const roleLabel = (value: MemberRole | 'owner') =>
    t(`workspaceSetting.members.role.${value}` as const);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredMembers = data.filter((member) => {
    const effectiveRole = resolveMemberRole(
      member.role,
      member.userId === workspace?.primaryOwnerId,
    );
    if (roleFilter !== 'all' && effectiveRole !== roleFilter) return false;
    if (!normalizedQuery) return true;

    // Members invited by link may have no email and no profile yet, so every
    // searchable field is optional — match on whatever the row actually has.
    return [member.userId, member.email, member.fullName, member.username].some((value) =>
      value?.toLowerCase().includes(normalizedQuery),
    );
  });

  if (!workspace) return <Text type="secondary">{t('workspaceSetting.members.noWorkspace')}</Text>;

  const copyLink = async (url: string) => {
    await navigator.clipboard?.writeText(url);
    toast.success(t('workspaceSetting.members.invite.copied'));
  };

  const addMember = async () => {
    if (!userId.trim()) return;
    setAdding(true);
    try {
      await lambdaClient.workspaceMember.add.mutate({
        role,
        userId: userId.trim(),
        workspaceId: workspace.id,
      });
      setUserId('');
      await mutateMembers();
      toast.success(t('workspaceSetting.members.addDirect.success'));
    } catch {
      toast.error(t('workspaceSetting.members.addDirect.error'));
    } finally {
      setAdding(false);
    }
  };

  const inviteMember = async () => {
    setInviting(true);
    try {
      const invitation = await lambdaClient.workspaceMember.invite.mutate({
        role,
        workspaceId: workspace.id,
      });
      const inviteUrl = `${inviteOrigin}/invite/${invitation.token}`;
      setLastInviteUrl(inviteUrl);
      await copyLink(inviteUrl);
      await mutateInvitations();
    } catch {
      toast.error(t('workspaceSetting.members.invite.error'));
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (memberUserId: string, nextRole: MemberRole) => {
    setPendingUserId(memberUserId);
    try {
      await lambdaClient.workspaceMember.updateRole.mutate({
        role: nextRole,
        userId: memberUserId,
        workspaceId: workspace.id,
      });
      await mutateMembers();
      toast.success(t('workspaceSetting.members.role.updateSuccess'));
    } catch {
      toast.error(t('workspaceSetting.members.role.updateError'));
    } finally {
      setPendingUserId(null);
    }
  };

  const removeMember = (memberUserId: string, name: string) => {
    confirmModal({
      content: t('workspaceSetting.members.remove.desc', { name }),
      okButtonProps: { danger: true },
      okText: t('workspaceSetting.members.remove.action'),
      onOk: async () => {
        try {
          await lambdaClient.workspaceMember.remove.mutate({
            userId: memberUserId,
            workspaceId: workspace.id,
          });
          await mutateMembers();
          toast.success(t('workspaceSetting.members.remove.success'));
        } catch {
          toast.error(t('workspaceSetting.members.remove.error'));
        }
      },
      title: t('workspaceSetting.members.remove.title'),
    });
  };

  const revokeInvitation = (id: string) => {
    confirmModal({
      content: t('workspaceSetting.members.invitations.revokeDesc'),
      okButtonProps: { danger: true },
      okText: t('workspaceSetting.members.invitations.revoke'),
      onOk: async () => {
        try {
          await lambdaClient.workspaceMember.revokeInvitation.mutate({
            id,
            workspaceId: workspace.id,
          });
          await mutateInvitations();
          toast.success(t('workspaceSetting.members.invitations.revokeSuccess'));
        } catch {
          toast.error(t('workspaceSetting.members.invitations.revokeError'));
        }
      },
      title: t('workspaceSetting.members.invitations.revokeTitle'),
    });
  };

  return (
    <Flexbox gap={18} style={{ maxWidth: 960 }}>
      <Flexbox className={styles.hero} gap={14}>
        <Flexbox horizontal align="center" gap={10}>
          <UsersRound size={24} />
          <Text as="h1" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>
            {t('workspaceSetting.members.title')}
          </Text>
        </Flexbox>
        <Text type="secondary">{t('workspaceSetting.members.desc')}</Text>
        <Flexbox horizontal gap={8} wrap="wrap">
          <Tag>{t('workspaceSetting.members.stat.members', { count: data.length })}</Tag>
          {invitations.length > 0 && (
            <Tag>{t('workspaceSetting.members.stat.pending', { count: invitations.length })}</Tag>
          )}
          {canManage && <Tag color="green">{t('workspaceSetting.members.stat.canManage')}</Tag>}
        </Flexbox>
      </Flexbox>

      {canManage && (
        <Flexbox className={styles.card} gap={12}>
          <Flexbox horizontal align="center" gap={10}>
            <UserPlus size={20} />
            <Text weight={700}>{t('workspaceSetting.members.invite.title')}</Text>
          </Flexbox>
          <Text fontSize={13} type="secondary">
            {t('workspaceSetting.members.invite.desc')}
          </Text>
          <div className={styles.controls}>
            <Select
              options={roleOptions}
              style={{ width: 150 }}
              value={role}
              onChange={(value) => setRole(value as MemberRole)}
            />
            <Button
              icon={<Link2 size={16} />}
              loading={inviting}
              type="primary"
              onClick={inviteMember}
            >
              {t('workspaceSetting.members.invite.create')}
            </Button>
          </div>
          {lastInviteUrl && (
            <Flexbox gap={6}>
              <Flexbox horizontal align="center" className={styles.mobileStack} gap={8}>
                <Input readOnly value={lastInviteUrl} />
                <Button icon={<Link2 size={16} />} onClick={() => copyLink(lastInviteUrl)}>
                  {t('workspaceSetting.members.invite.copy')}
                </Button>
              </Flexbox>
              <Text className={styles.muted} fontSize={13}>
                {t('workspaceSetting.members.invite.ready')}
              </Text>
            </Flexbox>
          )}
          <Flexbox horizontal className={styles.mobileStack} gap={8}>
            <Input
              placeholder={t('workspaceSetting.members.addDirect.placeholder')}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onPressEnter={addMember}
            />
            <Button disabled={!userId.trim()} loading={adding} onClick={addMember}>
              {t('workspaceSetting.members.addDirect.action')}
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
            <Text weight={700}>{t('workspaceSetting.members.list.title')}</Text>
            <Text className={styles.muted} fontSize={13}>
              {t('workspaceSetting.members.list.counter', {
                shown: filteredMembers.length,
                total: data.length,
              })}
            </Text>
          </Flexbox>
          <Flexbox horizontal className={styles.mobileStack} gap={8}>
            <Input
              placeholder={t('workspaceSetting.members.list.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              style={{ width: 150 }}
              value={roleFilter}
              options={[
                { label: t('workspaceSetting.members.role.all'), value: 'all' },
                { label: t('workspaceSetting.members.role.owner'), value: 'owner' },
                ...roleOptions,
              ]}
              onChange={(value) => setRoleFilter(value as RoleFilter)}
            />
          </Flexbox>
        </Flexbox>

        {isLoading &&
          data.length === 0 &&
          [0, 1, 2].map((key) => <div className={styles.skeletonRow} key={key} />)}

        {!isLoading && filteredMembers.length === 0 && (
          <Flexbox align="center" className={styles.card} gap={4} padding={20}>
            <Text weight={600}>{t('workspaceSetting.members.list.emptyTitle')}</Text>
            <Text className={styles.muted} fontSize={13}>
              {t('workspaceSetting.members.list.emptyDesc')}
            </Text>
          </Flexbox>
        )}

        {filteredMembers.map((member) => {
          const isPrimaryOwner = member.userId === workspace.primaryOwnerId;
          const effectiveRole = resolveMemberRole(member.role, isPrimaryOwner);
          const name = displayName(member, member.userId);
          const subtitle = member.email && member.email !== name ? member.email : member.userId;

          return (
            <div className={styles.item} key={`${member.workspaceId}-${member.userId}`}>
              <Flexbox horizontal align="center" gap={12}>
                <Avatar
                  avatar={member.avatar || DEFAULT_USER_AVATAR_URL}
                  shape="circle"
                  size={36}
                  title={name}
                />
                <Flexbox gap={4} style={{ minWidth: 0 }}>
                  <Text ellipsis weight={600}>
                    {name}
                  </Text>
                  <Flexbox horizontal align="center" gap={6} wrap="wrap">
                    <Text ellipsis className={styles.muted} fontSize={12}>
                      {subtitle}
                    </Text>
                    <Tag>{roleLabel(effectiveRole)}</Tag>
                    {isPrimaryOwner && (
                      <Tag color="gold">{t('workspaceSetting.members.role.primaryOwner')}</Tag>
                    )}
                  </Flexbox>
                </Flexbox>
              </Flexbox>
              <Flexbox horizontal align="center" className={styles.mobileStack} gap={8}>
                {canManage && !isPrimaryOwner ? (
                  <>
                    <Select
                      disabled={pendingUserId === member.userId}
                      options={roleOptions}
                      style={{ width: 130 }}
                      value={effectiveRole}
                      onChange={(value) => updateRole(member.userId, value as MemberRole)}
                    />
                    <Button
                      danger
                      disabled={pendingUserId === member.userId}
                      size="small"
                      onClick={() => removeMember(member.userId, name)}
                    >
                      {t('workspaceSetting.members.remove.action')}
                    </Button>
                  </>
                ) : !canManage ? (
                  <Text className={styles.muted} fontSize={13}>
                    {t('workspaceSetting.members.role.readonly')}
                  </Text>
                ) : null}
              </Flexbox>
            </div>
          );
        })}
      </Flexbox>

      {canManage && invitations.length > 0 && (
        <Flexbox gap={8}>
          <Text weight={600}>{t('workspaceSetting.members.invitations.title')}</Text>
          {invitations.map((invitation) => (
            <div className={styles.item} key={invitation.id}>
              <Flexbox gap={2} style={{ minWidth: 0 }}>
                <Text ellipsis>
                  {invitation.email || t('workspaceSetting.members.invitations.linkInvite')}
                </Text>
                <Text code ellipsis fontSize={12} type="secondary">
                  /invite/{invitation.token}
                </Text>
              </Flexbox>
              <Flexbox horizontal className={styles.mobileStack} gap={8}>
                <Button size="small" onClick={() => navigate(`/invite/${invitation.token}`)}>
                  {t('workspaceSetting.members.invitations.open')}
                </Button>
                <Button
                  size="small"
                  onClick={() => copyLink(`${inviteOrigin}/invite/${invitation.token}`)}
                >
                  {t('workspaceSetting.members.invitations.copyLink')}
                </Button>
                <Button danger size="small" onClick={() => revokeInvitation(invitation.id)}>
                  {t('workspaceSetting.members.invitations.revoke')}
                </Button>
              </Flexbox>
            </div>
          ))}
        </Flexbox>
      )}

      {!canManage && (
        <Flexbox horizontal align="center" className={styles.card} gap={10}>
          <ShieldCheck size={18} />
          <Text type="secondary">{t('workspaceSetting.members.readOnlyNotice')}</Text>
        </Flexbox>
      )}
    </Flexbox>
  );
}
