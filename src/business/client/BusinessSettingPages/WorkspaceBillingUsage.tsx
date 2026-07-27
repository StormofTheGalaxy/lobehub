'use client';

import { formatIntergerNumber, formatUsageValue } from '@lobechat/utils/format';
import { Flexbox, Text } from '@lobehub/ui';
import { Progress } from 'antd';
import { createStaticStyles } from 'antd-style';
import { ChartColumnBigIcon } from 'lucide-react';
import { memo } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import AsyncSection from '../components/AsyncSection';
import SettingCard from '../components/SettingCard';
import { useActiveWorkspace } from '../hooks/useActiveWorkspace';

const styles = createStaticStyles(({ css }) => ({
  metrics: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;

    @media (width <= 760px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  value: css`
    font-size: 26px;
    font-weight: 700;
    line-height: 1.2;
  `,
}));

const UNLIMITED = -1;

const Metric = memo<{ hint?: string; label: string; value: string }>(({ hint, label, value }) => (
  <Flexbox gap={2}>
    <Text fontSize={13} type={'secondary'}>
      {label}
    </Text>
    <Text className={styles.value}>{value}</Text>
    {hint && (
      <Text fontSize={12} type={'secondary'}>
        {hint}
      </Text>
    )}
  </Flexbox>
));

Metric.displayName = 'UsageMetric';

const QuotaBar = memo<{ exceeded: boolean; label: string; limit: number; used: number }>(
  ({ exceeded, label, limit, used }) => {
    const unlimited = limit === UNLIMITED;
    const percent = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));

    return (
      <Flexbox gap={4}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text fontSize={13}>{label}</Text>
          <Text fontSize={13} type={exceeded ? 'danger' : 'secondary'}>
            {formatIntergerNumber(used)} / {unlimited ? 'без лимита' : formatIntergerNumber(limit)}
          </Text>
        </Flexbox>
        {!unlimited && (
          <Progress
            percent={percent}
            showInfo={false}
            size={'small'}
            status={exceeded ? 'exception' : 'normal'}
          />
        )}
      </Flexbox>
    );
  },
);

QuotaBar.displayName = 'QuotaBar';

const WorkspaceBillingUsage = memo(() => {
  const workspace = useActiveWorkspace();
  const {
    data,
    error,
    isLoading,
    mutate: reloadUsage,
  } = useSWR(workspace ? ['business/workspace-usage', workspace.id] : null, () =>
    lambdaClient.workspaceUsage.summary.query({ workspaceId: workspace!.id }),
  );
  const {
    data: quota,
    error: quotaError,
    mutate: reloadQuota,
  } = useSWR(workspace ? ['business/workspace-quota', workspace.id] : null, () =>
    lambdaClient.workspaceUsage.quotaStatus.query({ workspaceId: workspace!.id }),
  );

  if (!workspace)
    return (
      <SettingCard
        description={'Откройте настройки внутри workspace, чтобы увидеть его метрики.'}
        icon={ChartColumnBigIcon}
        title={'Workspace не выбран'}
      />
    );

  const retry = () => {
    void reloadUsage();
    void reloadQuota();
  };

  return (
    <Flexbox gap={16} style={{ maxWidth: 860 }}>
      {/* A failed metrics fetch must not fall through to a confident row of
          zeros — the error branch comes before any aggregate is rendered. */}
      <AsyncSection
        error={error ?? quotaError}
        loading={isLoading && !data}
        skeletonRows={3}
        onRetry={retry}
      >
        <Flexbox gap={16}>
          <SettingCard
            description={'Метрики self-hosted workspace из локальной базы данных.'}
            icon={ChartColumnBigIcon}
            title={'Использование'}
            variant={'hero'}
          >
            <div className={styles.metrics}>
              <Metric label={'Участники'} value={formatIntergerNumber(data?.members ?? 0)} />
              <Metric label={'Сообщения'} value={formatIntergerNumber(data?.messages ?? 0)} />
              <Metric
                hint={`${formatIntergerNumber(data?.tokens ?? 0)} всего`}
                label={'Токены'}
                value={formatUsageValue(data?.tokens ?? 0)}
              />
              <Metric
                hint={'по данным моделей'}
                label={'Оценочная стоимость'}
                value={`$${(data?.cost ?? 0).toFixed(2)}`}
              />
            </div>
          </SettingCard>

          {quota && (
            <SettingCard
              description={`Текущий тариф: ${quota.plan}`}
              title={'Лимиты тарифа'}
            >
              <QuotaBar
                exceeded={quota.exceeded.members}
                label={'Участники'}
                limit={quota.limits.members}
                used={quota.used.members}
              />
              <QuotaBar
                exceeded={quota.exceeded.monthlyTokens}
                label={'Токены за месяц'}
                limit={quota.limits.monthlyTokens}
                used={quota.used.monthlyTokens}
              />
            </SettingCard>
          )}
        </Flexbox>
      </AsyncSection>
    </Flexbox>
  );
});

WorkspaceBillingUsage.displayName = 'WorkspaceBillingUsage';

export default WorkspaceBillingUsage;
