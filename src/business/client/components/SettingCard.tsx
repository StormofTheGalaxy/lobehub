'use client';

import { Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import type { LucideIcon } from 'lucide-react';
import { memo, type ReactNode } from 'react';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    padding: 20px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 22px;
    background: ${cssVar.colorBgContainer};
  `,
  hero: css`
    padding: 24px;
    border-radius: 26px;
    background:
      radial-gradient(circle at 100% 0, ${cssVar.colorPrimaryBg} 0, transparent 42%),
      ${cssVar.colorBgContainer};
  `,
  highlight: css`
    border-color: ${cssVar.colorPrimary};
  `,
}));

export interface SettingCardProps {
  /** Right-hand slot of the header row — a single action or a status tag. */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  gap?: number;
  /** Draws the accent border used for "this is the active/primary one". */
  highlight?: boolean;
  icon?: LucideIcon;
  title?: ReactNode;
  /** Larger padding + accent wash, for the leading card of a page. */
  variant?: 'default' | 'hero';
}

/**
 * The card chrome every business settings page uses. Kept in one place so the
 * pages read as one product instead of eight hand-tuned variants of the same
 * border radius.
 */
const SettingCard = memo<SettingCardProps>(
  ({
    action,
    children,
    className,
    description,
    gap = 12,
    highlight,
    icon,
    title,
    variant = 'default',
  }) => (
    <Flexbox
      gap={gap}
      className={[
        styles.card,
        variant === 'hero' && styles.hero,
        highlight && styles.highlight,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {(title || action) && (
        <Flexbox horizontal align={'center'} gap={10} justify={'space-between'}>
          <Flexbox horizontal align={'center'} gap={10}>
            {icon && <Icon icon={icon} size={variant === 'hero' ? 22 : 18} />}
            <Text weight={600}>{title}</Text>
          </Flexbox>
          {action}
        </Flexbox>
      )}
      {description && <Text type={'secondary'}>{description}</Text>}
      {children}
    </Flexbox>
  ),
);

SettingCard.displayName = 'SettingCard';

export default SettingCard;
