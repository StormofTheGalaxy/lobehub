'use client';

import { Avatar, Block, Flexbox, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo } from 'react';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useDiscoverStore } from '@/store/discover';
import type { StarterMode } from '@/store/home';
import { AssistantCategory, type DiscoverAssistantItem } from '@/types/discover';

import { RECENT_BLOCK_SIZE } from '../const';

interface AssistantListProps {
  mode: StarterMode;
}

const AssistantCard = memo<DiscoverAssistantItem>(
  ({ avatar, backgroundColor, description, identifier, title }) => {
    const navigate = useWorkspaceAwareNavigate();

    return (
      <Block
        clickable
        flex={'none'}
        height={RECENT_BLOCK_SIZE.AGENT.HEIGHT}
        padding={14}
        style={{ overflow: 'hidden' }}
        variant={'outlined'}
        width={RECENT_BLOCK_SIZE.AGENT.WIDTH}
        onClick={() => navigate(`/community/agent/${identifier}`)}
      >
        <Flexbox gap={10} height={'100%'}>
          <Avatar
            avatar={avatar}
            background={backgroundColor || 'transparent'}
            shape={'square'}
            size={40}
          />
          <Flexbox gap={4} style={{ minWidth: 0 }}>
            <Text ellipsis fontSize={14} weight={600}>
              {title}
            </Text>
            <Text color={cssVar.colorTextSecondary} ellipsis={{ rows: 3 }} fontSize={12}>
              {description}
            </Text>
          </Flexbox>
        </Flexbox>
      </Block>
    );
  },
);

const AssistantList = memo<AssistantListProps>(({ mode }) => {
  const useAssistantList = useDiscoverStore((s) => s.useAssistantList);
  const category = mode === 'write' ? AssistantCategory.CopyWriting : undefined;
  const { data } = useAssistantList({ category, page: 1, pageSize: 12 });

  return (data?.items ?? [])
    .slice(0, 12)
    .map((item) => <AssistantCard key={item.identifier} {...item} />);
});

export default AssistantList;
