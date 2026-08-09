'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { AlertTriangle } from 'lucide-react';
import { memo, type ReactNode } from 'react';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';

import SettingCard from './SettingCard';

interface AsyncSectionProps {
  children: ReactNode;
  /** SWR's `error` — checked before the loading and empty branches. */
  error?: unknown;
  /** True only while there is nothing to show yet (first load, not revalidation). */
  loading?: boolean;
  onRetry?: () => void;
  /** Skeleton rows to approximate the content being loaded. */
  skeletonRows?: number;
}

const resolveMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;

  return 'Не удалось загрузить данные.';
};

/**
 * Loading / failure wrapper for a data-driven section.
 *
 * The rule this enforces: a page must never render a confident zero. Without
 * it, `data?.balance ?? 0` paints "0 токенов" both while the request is in
 * flight and after it fails — two very different situations that read as the
 * same (wrong) fact.
 */
const AsyncSection = memo<AsyncSectionProps>(
  ({ children, error, loading, onRetry, skeletonRows = 3 }) => {
    if (error) {
      return (
        <SettingCard
          description={resolveMessage(error)}
          icon={AlertTriangle}
          title={'Данные недоступны'}
        >
          {onRetry && (
            <Flexbox align={'flex-start'}>
              <Button onClick={onRetry}>Повторить</Button>
            </Flexbox>
          )}
        </SettingCard>
      );
    }

    if (loading) {
      return (
        <SettingCard>
          <SkeletonList rows={skeletonRows} />
          <Text type={'secondary'}>Загружаем данные…</Text>
        </SettingCard>
      );
    }

    return <>{children}</>;
  },
);

AsyncSection.displayName = 'AsyncSection';

export default AsyncSection;
