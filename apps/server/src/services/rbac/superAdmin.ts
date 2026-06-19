import type { LobeChatDatabase } from '@lobechat/database';
import { permissions, rolePermissions, roles, userRoles } from '@lobechat/database/schemas';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * Email суперадмина. По умолчанию — основной владелец Acensus.
 * Перекрывается env-переменной `ACENSUS_SUPER_ADMIN_EMAILS`
 * (одна или несколько через запятую).
 *
 * NOTE: только email-адреса в lower-case сравниваются.
 */
export const DEFAULT_SUPER_ADMIN_EMAILS = ['contact@r-artemev.ru'];

const SUPER_ADMIN_ROLE_NAME = 'super_admin';
const PRESET_MANAGE_PERMISSION_CODE = 'agent_preset:manage:all';

const PERMISSIONS_TO_SEED = [
  {
    category: 'agent_preset',
    code: PRESET_MANAGE_PERMISSION_CODE,
    description: 'Manage internal Acensus agent presets (CRUD + publish/archive)',
    name: 'Manage agent presets',
  },
];

export const getSuperAdminEmails = (): string[] => {
  const fromEnv = process.env.ACENSUS_SUPER_ADMIN_EMAILS;
  const list = fromEnv
    ? fromEnv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_SUPER_ADMIN_EMAILS;
  return list.map((e) => e.toLowerCase());
};

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.toLowerCase());
};

/**
 * Идемпотентно создаёт роль `super_admin` (workspaceId=NULL) и
 * необходимые permission-коды, и связывает их.
 * Возвращает id роли super_admin.
 */
export const ensureSuperAdminRole = async (db: LobeChatDatabase): Promise<string> => {
  // 1. Roles
  const [existingRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.name, SUPER_ADMIN_ROLE_NAME), isNull(roles.workspaceId)))
    .limit(1);

  let roleId = existingRole?.id;
  if (!roleId) {
    const [created] = await db
      .insert(roles)
      .values({
        description: 'Acensus super administrator (full access)',
        displayName: 'Super Administrator',
        isActive: true,
        isSystem: true,
        name: SUPER_ADMIN_ROLE_NAME,
        workspaceId: null,
      })
      .returning({ id: roles.id });
    roleId = created.id;
  }

  // 2. Permissions
  for (const p of PERMISSIONS_TO_SEED) {
    const [existing] = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.code, p.code))
      .limit(1);
    let permId = existing?.id;
    if (!permId) {
      const [createdPerm] = await db
        .insert(permissions)
        .values({
          category: p.category,
          code: p.code,
          description: p.description,
          isActive: true,
          name: p.name,
        })
        .returning({ id: permissions.id });
      permId = createdPerm.id;
    }

    // 3. Role <-> Permission
    await db.insert(rolePermissions).values({ permissionId: permId, roleId }).onConflictDoNothing();
  }

  return roleId;
};

/**
 * Выдаёт пользователю глобальную роль super_admin, если её ещё нет.
 * Никогда не выдаёт автоматически — вызывайте только после
 * проверки `isSuperAdminEmail(email)`.
 */
export const grantSuperAdminToUser = async (
  db: LobeChatDatabase,
  userId: string,
): Promise<void> => {
  const roleId = await ensureSuperAdminRole(db);

  await db
    .insert(userRoles)
    .values({
      roleId,
      userId,
      workspaceId: null,
    })
    .onConflictDoNothing();
};

/**
 * Полный цикл: проверить email и выдать super_admin при совпадении.
 * Идемпотентно. Безопасно вызывать многократно (на каждом запросе).
 */
export const maybeGrantSuperAdmin = async (
  db: LobeChatDatabase,
  params: { email?: string | null; userId: string },
): Promise<boolean> => {
  if (!isSuperAdminEmail(params.email)) return false;
  try {
    await grantSuperAdminToUser(db, params.userId);
    return true;
  } catch (error) {
    console.error('[acensus:super-admin] failed to grant super_admin', error);
    return false;
  }
};
