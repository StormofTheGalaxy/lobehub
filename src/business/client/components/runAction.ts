import { toast } from '@lobehub/ui/base-ui';

interface RunActionOptions {
  /** Shown when the action throws; the server message is appended when present. */
  errorTitle: string;
  /** Shown on success. Omit for actions whose result is visible on screen anyway. */
  successTitle?: string;
}

const extractMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }

  return undefined;
};

/**
 * Run a mutation and always tell the user how it went.
 *
 * Business pages used to `await` a mutation inside a bare `try/finally`, so a
 * rejected call left the form untouched and silent — the user could not tell a
 * rejected role change from a slow one. This keeps the busy flag honest and
 * surfaces the server's own message, which for these endpoints is written for
 * humans ("Требуется роль владельца workspace", "Workspace slug already exists").
 *
 * Returns `true` when the action succeeded, so callers can gate follow-up work
 * (clearing a form, closing a row) on it.
 */
export const runAction = async (
  action: () => Promise<unknown>,
  { errorTitle, successTitle }: RunActionOptions,
): Promise<boolean> => {
  try {
    await action();
    if (successTitle) toast.success({ title: successTitle });

    return true;
  } catch (error) {
    const detail = extractMessage(error);
    toast.error({ description: detail, title: errorTitle });

    return false;
  }
};
