'use client';

import { formatIntergerNumber } from '@lobechat/utils/format';
import { Flexbox, Input, Tag, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { Coins, PlusCircle } from 'lucide-react';
import { memo, useState } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import AsyncSection from '../components/AsyncSection';
import { runAction } from '../components/runAction';
import SettingCard from '../components/SettingCard';
import { useActiveWorkspace } from '../hooks/useActiveWorkspace';
import { useWorkspaceManageRights } from '../hooks/useWorkspacePermission';

const styles = createStaticStyles(({ css }) => ({
  balance: css`
    font-size: 40px;
    font-weight: 800;
    line-height: 1.1;
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
}));

const WorkspaceBillingCredits = memo(() => {
  const workspace = useActiveWorkspace();
  const { canOwn: canManage } = useWorkspaceManageRights();
  const [amount, setAmount] = useState('');
  const [toppingUp, setToppingUp] = useState(false);
  const { data, error, isLoading, mutate } = useSWR(
    workspace ? ['business/workspace-credits', workspace.id] : null,
    () => lambdaClient.workspaceCredits.getBalance.query({ workspaceId: workspace!.id }),
  );

  if (!workspace)
    return (
      <SettingCard
        description={'Откройте настройки внутри workspace, чтобы увидеть его баланс.'}
        icon={Coins}
        title={'Workspace не выбран'}
      />
    );

  const parsedAmount = Number(amount);
  const amountIsValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const topUp = async () => {
    if (!amountIsValid) return;

    setToppingUp(true);
    const ok = await runAction(
      () =>
        lambdaClient.topUp.create.mutate({
          amount: parsedAmount,
          note: 'Ручное внутреннее пополнение',
          workspaceId: workspace.id,
        }),
      {
        errorTitle: 'Не удалось пополнить баланс',
        successTitle: `Баланс пополнен на ${formatIntergerNumber(parsedAmount)}`,
      },
    );
    setToppingUp(false);

    if (!ok) return;
    setAmount('');
    await mutate();
  };

  const balance = data?.balance ?? 0;

  return (
    <Flexbox gap={18} style={{ maxWidth: 760 }}>
      <AsyncSection
        error={error}
        loading={isLoading && !data}
        skeletonRows={2}
        onRetry={() => void mutate()}
      >
        <Flexbox gap={18}>
          <SettingCard
            icon={Coins}
            title={'Кредиты workspace'}
            variant={'hero'}
            description={
              'Общий баланс команды для Acensus AI. Пополнения видят владельцы и super-admin, участники используют доступный баланс в workspace-сценариях.'
            }
          >
            <Flexbox horizontal align={'center'} gap={10} wrap={'wrap'}>
              <Text className={styles.balance}>{formatIntergerNumber(balance)}</Text>
              <Tag>{data?.currency ?? 'tokens'}</Tag>
              <Tag color={balance > 0 ? 'green' : 'red'}>
                {balance > 0 ? 'Доступно' : 'Баланс исчерпан'}
              </Tag>
            </Flexbox>
            {balance <= 0 && (
              <Text fontSize={13} type={'secondary'}>
                Пока баланс на нуле, запросы через Acensus AI в этом workspace будут отклоняться.
              </Text>
            )}
          </SettingCard>

          {canManage ? (
            <SettingCard
              description={'Пополнение записывается в историю workspace с вашим user id.'}
              icon={PlusCircle}
              title={'Пополнить баланс'}
            >
              <Flexbox horizontal className={styles.mobileStack} gap={8}>
                <Input
                  placeholder={'Сумма в токенах'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <Button
                  disabled={!amountIsValid}
                  icon={<PlusCircle size={16} />}
                  loading={toppingUp}
                  type={'primary'}
                  onClick={topUp}
                >
                  Пополнить
                </Button>
              </Flexbox>
              {!!amount && !amountIsValid && (
                <Text fontSize={13} type={'danger'}>
                  Сумма должна быть положительным числом.
                </Text>
              )}
            </SettingCard>
          ) : (
            <SettingCard
              title={'Пополнение недоступно'}
              description={
                'Пополнять баланс могут владелец workspace и super-admin. Обратитесь к ним, если кредиты закончились.'
              }
            />
          )}
        </Flexbox>
      </AsyncSection>
    </Flexbox>
  );
});

WorkspaceBillingCredits.displayName = 'WorkspaceBillingCredits';

export default WorkspaceBillingCredits;
