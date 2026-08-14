'use client';

import { Center, Flexbox, Tag, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { CheckCircle2, Clock3, ShieldAlert, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { mutate } from 'swr';

import { WORKSPACE_LIST_KEY } from '@/business/client/hooks/useWorkspaces';
import { setActiveWorkspaceSnapshot } from '@/business/client/hooks/workspaceState';
import { lambdaClient } from '@/libs/trpc/client';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    width: min(560px, calc(100vw - 32px));
    padding: 28px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 28px;

    background:
      radial-gradient(circle at 100% 0, ${cssVar.colorPrimaryBg} 0, transparent 40%),
      ${cssVar.colorBgContainer};
    box-shadow: ${cssVar.boxShadowSecondary};
  `,
  icon: css`
    display: grid;
    place-items: center;

    width: 56px;
    height: 56px;
    border-radius: 18px;

    color: ${cssVar.colorPrimary};

    background: ${cssVar.colorPrimaryBg};
  `,
  muted: css`
    color: ${cssVar.colorTextSecondary};
  `,
}));

type State =
  | { status: 'ready' }
  | { status: 'accepting' }
  | { message: string; status: 'error' }
  | { slug: string; status: 'accepted'; workspaceId: string; workspaceName: string };

const InvitePage = () => {
  const { t } = useTranslation('setting');
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ status: 'ready' });

  const accept = async () => {
    if (!token) {
      setState({
        message: t('workspaceSetting.invitePage.error.missingToken'),
        status: 'error',
      });
      return;
    }

    setState({ status: 'accepting' });
    try {
      const accepted = await lambdaClient.workspaceMember.acceptInvitation.mutate({ token });
      const workspace = accepted.workspace;
      if (!workspace) throw new Error(t('workspaceSetting.invitePage.error.missingWorkspace'));

      await mutate(WORKSPACE_LIST_KEY);

      setState({
        slug: workspace.slug,
        status: 'accepted',
        workspaceId: accepted.workspaceId,
        workspaceName: workspace.name || workspace.slug,
      });
    } catch (error) {
      // Server messages are operator-facing English; the guidance below the
      // headline is what actually tells the user what to do next.
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('workspaceSetting.invitePage.error.generic');
      setState({ message, status: 'error' });
    }
  };

  return (
    <Center height="100%" padding={16} width="100%">
      <Flexbox className={styles.card} gap={22}>
        <Flexbox horizontal align="center" gap={14}>
          <div className={styles.icon}>
            {state.status === 'accepted' ? <CheckCircle2 size={28} /> : <UsersRound size={28} />}
          </div>
          <Flexbox gap={4}>
            <Flexbox horizontal gap={8}>
              <Tag color={state.status === 'error' ? 'red' : 'blue'}>
                {t('workspaceSetting.invitePage.badge')}
              </Tag>
              {state.status === 'accepting' && (
                <Tag icon={<Clock3 size={12} />}>{t('workspaceSetting.invitePage.checking')}</Tag>
              )}
            </Flexbox>
            <Text as="h1" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, margin: 0 }}>
              {state.status === 'accepted'
                ? t('workspaceSetting.invitePage.accepted.title')
                : state.status === 'error'
                  ? t('workspaceSetting.invitePage.error.title')
                  : state.status === 'accepting'
                    ? t('workspaceSetting.invitePage.accepting.title')
                    : t('workspaceSetting.invitePage.ready.title')}
            </Text>
          </Flexbox>
        </Flexbox>

        {state.status === 'ready' && (
          <Flexbox gap={14}>
            <Text className={styles.muted}>{t('workspaceSetting.invitePage.ready.desc')}</Text>
            <Button block type="primary" onClick={accept}>
              {t('workspaceSetting.invitePage.ready.accept')}
            </Button>
          </Flexbox>
        )}

        {state.status === 'accepting' && (
          <Flexbox gap={14}>
            <Text className={styles.muted}>{t('workspaceSetting.invitePage.accepting.desc')}</Text>
            <Button block disabled loading type="primary">
              {t('workspaceSetting.invitePage.accepting.title')}
            </Button>
          </Flexbox>
        )}

        {state.status === 'accepted' && (
          <Flexbox gap={14}>
            <Text className={styles.muted}>
              {t('workspaceSetting.invitePage.accepted.desc', { name: state.workspaceName })}
            </Text>
            <Button
              block
              type="primary"
              onClick={() => {
                setActiveWorkspaceSnapshot({ id: state.workspaceId, slug: state.slug });
                navigate(`/${state.slug}`, { replace: true });
              }}
            >
              {t('workspaceSetting.invitePage.accepted.enter')}
            </Button>
          </Flexbox>
        )}

        {state.status === 'error' && (
          <Flexbox gap={14}>
            <Flexbox horizontal align="center" gap={10}>
              <ShieldAlert size={18} />
              <Text>{state.message}</Text>
            </Flexbox>
            <Text className={styles.muted}>{t('workspaceSetting.invitePage.error.desc')}</Text>
            <Flexbox horizontal gap={8}>
              <Button type="primary" onClick={() => navigate('/', { replace: true })}>
                {t('workspaceSetting.invitePage.error.home')}
              </Button>
              <Button onClick={() => setState({ status: 'ready' })}>
                {t('workspaceSetting.invitePage.error.retry')}
              </Button>
            </Flexbox>
          </Flexbox>
        )}
      </Flexbox>
    </Center>
  );
};

export default InvitePage;
