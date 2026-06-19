'use client';

import { ActionIcon, DropdownMenu } from '@lobehub/ui';
import { CreateBotIcon } from '@lobehub/ui/icons';
import type { ItemType } from 'antd/es/menu/interface';
import { cssVar } from 'antd-style';
import { ChevronDownIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import NavItem from '@/features/NavPanel/components/NavItem';

import { useCreateMenuItems } from '../hooks';

const isMenuItem = (item: ItemType | null): item is ItemType => Boolean(item);

const NewAgentButton = memo(() => {
  const { t } = useTranslation('chat');
  const {
    createAgentMenuItem,
    createGroupChatMenuItem,
    isAgentEditable,
    isMutatingAgent,
    openCreateModal,
  } = useCreateMenuItems();

  const dropdownItems = useMemo(
    () => [createAgentMenuItem(), createGroupChatMenuItem()].filter(isMenuItem),
    [createAgentMenuItem, createGroupChatMenuItem],
  );

  if (!isAgentEditable) return null;

  return (
    <NavItem
      icon={CreateBotIcon}
      loading={isMutatingAgent}
      title={t('newAgent')}
      actions={
        <DropdownMenu items={dropdownItems} nativeButton={false}>
          <ActionIcon
            color={cssVar.colorTextQuaternary}
            icon={ChevronDownIcon}
            size={'small'}
            style={{ flex: 'none' }}
          />
        </DropdownMenu>
      }
      onClick={() => openCreateModal?.('agent')}
    />
  );
});

export default NewAgentButton;
