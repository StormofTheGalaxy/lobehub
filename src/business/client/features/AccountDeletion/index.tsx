import { Flexbox, Input, Text } from '@lobehub/ui';
import { Button, confirmModal } from '@lobehub/ui/base-ui';
import { useState } from 'react';

import { lambdaClient } from '@/libs/trpc/client';
import { useUserStore } from '@/store/user';

import { runAction } from '../../components/runAction';

export default function AccountDeletion() {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const logout = useUserStore((s) => s.logout);

  return (
    <Flexbox gap={12}>
      <Text weight={600}>Удаление аккаунта</Text>
      <Text type="secondary">
        Операция удалит текущего пользователя и связанные данные через каскады базы данных. Для
        подтверждения введите DELETE_MY_ACCOUNT.
      </Text>
      <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
      <Button
        danger
        disabled={confirmation !== 'DELETE_MY_ACCOUNT'}
        loading={deleting}
        onClick={() =>
          confirmModal({
            cancelText: 'Отмена',
            content:
              'Аккаунт, его агенты, диалоги, файлы и баланс будут удалены безвозвратно. Восстановить их будет невозможно.',
            okButtonProps: { danger: true },
            okText: 'Удалить навсегда',
            onOk: async () => {
              setDeleting(true);
              const ok = await runAction(
                () =>
                  lambdaClient.accountDeletion.deleteCurrentUser.mutate({
                    confirmation: 'DELETE_MY_ACCOUNT',
                  }),
                { errorTitle: 'Не удалось удалить аккаунт' },
              );
              setDeleting(false);
              // Only sign out once the server confirmed the deletion — a failed
              // request must leave the user where they are, with the reason.
              if (ok) await logout();
            },
            title: 'Удалить аккаунт безвозвратно?',
          })
        }
      >
        Удалить аккаунт
      </Button>
    </Flexbox>
  );
}
