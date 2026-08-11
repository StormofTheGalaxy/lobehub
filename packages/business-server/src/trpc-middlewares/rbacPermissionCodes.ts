export const resolveScopedPermissionCodes = (code: string): string[] => {
  if (code.split(':').length >= 3) return [code];
  return [`${code}:all`, `${code}:owner`];
};
