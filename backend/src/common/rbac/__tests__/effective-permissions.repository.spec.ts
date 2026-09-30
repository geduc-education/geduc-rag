import { IDatabaseConnection } from '../../../@core/application/adapters/database-connection.interface';
import { EffectivePermissionsRepository } from '../infra/database/repositories/effective-permissions.repository';

/** Conexão falsa: `queryOne` devolve o usuário, `query` as chaves. */
function fakeConnection(opts: {
  user: Record<string, unknown> | null;
  keys?: string[];
}): { db: IDatabaseConnection; query: jest.Mock; queryOne: jest.Mock } {
  const queryOne = jest.fn().mockResolvedValue(opts.user);
  const query = jest
    .fn()
    .mockResolvedValue((opts.keys ?? []).map((key) => ({ key })));
  const db = { query, queryOne } as unknown as IDatabaseConnection;
  return { db, query, queryOne };
}

/** SQL de todas as chamadas, na ordem. */
function sqlOf(...mocks: jest.Mock[]): string {
  return mocks
    .flatMap((mock) => mock.mock.calls.map((call) => String(call[0])))
    .join('\n');
}

describe('EffectivePermissionsRepository', () => {
  it('monta os grants a partir das rows (0/1 vira boolean)', async () => {
    const { db } = fakeConnection({
      user: { is_super_admin: 0 },
      keys: ['user:read'],
    });
    const repo = new EffectivePermissionsRepository(db);

    await expect(repo.findActiveUserGrants('u1')).resolves.toEqual({
      isSuperAdmin: false,
      permissionKeys: ['user:read'],
    });
  });

  it('SUPERADMIN vem como true', async () => {
    const { db } = fakeConnection({ user: { is_super_admin: 1 } });
    const repo = new EffectivePermissionsRepository(db);

    await expect(repo.findActiveUserGrants('u1')).resolves.toEqual({
      isSuperAdmin: true,
      permissionKeys: [],
    });
  });

  it('usuário ausente, inativo ou excluído devolve null sem buscar chaves', async () => {
    const { db, query } = fakeConnection({ user: null });
    const repo = new EffectivePermissionsRepository(db);

    await expect(repo.findActiveUserGrants('u1')).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('filtra usuário e perfil ativos e não excluídos, com `key` em crase', async () => {
    const { db, query, queryOne } = fakeConnection({
      user: { is_super_admin: 0 },
      keys: ['user:read'],
    });
    await new EffectivePermissionsRepository(db).findActiveUserGrants('u1');

    const sql = sqlOf(queryOne, query);
    expect(sql).toContain('u.active = ?');
    expect(sql).toContain('u.deleted_at IS NULL');
    expect(sql).toContain('p.active = ?');
    expect(sql).toContain('p.deleted_at IS NULL');
    expect(sql).toContain('`key`');
    expect(sql).not.toMatch(/[^`]\bkey\b[^`]/);
    expect(queryOne.mock.calls[0][1]).toEqual(['u1', 1]);
    expect(query.mock.calls[0][1]).toEqual(['u1', 1]);
  });
});
