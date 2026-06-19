import { useSyncExternalStore } from 'react';

let activeWorkspaceId: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getActiveWorkspaceId = (): string | null => activeWorkspaceId;

export const setActiveWorkspaceId = (id: string | null): void => {
  if (activeWorkspaceId === id) return;
  activeWorkspaceId = id;
  for (const listener of listeners) listener();
};

export const useActiveWorkspaceId = (): string | null =>
  useSyncExternalStore(subscribe, getActiveWorkspaceId, getActiveWorkspaceId);
