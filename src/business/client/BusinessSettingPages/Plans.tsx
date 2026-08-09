'use client';

import { formatIntergerNumber } from '@lobechat/utils/format';
import { Flexbox, Tag, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { CheckCircle2, CircleGauge, Coins, Sparkles } from 'lucide-react';
import { memo } from 'react';
import { useNavigate } from 'react-router';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import AsyncSection from '../components/AsyncSection';
import SettingCard from '../components/SettingCard';

const styles = createStaticStyles(({ css }) => ({
  grid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;

    @media (width <= 760px) {
      grid-template-columns: 1fr;
    }
  `,
}));

const formatLimit = (value: number) => (value === -1 ? 'Без лимита' : formatIntergerNumber(value));

const Plans = memo(() => {
  const navigate = useNavigate();
  const { data, error, isLoading, mutate } = useSWR('business/personal-billing', () =>
    lambdaClient.personalBilling.get.query(),
  );

  const credits = data?.credits ?? 0;

  return (
    <Flexbox gap={18} style={{ maxWidth: 980 }}>
      <AsyncSection
        error={error}
        loading={isLoading && !data}
        skeletonRows={3}
        onRetry={() => void mutate()}
      >
        <Flexbox gap={18}>
          <SettingCard
            icon={Sparkles}
            title={'Личный тариф Acensus AI'}
            variant={'hero'}
            action={
              <Button
                icon={<Coins size={16} />}
                size={'small'}
                onClick={() => navigate('/settings/credits')}
              >
                Баланс и начисления
              </Button>
            }
            description={
              'Личный аккаунт по умолчанию стартует с 0 токенов. Super-admin может выдать баланс для персональных агентов, тестов и демо-сценариев без создания workspace.'
            }
          >
            <Flexbox horizontal gap={8} wrap={'wrap'}>
              <Tag color={data?.plan === 'personal' ? 'green' : 'default'}>
                {data?.plan === 'personal' ? 'Баланс выдан' : '0 токенов по умолчанию'}
              </Tag>
              <Tag>Кредиты: {formatIntergerNumber(credits)}</Tag>
            </Flexbox>
          </SettingCard>

          <div className={styles.grid}>
            {data?.plans.map((plan) => {
              const isCurrent = plan.id === data.plan;

              return (
                <SettingCard
                  description={plan.description}
                  highlight={isCurrent}
                  key={plan.id}
                  title={plan.name}
                  action={
                    isCurrent ? <CheckCircle2 size={20} /> : <CircleGauge opacity={0.4} size={20} />
                  }
                >
                  <Flexbox gap={4}>
                    <Text fontSize={13} type={'secondary'}>
                      Месячные токены: {formatLimit(plan.limits.monthlyTokens)}
                    </Text>
                    <Text fontSize={13} type={'secondary'}>
                      Workspace: {formatLimit(plan.limits.workspaces)}
                    </Text>
                  </Flexbox>
                  <Tag color={isCurrent ? 'green' : 'default'}>
                    {isCurrent ? 'Текущий тариф' : 'Назначает super-admin'}
                  </Tag>
                </SettingCard>
              );
            })}
          </div>
        </Flexbox>
      </AsyncSection>
    </Flexbox>
  );
});

Plans.displayName = 'Plans';

export default Plans;
