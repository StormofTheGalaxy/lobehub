import { toast } from '@lobehub/ui/base-ui';
import type { ItemType } from 'antd/es/menu/interface';
import { useTranslation } from 'react-i18next';

import { useActiveWorkspaceId } from './useActiveWorkspaceId';
import { useWorkspaces } from './useWorkspaces';

interface TransferItemsParams {
  copy?: (targetWorkspaceId: string | null) => Promise<unknown>;
  enabled?: boolean;
  move?: (targetWorkspaceId: string | null) => Promise<unknown>;
}

/** Server errors arrive as TRPCClientError; fall back to the generic copy. */
const errorDetail = (error: unknown): string | undefined => {
  const message = error instanceof Error ? error.message : undefined;
  return message && message.length < 160 ? message : undefined;
};

/**
 * Shared "Move to / Copy to <workspace>" submenu for every transferable
 * resource (agent, agent group, task, document, file, knowledge base).
 *
 * Both actions are fire-and-forget from the menu's point of view, so the
 * outcome has to be reported here — a silent failure is indistinguishable from
 * a slow success, and the resource simply stays where it was.
 */
export const useWorkspaceTransferItems = ({ copy, enabled = true, move }: TransferItemsParams) => {
  const { t } = useTranslation('common');
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaces = useWorkspaces();

  if (!enabled || (!move && !copy)) return null;

  const targets = [
    { id: null, name: t('workspaceTransfer.personal') },
    ...workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name })),
  ].filter((target) => target.id !== activeWorkspaceId);

  if (targets.length === 0) return null;

  const run = async (
    action: (targetWorkspaceId: string | null) => Promise<unknown>,
    target: { id: string | null; name: string },
    kind: 'copy' | 'move',
  ) => {
    try {
      await action(target.id);
      toast.success(t(`workspaceTransfer.${kind}Success`, { name: target.name }));
    } catch (error) {
      toast.error({
        description: errorDetail(error),
        title: t(`workspaceTransfer.${kind}Error`, { name: target.name }),
      });
    }
  };

  const children: ItemType[] = [];

  if (move) {
    children.push({
      children: targets.map((target) => ({
        key: `move-${target.id ?? 'personal'}`,
        label: target.name,
        onClick: () => run(move, target, 'move'),
      })),
      key: 'move-to-workspace',
      label: t('workspaceTransfer.moveTo'),
    });
  }

  if (copy) {
    children.push({
      children: targets.map((target) => ({
        key: `copy-${target.id ?? 'personal'}`,
        label: target.name,
        onClick: () => run(copy, target, 'copy'),
      })),
      key: 'copy-to-workspace',
      label: t('workspaceTransfer.copyTo'),
    });
  }

  return children;
};
