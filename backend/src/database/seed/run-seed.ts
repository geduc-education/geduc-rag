import { randomUUID } from 'node:crypto';
import type {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../@core/application/adapters/database-connection.interface';
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_PROFILES,
  DefaultProfile,
  PERMISSION_DESCRIPTIONS,
} from '../../common/rbac/permissions';

/** Entrada do seed, lida do ambiente pela CLI (`database/seed.ts`). */
export interface SeedEnv {
  nodeEnv: string | undefined;
  adminEmail: string;
  adminPassword: string | undefined;
  adminName: string;
}

/** Resumo do que o seed garantiu no banco. */
export interface SeedReport {
  skipped: 'production' | null;
  permissions: number;
  profiles: number;
  tenantSlug: string;
  superAdminCreated: boolean;
}

type HashFn = (password: string) => Promise<string>;

const DEFAULT_TENANT = { name: 'GEDUC', slug: 'geduc' };
const ADMIN_PROFILE = 'Administrador';

const UPSERT_PERMISSION_SQL =
  'INSERT INTO permission (id, `key`, description, updated_at) ' +
  'VALUES (?, ?, ?, NOW(3)) ' +
  'ON DUPLICATE KEY UPDATE description = ?, updated_at = NOW(3)';

const UPSERT_PROFILE_SQL =
  'INSERT INTO profile (id, name, description, `system`, updated_at) ' +
  'VALUES (?, ?, ?, 1, NOW(3)) ' +
  'ON DUPLICATE KEY UPDATE description = ?, `system` = 1, updated_at = NOW(3)';

const UPSERT_TENANT_SQL =
  'INSERT INTO tenant (id, name, slug, updated_at) ' +
  'VALUES (?, ?, ?, NOW(3)) ON DUPLICATE KEY UPDATE id = id';

const INSERT_USER_SQL =
  'INSERT INTO `user` (id, name, email, password_hash, is_super_admin, ' +
  'must_change_password, updated_at) VALUES (?, ?, ?, ?, 1, 1, NOW(3))';

async function seedPermissions(
  conn: IDatabaseConnection,
): Promise<Map<string, string>> {
  for (const key of ALL_PERMISSION_KEYS) {
    const description = PERMISSION_DESCRIPTIONS[key];
    await conn.insert(UPSERT_PERMISSION_SQL, [
      randomUUID(),
      key,
      description,
      description,
    ]);
  }
  const rows = await conn.query<{ id: string; key: string }>(
    'SELECT id, `key` FROM permission WHERE `key` IN (?)',
    [ALL_PERMISSION_KEYS],
  );
  return new Map(rows.map((row) => [row.key, row.id]));
}

async function requireId(
  conn: ITransactionalConnection,
  sql: string,
  value: string,
): Promise<string> {
  const row = await conn.queryOne<{ id: string }>(sql, [value]);
  if (!row) throw new Error(`Registro não encontrado após upsert: ${value}`);
  return row.id;
}

/** Regrava o conjunto de permissões do perfil (DELETE + INSERT em lote). */
async function rewriteProfilePermissions(
  tx: ITransactionalConnection,
  profileId: string,
  profile: DefaultProfile,
  permissionIds: Map<string, string>,
): Promise<void> {
  await tx.delete('DELETE FROM profile_permission WHERE profile_id = ?', [
    profileId,
  ]);
  const rows = profile.permissions.map((key) => [
    randomUUID(),
    profileId,
    permissionIds.get(key),
  ]);
  if (rows.length === 0) return;
  await tx.insert(
    'INSERT INTO profile_permission (id, profile_id, permission_id) VALUES ?',
    [rows],
  );
}

async function seedProfiles(
  conn: IDatabaseConnection,
  permissionIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const profile of DEFAULT_PROFILES) {
    const id = await conn.runInTransaction(async (tx) => {
      await tx.insert(UPSERT_PROFILE_SQL, [
        randomUUID(),
        profile.name,
        profile.description,
        profile.description,
      ]);
      const profileId = await requireId(
        tx,
        'SELECT id FROM profile WHERE name = ?',
        profile.name,
      );
      await rewriteProfilePermissions(tx, profileId, profile, permissionIds);
      return profileId;
    });
    ids.set(profile.name, id);
  }
  return ids;
}

async function seedTenant(conn: IDatabaseConnection): Promise<string> {
  await conn.insert(UPSERT_TENANT_SQL, [
    randomUUID(),
    DEFAULT_TENANT.name,
    DEFAULT_TENANT.slug,
  ]);
  return requireId(
    conn,
    'SELECT id FROM tenant WHERE slug = ?',
    DEFAULT_TENANT.slug,
  );
}

/** SUPERADMIN só é criado se o e-mail não existir (nem excluído). */
async function seedSuperAdmin(
  conn: IDatabaseConnection,
  env: SeedEnv,
  hash: HashFn,
  links: { profileId: string; tenantId: string },
): Promise<boolean> {
  const existing = await conn.queryOne<{ id: string }>(
    'SELECT id FROM `user` WHERE email = ?',
    [env.adminEmail],
  );
  if (existing) return false;
  if (!env.adminPassword) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD é obrigatória para o seed.');
  }
  const passwordHash = await hash(env.adminPassword);
  const userId = randomUUID();
  await conn.runInTransaction(async (tx) => {
    await tx.insert(INSERT_USER_SQL, [
      userId,
      env.adminName,
      env.adminEmail,
      passwordHash,
    ]);
    await tx.insert(
      'INSERT INTO user_profile (id, user_id, profile_id) VALUES (?, ?, ?)',
      [randomUUID(), userId, links.profileId],
    );
    await tx.insert(
      'INSERT INTO user_tenant (id, user_id, tenant_id) VALUES (?, ?, ?)',
      [randomUUID(), userId, links.tenantId],
    );
  });
  return true;
}

/**
 * Seed da plataforma: catálogo de permissões, perfis default (`system`),
 * tenant default e SUPERADMIN bootstrap. Idempotente (upsert por chave
 * natural). Guard: em produção devolve `skipped` sem emitir SQL.
 */
export async function runSeed(
  conn: IDatabaseConnection,
  env: SeedEnv,
  hash: HashFn,
): Promise<SeedReport> {
  const report: SeedReport = {
    skipped: null,
    permissions: 0,
    profiles: 0,
    tenantSlug: DEFAULT_TENANT.slug,
    superAdminCreated: false,
  };
  if (env.nodeEnv === 'production') return { ...report, skipped: 'production' };

  const permissionIds = await seedPermissions(conn);
  const profileIds = await seedProfiles(conn, permissionIds);
  const tenantId = await seedTenant(conn);
  const superAdminCreated = await seedSuperAdmin(conn, env, hash, {
    profileId: profileIds.get(ADMIN_PROFILE) ?? '',
    tenantId,
  });
  return {
    ...report,
    permissions: ALL_PERMISSION_KEYS.length,
    profiles: DEFAULT_PROFILES.length,
    superAdminCreated,
  };
}
