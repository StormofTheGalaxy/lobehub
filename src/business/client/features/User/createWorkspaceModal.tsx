'use client';

import { Flexbox, Input, Text } from '@lobehub/ui';
import { Button, createModal, useModalContext } from '@lobehub/ui/base-ui';
import { useMemo, useState } from 'react';

import { lambdaClient } from '@/libs/trpc/client';

import { runAction } from '../../components/runAction';

/** Mirrors the server-side slug schema, so a rejection is caught before the call. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/i;

export interface CreatedWorkspace {
  id: string;
  slug: string;
}

const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replaceAll(/[^\da-z]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 100);

interface CreateWorkspaceFormProps {
  onCreated: (workspace: CreatedWorkspace) => Promise<void> | void;
}

const CreateWorkspaceForm = ({ onCreated }: CreateWorkspaceFormProps) => {
  const { close } = useModalContext();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  // The slug follows the name until the user takes it over — a workspace named
  // "Маркетинг" should not silently become `workspace-lq3k9x`.
  const effectiveSlug = slugTouched ? slug : slugify(name);

  const slugError = useMemo(() => {
    if (!effectiveSlug) return 'Укажите адрес workspace.';
    if (effectiveSlug.length < 2) return 'Адрес должен содержать минимум 2 символа.';
    if (!SLUG_PATTERN.test(effectiveSlug)) return 'Разрешены латинские буквы, цифры и дефис внутри.';

    return undefined;
  }, [effectiveSlug]);

  const canSubmit = !!name.trim() && !slugError;

  const submit = async () => {
    if (!canSubmit) return;

    setCreating(true);
    let created: CreatedWorkspace | undefined;
    const ok = await runAction(
      async () => {
        created = await lambdaClient.workspace.create.mutate({
          name: name.trim(),
          slug: effectiveSlug,
        });
      },
      { errorTitle: 'Не удалось создать workspace', successTitle: `Workspace «${name.trim()}» создан` },
    );
    setCreating(false);

    if (!ok || !created) return;
    close();
    await onCreated(created);
  };

  return (
    <Flexbox gap={14}>
      <Flexbox gap={4}>
        <Text weight={600}>Название</Text>
        <Input
          autoFocus
          placeholder={'Например, Маркетинг'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={submit}
        />
      </Flexbox>
      <Flexbox gap={4}>
        <Text weight={600}>Адрес</Text>
        <Input
          placeholder={'marketing'}
          value={effectiveSlug}
          onPressEnter={submit}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
        <Text fontSize={13} type={name && slugError ? 'danger' : 'secondary'}>
          {name && slugError ? slugError : `Workspace будет доступен по адресу /${effectiveSlug}`}
        </Text>
      </Flexbox>
      <Flexbox horizontal gap={8} justify={'flex-end'}>
        <Button onClick={close}>Отмена</Button>
        <Button disabled={!canSubmit} loading={creating} type={'primary'} onClick={submit}>
          Создать
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

/**
 * Ask for a name before creating a workspace. Both entry points (user panel and
 * the me-cells menu) share it, so the two flows cannot drift apart.
 */
export const openCreateWorkspaceModal = (onCreated: CreateWorkspaceFormProps['onCreated']) =>
  createModal({
    content: <CreateWorkspaceForm onCreated={onCreated} />,
    footer: null,
    maskClosable: true,
    title: 'Создать workspace',
    width: 'min(90vw, 460px)',
  });
