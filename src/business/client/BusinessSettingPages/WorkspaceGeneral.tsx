'use client';

import { Flexbox, Input, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { Building2 } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import { runAction } from '../components/runAction';
import SettingCard from '../components/SettingCard';
import { useActiveWorkspace } from '../hooks/useActiveWorkspace';
import { useWorkspaceManageRights } from '../hooks/useWorkspacePermission';
import { WORKSPACE_LIST_KEY } from '../hooks/useWorkspaces';

/** Mirrors the server-side slug schema so a rejection is explained before the round-trip. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/i;

const WorkspaceGeneral = memo(() => {
  const workspace = useActiveWorkspace();
  const { mutate } = useSWRConfig();
  const { canManage } = useWorkspaceManageRights();
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('');

  useEffect(() => {
    setDescription(workspace?.description ?? '');
    setName(workspace?.name ?? '');
    setSlug(workspace?.slug ?? '');
  }, [workspace]);

  const nameError = name.trim() ? undefined : 'Название не может быть пустым.';
  const slugError = useMemo(() => {
    const value = slug.trim();
    if (value.length < 2) return 'Slug должен содержать минимум 2 символа.';
    if (!SLUG_PATTERN.test(value)) return 'Разрешены латинские буквы, цифры и дефис внутри.';

    return undefined;
  }, [slug]);

  const isDirty =
    name !== (workspace?.name ?? '') ||
    slug !== (workspace?.slug ?? '') ||
    description !== (workspace?.description ?? '');

  if (!workspace)
    return (
      <SettingCard
        description={'Откройте настройки внутри workspace, чтобы изменить его профиль.'}
        icon={Building2}
        title={'Workspace не выбран'}
      />
    );

  const save = async () => {
    if (nameError || slugError) return;

    setSaving(true);
    const ok = await runAction(
      () =>
        lambdaClient.workspace.update.mutate({
          description,
          id: workspace.id,
          name: name.trim(),
          slug: slug.trim(),
        }),
      {
        errorTitle: 'Не удалось сохранить изменения',
        successTitle: 'Настройки workspace сохранены',
      },
    );
    setSaving(false);

    if (ok) await mutate(WORKSPACE_LIST_KEY);
  };

  return (
    <Flexbox gap={16} style={{ maxWidth: 640 }}>
      <SettingCard
        icon={Building2}
        title={'Профиль workspace'}
        description={
          canManage
            ? 'Название и slug видны всей команде. Slug используется в адресе рабочего пространства.'
            : 'Профиль workspace редактируют владелец и администраторы. Вы видите текущие значения.'
        }
      >
        <Flexbox gap={4}>
          <Text weight={600}>Название</Text>
          <Input disabled={!canManage} value={name} onChange={(e) => setName(e.target.value)} />
          {canManage && nameError && (
            <Text fontSize={13} type={'danger'}>
              {nameError}
            </Text>
          )}
        </Flexbox>
        <Flexbox gap={4}>
          <Text weight={600}>Slug</Text>
          <Input disabled={!canManage} value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Text fontSize={13} type={slugError && canManage ? 'danger' : 'secondary'}>
            {slugError && canManage
              ? slugError
              : `Адрес workspace: /${slug.trim() || workspace.slug}`}
          </Text>
        </Flexbox>
        <Flexbox gap={4}>
          <Text weight={600}>Описание</Text>
          <Input
            disabled={!canManage}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Flexbox>
        {canManage && (
          <Flexbox horizontal align={'center'} gap={12}>
            <Button
              disabled={!isDirty || !!nameError || !!slugError}
              loading={saving}
              type={'primary'}
              onClick={save}
            >
              Сохранить изменения
            </Button>
            {isDirty && !saving && (
              <Text fontSize={13} type={'secondary'}>
                Есть несохраненные изменения
              </Text>
            )}
          </Flexbox>
        )}
      </SettingCard>
    </Flexbox>
  );
});

WorkspaceGeneral.displayName = 'WorkspaceGeneral';

export default WorkspaceGeneral;
