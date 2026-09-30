import {
  IDatabaseConnection,
  ITransactionalConnection,
  SqlParams,
} from '../../../@core/application/adapters/database-connection.interface';
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_PROFILES,
} from '../../../common/rbac/permissions';
import { runSeed, SeedEnv } from '../run-seed';

interface SqlCall {
  method: string;
  sql: string;
  params: SqlParams;
}

/**
 * Conexão falsa: registra todo SQL emitido e responde os SELECTs de id
 * (permissões, perfil, tenant) e a busca do SUPERADMIN por e-mail.
 */
function makeConnection(options: { adminExists: boolean }) {
  const calls: SqlCall[] = [];
  const mutation = (method: string) =>
    jest.fn((sql: string, params: SqlParams = []) => {
      calls.push({ method, sql, params });
      return Promise.resolve({ affectedRows: 1, insertId: 0 });
    });

  const query = jest.fn((sql: string, params: SqlParams = []) => {
    calls.push({ method: 'query', sql, params });
    if (/FROM permission/i.test(sql)) {
      return Promise.resolve(
        ALL_PERMISSION_KEYS.map((key) => ({ id: `perm-${key}`, key })),
      );
    }
    return Promise.resolve([]);
  });

  const queryOne = jest.fn((sql: string, params: SqlParams = []) => {
    calls.push({ method: 'queryOne', sql, params });
    if (/FROM `?user`? WHERE email/i.test(sql)) {
      return Promise.resolve(options.adminExists ? { id: 'admin-1' } : null);
    }
    if (/FROM profile/i.test(sql)) {
      return Promise.resolve({ id: `profile-${String(params[0])}` });
    }
    if (/FROM tenant/i.test(sql)) return Promise.resolve({ id: 'tenant-1' });
    return Promise.resolve(null);
  });

  const runner: ITransactionalConnection = {
    query: query as ITransactionalConnection['query'],
    queryOne: queryOne as ITransactionalConnection['queryOne'],
    insert: mutation('insert'),
    update: mutation('update'),
    delete: mutation('delete'),
  };
  const conn: IDatabaseConnection = {
    ...runner,
    runInTransaction: jest.fn((work) => work(runner)),
  };
  return { conn, calls };
}

const env: SeedEnv = {
  nodeEnv: 'development',
  adminEmail: 'admin@rag.local',
  adminPassword: 'segredo-inicial',
  adminName: 'Super Admin',
};

describe('runSeed', () => {
  it('não emite SQL e devolve skipped em produção', async () => {
    const { conn, calls } = makeConnection({ adminExists: false });
    const hash = jest.fn();

    const report = await runSeed(conn, { ...env, nodeEnv: 'production' }, hash);

    expect(report.skipped).toBe('production');
    expect(calls).toHaveLength(0);
    expect(conn.runInTransaction).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it('é idempotente: upsert por permissão, perfis regravados e SUPERADMIN existente mantido', async () => {
    const { conn, calls } = makeConnection({ adminExists: true });
    const hash = jest.fn();

    const report = await runSeed(conn, env, hash);

    const permissionUpserts = calls.filter(
      (c) =>
        /INSERT INTO permission/i.test(c.sql) &&
        /ON DUPLICATE KEY UPDATE description = \?, updated_at = NOW\(3\)/i.test(
          c.sql,
        ),
    );
    expect(permissionUpserts.map((c) => c.params[1])).toEqual(
      ALL_PERMISSION_KEYS,
    );

    for (const profile of DEFAULT_PROFILES) {
      const profileId = `profile-${profile.name}`;
      const deletes = calls.filter(
        (c) =>
          c.method === 'delete' &&
          /DELETE FROM profile_permission WHERE profile_id = \?/i.test(c.sql) &&
          c.params[0] === profileId,
      );
      expect(deletes).toHaveLength(1);
      const insert = calls.find(
        (c) =>
          /INSERT INTO profile_permission/i.test(c.sql) &&
          (c.params[0] as unknown[][])[0]?.[1] === profileId,
      );
      const rows = insert?.params[0] as unknown[][];
      expect(rows.map((row) => row[2])).toEqual(
        profile.permissions.map((key) => `perm-${key}`),
      );
    }

    expect(report).toEqual({
      skipped: null,
      permissions: ALL_PERMISSION_KEYS.length,
      profiles: DEFAULT_PROFILES.length,
      tenantSlug: 'geduc',
      superAdminCreated: false,
    });
    expect(hash).not.toHaveBeenCalled();
    expect(calls.some((c) => /INSERT INTO `?user`?\b/i.test(c.sql))).toBe(
      false,
    );
  });

  it('lança erro se o SUPERADMIN precisa ser criado sem senha', async () => {
    const { conn } = makeConnection({ adminExists: false });
    const hash = jest.fn();

    await expect(
      runSeed(conn, { ...env, adminPassword: undefined }, hash),
    ).rejects.toThrow('BOOTSTRAP_ADMIN_PASSWORD é obrigatória para o seed.');
    expect(hash).not.toHaveBeenCalled();
  });

  it('cria o SUPERADMIN com hash, flags e vínculos ao Administrador e ao tenant geduc', async () => {
    const { conn, calls } = makeConnection({ adminExists: false });
    const hash = jest.fn((password: string) =>
      Promise.resolve(`hash:${password}`),
    );

    const report = await runSeed(conn, env, hash);

    expect(report.superAdminCreated).toBe(true);
    expect(hash).toHaveBeenCalledWith('segredo-inicial');
    const userInsert = calls.find((c) => /INSERT INTO `user`/i.test(c.sql));
    expect(userInsert?.sql).toMatch(/is_super_admin/);
    expect(userInsert?.sql).toMatch(/must_change_password/);
    expect(userInsert?.sql).toMatch(/NOW\(3\)/);
    expect(userInsert?.params).toEqual(
      expect.arrayContaining([
        'Super Admin',
        'admin@rag.local',
        'hash:segredo-inicial',
      ]),
    );
    const profileLink = calls.find((c) =>
      /INSERT INTO user_profile/i.test(c.sql),
    );
    expect(profileLink?.params).toContain('profile-Administrador');
    const tenantLink = calls.find((c) =>
      /INSERT INTO user_tenant/i.test(c.sql),
    );
    expect(tenantLink?.params).toContain('tenant-1');
  });
});
