'use client';

import { Flexbox, Input, Text } from '@lobehub/ui';
import { Button, Select } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import dayjs from 'dayjs';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import AsyncSection from '../components/AsyncSection';
import { useActiveWorkspace } from '../hooks/useActiveWorkspace';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    padding: 20px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 22px;
    background: ${cssVar.colorBgContainer};
  `,
  controls: css`
    @media (width <= 720px) {
      flex-direction: column;
      align-items: stretch;

      > * {
        width: 100% !important;
      }
    }
  `,
  meta: css`
    font-size: 13px;
    color: ${cssVar.colorTextSecondary};
  `,
  metadata: css`
    overflow-x: auto;

    margin: 0;
    padding: 10px 12px;
    border-radius: 12px;

    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillQuaternary};
  `,
  row: css`
    padding-block: 12px;

    & + & {
      border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    }
  `,
}));

const PAGE_SIZE = 25;

type AuditItem = Awaited<
  ReturnType<typeof lambdaClient.workspaceAuditLog.list.query>
>['items'][number];

const hasMetadata = (metadata: unknown) =>
  !!metadata && typeof metadata === 'object' && Object.keys(metadata as object).length > 0;

const WorkspaceAuditLog = memo(() => {
  const { t } = useTranslation('setting');
  const workspace = useActiveWorkspace();
  const [action, setAction] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string>();
  // Cursor of the page being displayed; "load more" walks it backwards in time,
  // so every fetch stays a single indexed query instead of a growing offset.
  const [cursor, setCursor] = useState<string>();
  const [olderPages, setOlderPages] = useState<AuditItem[]>([]);

  const workspaceId = workspace?.id;

  const { data: actions = [] } = useSWR(
    workspaceId ? ['business/workspace-audit-actions', workspaceId] : null,
    () => lambdaClient.workspaceAuditLog.listActions.query({ workspaceId: workspaceId! }),
  );

  const { data, error, isLoading, mutate } = useSWR(
    workspaceId ? ['business/workspace-audit', workspaceId, action, query, cursor] : null,
    () =>
      lambdaClient.workspaceAuditLog.list.query({
        action: action === 'all' ? undefined : action,
        cursor: cursor ? new Date(cursor) : undefined,
        limit: PAGE_SIZE,
        q: query.trim() || undefined,
        workspaceId: workspaceId!,
      }),
    { keepPreviousData: true },
  );

  const items = useMemo(() => [...olderPages, ...(data?.items ?? [])], [olderPages, data]);
  // A zero-result search is a different situation from an empty log, and only
  // one of the two is fixed by clearing the filters.
  const isFiltered = action !== 'all' || !!query.trim();

  const applyFilter = (apply: () => void) => {
    apply();
    setCursor(undefined);
    setOlderPages([]);
  };

  const loadMore = () => {
    if (!data?.nextCursor) return;
    setOlderPages(items);
    setCursor(data.nextCursor);
  };

  const actionOptions = useMemo(
    () => [
      { label: t('workspace.auditLog.filters.allActions'), value: 'all' },
      ...actions.map((value) => ({
        label: t(`workspace.auditLog.actions.${value}` as any, { defaultValue: value }),
        value,
      })),
    ],
    [actions, t],
  );

  if (!workspace) return null;

  return (
    <Flexbox gap={18} style={{ maxWidth: 960 }}>
      <Flexbox className={styles.card} gap={12}>
        <Flexbox gap={4}>
          <Text weight={600}>{t('workspaceSetting.tab.auditLog')}</Text>
          <Text type={'secondary'}>{t('workspace.auditLog.desc')}</Text>
        </Flexbox>
        <Flexbox horizontal align={'center'} className={styles.controls} gap={8}>
          <Input
            placeholder={t('workspace.auditLog.filters.searchPlaceholder')}
            value={query}
            onChange={(e) => applyFilter(() => setQuery(e.target.value))}
          />
          <Select
            options={actionOptions}
            style={{ width: 220 }}
            value={action}
            onChange={(value) => applyFilter(() => setAction(value as string))}
          />
          <Button
            onClick={() =>
              applyFilter(() => {
                setAction('all');
                setQuery('');
              })
            }
          >
            {t('workspace.auditLog.filters.reset')}
          </Button>
        </Flexbox>
      </Flexbox>

      <AsyncSection
        error={error}
        loading={isLoading && items.length === 0}
        skeletonRows={5}
        onRetry={() => void mutate()}
      >
      <Flexbox className={styles.card}>
        {items.length === 0 ? (
          <Flexbox gap={4} paddingBlock={12}>
            <Text weight={600}>
              {isFiltered
                ? t('workspace.auditLog.filters.allActions')
                : t('workspace.auditLog.empty')}
            </Text>
            <Text className={styles.meta}>
              {isFiltered ? t('workspace.auditLog.filters.reset') : t('workspace.auditLog.desc')}
            </Text>
            {isFiltered && (
              <Flexbox align={'flex-start'} paddingBlock={8}>
                <Button
                  size={'small'}
                  onClick={() =>
                    applyFilter(() => {
                      setAction('all');
                      setQuery('');
                    })
                  }
                >
                  {t('workspace.auditLog.filters.reset')}
                </Button>
              </Flexbox>
            )}
          </Flexbox>
        ) : (
          items.map((item) => (
            <Flexbox className={styles.row} gap={6} key={item.id}>
              <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
                <Text weight={600}>
                  {t(`workspace.auditLog.actions.${item.action}` as any, {
                    defaultValue: item.action,
                  })}
                </Text>
                <Text className={styles.meta}>
                  {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                </Text>
              </Flexbox>
              <Text className={styles.meta}>
                {t('workspace.auditLog.columns.operator')}: {item.actorLabel || '—'}
                {item.resourceType
                  ? ` · ${t('workspace.auditLog.columns.resourceType')}: ${t(
                      `workspace.auditLog.resourceTypes.${item.resourceType}` as any,
                      { defaultValue: item.resourceType },
                    )}`
                  : ''}
                {item.ipAddress ? ` · ${t('workspace.auditLog.columns.ip')}: ${item.ipAddress}` : ''}
              </Text>
              {hasMetadata(item.metadata) && (
                <Flexbox align={'flex-start'} gap={6}>
                  <Button
                    size={'small'}
                    onClick={() => setExpandedId(expandedId === item.id ? undefined : item.id)}
                  >
                    {t('workspace.auditLog.detail.view')}
                  </Button>
                  {expandedId === item.id && (
                    <pre className={styles.metadata}>{JSON.stringify(item.metadata, null, 2)}</pre>
                  )}
                </Flexbox>
              )}
            </Flexbox>
          ))
        )}
      </Flexbox>
      </AsyncSection>

      {data?.nextCursor && (
        <Flexbox align={'center'}>
          <Button loading={isLoading} onClick={loadMore}>
            {t('workspace.auditLog.loadMore')}
          </Button>
        </Flexbox>
      )}
    </Flexbox>
  );
});

WorkspaceAuditLog.displayName = 'WorkspaceAuditLog';

export default WorkspaceAuditLog;
