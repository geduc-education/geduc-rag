import { randomUUID } from 'node:crypto';
import {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../../../../@core/application/adapters/database-connection.interface';
import {
  createFilterContext,
  FilterContext,
} from '../../../../../@core/infra/database/query-builder/filters';
import { toPositional } from '../../../../../@core/infra/database/query-builder/sql-params';
import type { TenantScope } from '../../../../../common/tenancy/tenant-access.service';
import type {
  CreateUserInput,
  IUserRepository,
  UpdateUserInput,
  UserAggregate,
  UserCredentials,
  UserListFilter,
} from '../../../application/interface/repository/user.repository.interface';
import {
  addScope,
  buildUserListQuery,
  USER_COLUMNS,
  USER_FROM,
} from '../queries/user-list.query';

const ACTIVE = 1;

const PROFILES_SQL = `
  SELECT up.user_id, p.id, p.name
    FROM user_profile up
    JOIN profile p ON p.id = up.profile_id
   WHERE up.user_id IN (?) AND p.active = 1 AND p.deleted_at IS NULL
   ORDER BY p.name ASC, p.id ASC`;

// `key` é palavra reservada do MySQL 8: sempre com crase.
const KEYS_SQL = `
  SELECT DISTINCT up.user_id, pe.\`key\` AS \`key\`
    FROM user_profile up
    JOIN profile p ON p.id = up.profile_id
    JOIN profile_permission pp ON pp.profile_id = p.id
    JOIN permission pe ON pe.id = pp.permission_id
   WHERE up.user_id IN (?) AND p.active = 1 AND p.deleted_at IS NULL`;

const TENANTS_SQL = `
  SELECT ut.user_id, t.id, t.name, t.slug
    FROM user_tenant ut
    JOIN tenant t ON t.id = ut.tenant_id
   WHERE ut.user_id IN (?) AND t.deleted_at IS NULL
   ORDER BY t.name ASC, t.id ASC`;

const CREDENTIALS_COLUMNS = 'id, email, password_hash, active';

const INSERT_USER_SQL = `
  INSERT INTO \`user\`
    (id, name, email, password_hash, active, must_change_password, created_by_id, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`;

/** Tabela de vínculo N:N do usuário e a coluna do outro lado. */
interface LinkTable {
  table: 'user_profile' | 'user_tenant';
  column: 'profile_id' | 'tenant_id';
  /** Colunas extras gravadas em cada vínculo (valores em `extra`). */
  extraColumns: readonly string[];
}

const PROFILE_LINK: LinkTable = {
  table: 'user_profile',
  column: 'profile_id',
  extraColumns: ['assigned_by_id'],
};
const TENANT_LINK: LinkTable = {
  table: 'user_tenant',
  column: 'tenant_id',
  extraColumns: [],
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  active: number | boolean;
  must_change_password: number | boolean;
  is_super_admin: number | boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ProfileRow {
  user_id: string;
  id: string;
  name: string;
}

interface KeyRow {
  user_id: string;
  key: string;
}

interface TenantRow {
  user_id: string;
  id: string;
  name: string;
  slug: string;
}

interface CredentialsRow {
  id: string;
  email: string;
  password_hash: string;
  active: number | boolean;
}

/** `IUserRepository` em SQL; o agregado sai de 3 queries em lote por `IN`. */
export class UserRepository implements IUserRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async list(
    filter: UserListFilter,
  ): Promise<{ data: UserAggregate[]; total: number }> {
    if (isEmptyScope(filter.scope)) return { data: [], total: 0 };
    const { page, count } = buildUserListQuery(filter);
    const [rows, counted] = await Promise.all([
      this.db.query<UserRow>(page.sql, page.params),
      this.db.queryOne<{ total: number | string }>(count.sql, count.params),
    ]);
    return {
      data: await this.assemble(rows),
      total: Number(counted?.total ?? 0),
    };
  }

  async findInScope(
    id: string,
    scope: TenantScope,
  ): Promise<UserAggregate | null> {
    if (isEmptyScope(scope)) return null;
    const ctx = createFilterContext();
    ctx.where.push('u.id = :id', 'u.deleted_at IS NULL');
    ctx.params.id = id;
    addScope(ctx, scope);
    return this.findOne(ctx);
  }

  findActiveById(id: string): Promise<UserAggregate | null> {
    const ctx = createFilterContext();
    ctx.where.push('u.id = :id', 'u.active = :active', 'u.deleted_at IS NULL');
    Object.assign(ctx.params, { id, active: ACTIVE });
    return this.findOne(ctx);
  }

  findById(id: string): Promise<UserAggregate | null> {
    const ctx = createFilterContext();
    ctx.where.push('u.id = :id');
    ctx.params.id = id;
    return this.findOne(ctx);
  }

  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const row = await this.db.queryOne<CredentialsRow>(
      `SELECT ${CREDENTIALS_COLUMNS} FROM \`user\` WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    return row ? toCredentials(row) : null;
  }

  async findActiveCredentialsById(id: string): Promise<UserCredentials | null> {
    const row = await this.db.queryOne<CredentialsRow>(
      `SELECT ${CREDENTIALS_COLUMNS} FROM \`user\` WHERE id = ? AND active = ? AND deleted_at IS NULL LIMIT 1`,
      [id, ACTIVE],
    );
    return row ? toCredentials(row) : null;
  }

  async findIdByEmail(email: string): Promise<string | null> {
    const row = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM `user` WHERE email = ? LIMIT 1',
      [email],
    );
    return row?.id ?? null;
  }

  async create(input: CreateUserInput): Promise<string> {
    const id = randomUUID();
    await this.db.runInTransaction(async (tx) => {
      await tx.insert(INSERT_USER_SQL, [
        id,
        input.name,
        input.email,
        input.passwordHash,
        input.active,
        true,
        input.createdById,
      ]);
      await insertLinks(tx, PROFILE_LINK, id, input.profileIds, [
        input.createdById,
      ]);
      await insertLinks(tx, TENANT_LINK, id, input.tenantIds);
    });
    return id;
  }

  async update(id: string, input: UpdateUserInput): Promise<void> {
    await this.db.runInTransaction(async (tx) => {
      await updateUser(tx, id, [
        ['name', input.name],
        ['email', input.email],
        ['active', input.active],
        ['updated_by_id', input.updatedById],
      ]);
      if (input.profileIds) {
        await replaceLinks(tx, PROFILE_LINK, id, input.profileIds, [
          input.updatedById,
        ]);
      }
    });
  }

  async replaceTenants(
    id: string,
    tenantIds: readonly string[],
    updatedById: string,
  ): Promise<void> {
    await this.db.runInTransaction(async (tx) => {
      await replaceLinks(tx, TENANT_LINK, id, tenantIds);
      await updateUser(tx, id, [['updated_by_id', updatedById]]);
    });
  }

  async updatePassword(
    id: string,
    input: {
      passwordHash: string;
      mustChangePassword: boolean;
      updatedById?: string;
    },
  ): Promise<void> {
    await updateUser(this.db, id, [
      ['password_hash', input.passwordHash],
      ['must_change_password', input.mustChangePassword],
      ['updated_by_id', input.updatedById],
    ]);
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.db.update(
      'UPDATE `user` SET last_login_at = NOW(3), updated_at = NOW(3) WHERE id = ?',
      [id],
    );
  }

  async softDelete(id: string, deletedById: string): Promise<void> {
    await this.db.update(
      'UPDATE `user` SET active = 0, deleted_at = NOW(3), deleted_by_id = ?, updated_at = NOW(3) WHERE id = ?',
      [deletedById, id],
    );
  }

  private async findOne(ctx: FilterContext): Promise<UserAggregate | null> {
    const { sql, params } = toPositional(
      `SELECT ${USER_COLUMNS} FROM ${USER_FROM} WHERE ${ctx.where.join(' AND ')} LIMIT 1`,
      ctx.params,
    );
    const row = await this.db.queryOne<UserRow>(sql, params);
    if (!row) return null;
    const [user] = await this.assemble([row]);
    return user;
  }

  /** Perfis, chaves e tenants da página inteira em 3 queries (sem N+1). */
  private async assemble(rows: UserRow[]): Promise<UserAggregate[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [profiles, keys, tenants] = await Promise.all([
      this.db.query<ProfileRow>(PROFILES_SQL, [ids]),
      this.db.query<KeyRow>(KEYS_SQL, [ids]),
      this.db.query<TenantRow>(TENANTS_SQL, [ids]),
    ]);
    const profilesBy = groupBy(profiles, ({ id, name }) => ({ id, name }));
    const keysBy = groupBy(keys, ({ key }) => key);
    const tenantsBy = groupBy(tenants, ({ id, name, slug }) => ({
      id,
      name,
      slug,
    }));
    return rows.map((row) => ({
      ...toUser(row),
      profiles: profilesBy.get(row.id) ?? [],
      tenants: tenantsBy.get(row.id) ?? [],
      permissionKeys: keysBy.get(row.id) ?? [],
    }));
  }
}

function isEmptyScope(scope: TenantScope): boolean {
  return scope !== 'all' && scope.length === 0;
}

/** Agrupa por `user_id` preservando a ordem das linhas. */
function groupBy<R extends { user_id: string }, T>(
  rows: R[],
  pick: (row: R) => T,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.user_id) ?? [];
    list.push(pick(row));
    grouped.set(row.user_id, list);
  }
  return grouped;
}

function toUser(
  row: UserRow,
): Omit<UserAggregate, 'profiles' | 'tenants' | 'permissionKeys'> {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    active: Boolean(row.active),
    mustChangePassword: Boolean(row.must_change_password),
    isSuperAdmin: Boolean(row.is_super_admin),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCredentials(row: CredentialsRow): UserCredentials {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    active: Boolean(row.active),
  };
}

/**
 * UPDATE só dos campos definidos, sempre com `updated_at = NOW(3)`. Colunas
 * vêm de literais do código, nunca de input.
 */
async function updateUser(
  conn: ITransactionalConnection,
  id: string,
  fields: readonly [string, unknown][],
): Promise<void> {
  const defined = fields.filter(([, value]) => value !== undefined);
  const sets = [
    ...defined.map(([column]) => `${column} = ?`),
    'updated_at = NOW(3)',
  ];
  await conn.update(`UPDATE \`user\` SET ${sets.join(', ')} WHERE id = ?`, [
    ...defined.map(([, value]) => value),
    id,
  ]);
}

/** Troca o conjunto de vínculos: apaga os que saem e insere os novos. */
async function replaceLinks(
  tx: ITransactionalConnection,
  link: LinkTable,
  userId: string,
  ids: readonly string[],
  extra: readonly unknown[] = [],
): Promise<void> {
  if (ids.length === 0) {
    await tx.delete(`DELETE FROM ${link.table} WHERE user_id = ?`, [userId]);
    return;
  }
  await tx.delete(
    `DELETE FROM ${link.table} WHERE user_id = ? AND ${link.column} NOT IN (?)`,
    [userId, [...ids]],
  );
  await insertLinks(tx, link, userId, ids, extra);
}

/** INSERT em lote; duplicata vira no-op (`skipDuplicates`) sem engolir FK. */
async function insertLinks(
  tx: ITransactionalConnection,
  link: LinkTable,
  userId: string,
  ids: readonly string[],
  extra: readonly unknown[] = [],
): Promise<void> {
  if (ids.length === 0) return;
  const columns = ['id', 'user_id', link.column, ...link.extraColumns];
  const rows = ids.map((id) => [randomUUID(), userId, id, ...extra]);
  await tx.insert(
    `INSERT INTO ${link.table} (${columns.join(', ')}) VALUES ? ON DUPLICATE KEY UPDATE id = id`,
    [rows],
  );
}
