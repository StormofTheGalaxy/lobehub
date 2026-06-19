'use client';

import { Avatar, Block, Flexbox, Tag, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo } from 'react';

import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useDiscoverStore } from '@/store/discover';
import type { DiscoverGroupAgentItem } from '@/types/discover';

import { RECENT_BLOCK_SIZE } from '../const';

const GroupCard = memo<DiscoverGroupAgentItem>(
  ({ avatar, backgroundColor, description, identifier, memberCount, title }) => {
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
        onClick={() => navigate(`/community/group_agent/${identifier}`)}
      >
        <Flexbox gap={10} height={'100%'}>
          <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
            <Avatar
              avatar={avatar}
              background={backgroundColor || 'transparent'}
              shape={'square'}
              size={40}
            />
            <Tag size={'small'}>{memberCount}</Tag>
          </Flexbox>
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

const GroupList = memo(() => {
  const useGroupAgentList = useDiscoverStore((s) => s.useGroupAgentList);
  const { data } = useGroupAgentList({ page: 1, pageSize: 12 });

  return (data?.items ?? [])
    .slice(0, 12)
    .map((item) => <GroupCard key={item.identifier} {...item} />);
});

export default GroupList;
