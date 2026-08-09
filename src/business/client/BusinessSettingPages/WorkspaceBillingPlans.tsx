'use client';

import { formatIntergerNumber } from '@lobechat/utils/format';
import { Flexbox, Tag, Text } from '@lobehub/ui';
import { Button, confirmModal } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { Map, ShieldCheck } from 'lucide-react';
import { memo, useState } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import AsyncSection from '../components/AsyncSection';
import { runAction } from '../components/runAction';
import SettingCard from '../components/SettingCard';
import { useActiveWorkspace } from '../hooks/useActiveWorkspace';
import { useWorkspaceManageRights } from '../hooks/useWorkspacePermission';

const styles = createStaticStyles(({ css }) => ({
  grid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;

    @media (width <= 960px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (width <= 640px) {
      grid-template-columns: 1fr;
    }
  `,
}));

const formatLimit = (value: number) =>
  value === -1 ? 'Без лимита' : formatIntergerNumber(value);

type WorkspacePlanId = Awaited<
  ReturnType<typeof lambdaClient.subscription.getWorkspacePlan.query>
>['plans'][number]['id'];

const WorkspaceBillingPlans = memo(() => {
  const workspace = useActiveWorkspace();
  const { canOwn: canManage } = useWorkspaceManageRights();
  const [pendingPlan, setPendingPlan] = useState<WorkspacePlanId>();
  const { data, error, isLoading, mutate } = useSWR(
    workspace ? ['business/workspace-plan', workspace.id] : null,
    () => lambdaClient.subscription.getWorkspacePlan.query({ workspaceId: workspace!.id }),
  );

  if (!workspace)
    return (
      <SettingCard
        description={'Откройте настройки внутри workspace, чтобы управлять его тарифом.'}
        icon={Map}
        title={'Workspace не выбран'}
      />
    );

  const applyPlan = async (planId: WorkspacePlanId, planName: string) => {
    setPendingPlan(planId);
    const ok = await runAction(
      () =>
        lambdaClient.subscription.setWorkspacePlan.mutate({
          plan: planId,
          workspaceId: workspace.id,
        }),
      { errorTitle: 'Не удалось сменить тариф', successTitle: `Тариф «${planName}» назначен` },
    );
    setPendingPlan(undefined);

    if (ok) await mutate();
  };

  // Switching a plan re-cuts the workspace's member and token ceilings, so it
  // gets a confirm naming the target rather than firing on a single click.
  const confirmPlan = (planId: WorkspacePlanId, planName: string) =>
    confirmModal({
      cancelText: 'Отмена',
      content: `Лимиты участников и токенов workspace будут пересчитаны по тарифу «${planName}».`,
      okText: 'Назначить',
      onOk: () => applyPlan(planId, planName),
      title: `Назначить тариф «${planName}»?`,
    });

  return (
    <Flexbox gap={18}>
      <AsyncSection
        error={error}
        loading={isLoading && !data}
        skeletonRows={3}
        onRetry={() => void mutate()}
      >
        <Flexbox gap={18}>
          <SettingCard
            action={data?.plan ? <Tag color={'green'}>Текущий: {data.plan}</Tag> : undefined}
            icon={Map}
            title={'Тариф workspace'}
            variant={'hero'}
            description={
              'План определяет внутренние лимиты workspace: участников, токены и доступные business возможности. Владельцы и super-admin могут менять план без внешнего SaaS-биллинга.'
            }
          />
          <div className={styles.grid}>
            {data?.plans.map((plan) => {
              const isCurrent = data.plan === plan.id;

              return (
                <SettingCard
                  action={isCurrent ? <ShieldCheck size={18} /> : undefined}
                  gap={10}
                  highlight={isCurrent}
                  key={plan.id}
                  title={plan.name}
                >
                  <Flexbox gap={4}>
                    <Text fontSize={13} type={'secondary'}>
                      Участники: {formatLimit(plan.limits.members)}
                    </Text>
                    <Text fontSize={13} type={'secondary'}>
                      Токены в месяц: {formatLimit(plan.limits.monthlyTokens)}
                    </Text>
                  </Flexbox>
                  <Button
                    block
                    disabled={!canManage || isCurrent}
                    loading={pendingPlan === plan.id}
                    size={'small'}
                    type={isCurrent ? 'primary' : 'default'}
                    onClick={() => confirmPlan(plan.id, plan.name)}
                  >
                    {isCurrent ? 'Текущий тариф' : canManage ? 'Назначить тариф' : 'Только владелец'}
                  </Button>
                </SettingCard>
              );
            })}
          </div>
          {!canManage && (
            <Text fontSize={13} type={'secondary'}>
              Сменить тариф могут владелец workspace и super-admin.
            </Text>
          )}
        </Flexbox>
      </AsyncSection>
    </Flexbox>
  );
});

WorkspaceBillingPlans.displayName = 'WorkspaceBillingPlans';

export default WorkspaceBillingPlans;
