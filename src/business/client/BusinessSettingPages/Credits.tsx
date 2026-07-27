'use client';

import { formatIntergerNumber } from '@lobechat/utils/format';
import { Flexbox, Input, Tag, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { Coins, ShieldCheck } from 'lucide-react';
import { memo, useState } from 'react';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import AsyncSection from '../components/AsyncSection';
import { runAction } from '../components/runAction';
import SettingCard from '../components/SettingCard';

const styles = createStaticStyles(({ css, cssVar }) => ({
  balance: css`
    font-size: 38px;
    font-weight: 800;
    line-height: 1.1;
  `,
  ledgerRow: css`
    padding-block: 12px;

    & + & {
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    }

    @media (width <= 720px) {
      flex-direction: column;
      align-items: flex-start;
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

interface PersonalCreditLedgerItem {
  amount: number;
  at: string;
  note?: string;
  type: string;
}

const ledgerLabel = (type: string) =>
  type === 'admin_grant'
    ? 'Начисление super-admin'
    : type === 'starter_grant'
      ? 'Стартовый баланс'
      : type;

const Credits = memo(() => {
  const [amount, setAmount] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [note, setNote] = useState('');
  const [granting, setGranting] = useState(false);
  const { data, error, isLoading, mutate } = useSWR('business/personal-billing', () =>
    lambdaClient.personalBilling.get.query(),
  );

  const parsedAmount = Number(amount);
  const amountIsValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  // The button explains what it is waiting for instead of silently ignoring a
  // click, which is what the previous `if (!valid) return` did.
  const grantBlockedReason = !targetUser.trim()
    ? 'Укажите user id или email получателя.'
    : amount && !amountIsValid
      ? 'Сумма должна быть положительным числом.'
      : undefined;

  const grant = async () => {
    if (!targetUser.trim() || !amountIsValid) return;

    setGranting(true);
    const ok = await runAction(
      () =>
        lambdaClient.personalBilling.grantCredits.mutate({
          amount: parsedAmount,
          note: note.trim() || undefined,
          user: targetUser.trim(),
        }),
      {
        errorTitle: 'Не удалось выдать кредиты',
        successTitle: `Начислено ${formatIntergerNumber(parsedAmount)} токенов`,
      },
    );
    setGranting(false);

    if (!ok) return;
    setAmount('');
    setNote('');
    setTargetUser('');
    await mutate();
  };

  const credits = data?.credits ?? 0;
  const ledger = (data?.ledger ?? []) as PersonalCreditLedgerItem[];

  return (
    <Flexbox gap={18} style={{ maxWidth: 860 }}>
      <AsyncSection
        error={error}
        loading={isLoading && !data}
        skeletonRows={4}
        onRetry={() => void mutate()}
      >
        <Flexbox gap={18}>
          <SettingCard
            icon={Coins}
            title={'Личный баланс'}
            variant={'hero'}
            description={
              'По умолчанию у пользователя 0 токенов Acensus AI. Баланс выдается вручную super-admin и используется для личного окружения без workspace.'
            }
          >
            <Flexbox horizontal align={'center'} gap={10} wrap={'wrap'}>
              <Text className={styles.balance}>{formatIntergerNumber(credits)}</Text>
              <Tag>{data?.currency ?? 'tokens'}</Tag>
              <Tag color={credits > 0 ? 'green' : 'default'}>
                {credits > 0 ? 'Доступно' : 'Баланс исчерпан'}
              </Tag>
            </Flexbox>
          </SettingCard>

          {data?.isSuperAdmin && (
            <SettingCard
              highlight
              icon={ShieldCheck}
              title={'Super-admin: выдать кредиты'}
              description={
                'Укажите user id или email. Начисление попадет в историю пользователя с вашим admin id.'
              }
            >
              <Flexbox horizontal className={styles.mobileStack} gap={8}>
                <Input
                  placeholder={'User id или email'}
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                />
                <Input
                  placeholder={'Сумма'}
                  style={{ width: 160 }}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <Button
                  disabled={!targetUser.trim() || !amountIsValid}
                  loading={granting}
                  type={'primary'}
                  onClick={grant}
                >
                  Выдать
                </Button>
              </Flexbox>
              <Input
                placeholder={'Комментарий для аудита'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {grantBlockedReason && (
                <Text className={styles.muted} fontSize={13}>
                  {grantBlockedReason}
                </Text>
              )}
            </SettingCard>
          )}

          <SettingCard title={'История начислений'}>
            {ledger.length === 0 ? (
              <Flexbox gap={4} paddingBlock={8}>
                <Text weight={600}>Начислений пока нет</Text>
                <Text className={styles.muted}>
                  Когда super-admin выдаст кредиты, они появятся здесь.
                </Text>
              </Flexbox>
            ) : (
              [...ledger].reverse().map((item, index) => (
                <Flexbox
                  horizontal
                  align={'center'}
                  className={styles.ledgerRow}
                  gap={12}
                  justify={'space-between'}
                  key={`${item.at}-${index}`}
                >
                  <Flexbox gap={2}>
                    <Text>{ledgerLabel(item.type)}</Text>
                    <Text className={styles.muted} fontSize={13}>
                      {new Date(item.at).toLocaleString('ru-RU')}
                      {item.note ? ` · ${item.note}` : ''}
                    </Text>
                  </Flexbox>
                  <Tag color={item.amount >= 0 ? 'green' : 'red'}>
                    {item.amount >= 0 ? '+' : ''}
                    {formatIntergerNumber(item.amount)}
                  </Tag>
                </Flexbox>
              ))
            )}
          </SettingCard>
        </Flexbox>
      </AsyncSection>
    </Flexbox>
  );
});

Credits.displayName = 'Credits';

export default Credits;
