import { IDatabaseConnection } from '../../../@core/application/adapters/database-connection.interface';
import { ProfileRepository } from '../infra/database/repositories/profile.repository';

const PROFILE_ROWS = [
  { id: 'p1', name: 'Admin', description: null, system: 1 },
  { id: 'p2', name: 'Leitor', description: 'Só leitura', system: 0 },
];

const KEY_ROWS = [
  { profile_id: 'p1', key: 'user:write' },
  { profile_id: 'p1', key: 'user:read' },
  { profile_id: 'p2', key: 'document:read' },
];

/** Conexão falsa: 1ª query devolve os perfis, 2ª as chaves. */
function fakeConnection(
  profiles: Record<string, unknown>[] = PROFILE_ROWS,
  keys: Record<string, unknown>[] = KEY_ROWS,
): { db: IDatabaseConnection; query: jest.Mock; queryOne: jest.Mock } {
  const query = jest
    .fn()
    .mockResolvedValueOnce(profiles)
    .mockResolvedValueOnce(keys);
  const queryOne = jest.fn();
  const db = { query, queryOne } as unknown as IDatabaseConnection;
  return { db, query, queryOne };
}

/** SQL e params da n-ésima chamada do mock. */
function callOf(mock: jest.Mock, index = 0): [string, unknown[]] {
  return mock.mock.calls[index] as [string, unknown[]];
}

describe('ProfileRepository', () => {
  it('listActive emite 2 queries: perfis ativos e chaves em lote por IN (?)', async () => {
    const { db, query } = fakeConnection();
    const repo = new ProfileRepository(db);

    await repo.listActive();

    expect(query).toHaveBeenCalledTimes(2);
    const [profileSql] = callOf(query, 0);
    expect(profileSql).toContain('p.active = ?');
    expect(profileSql).toContain('p.deleted_at IS NULL');
    expect(profileSql).toContain('ORDER BY p.name ASC');
    expect(profileSql).toContain('p.`system`');
    const [keySql, keyParams] = callOf(query, 1);
    expect(keySql).toContain('pp.profile_id IN (?)');
    expect(keySql).toContain('pe.`key`');
    expect(keyParams).toEqual([['p1', 'p2']]);
  });

  it('converte system 0/1 em boolean e ordena permissionKeys', async () => {
    const { db } = fakeConnection();
    const repo = new ProfileRepository(db);

    await expect(repo.listActive()).resolves.toEqual([
      {
        id: 'p1',
        name: 'Admin',
        description: null,
        system: true,
        permissionKeys: ['user:read', 'user:write'],
      },
      {
        id: 'p2',
        name: 'Leitor',
        description: 'Só leitura',
        system: false,
        permissionKeys: ['document:read'],
      },
    ]);
  });

  it('listActive sem perfis não busca chaves', async () => {
    const { db, query } = fakeConnection([], []);
    const repo = new ProfileRepository(db);

    await expect(repo.listActive()).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('findActiveByIds filtra por IN (?) com os ids', async () => {
    const { db, query } = fakeConnection([PROFILE_ROWS[0]], [KEY_ROWS[0]]);
    const repo = new ProfileRepository(db);

    await expect(repo.findActiveByIds(['p1'])).resolves.toEqual([
      {
        id: 'p1',
        name: 'Admin',
        description: null,
        system: true,
        permissionKeys: ['user:write'],
      },
    ]);
    const [sql, params] = callOf(query, 0);
    expect(sql).toContain('p.id IN (?)');
    expect(sql).toContain('p.deleted_at IS NULL');
    expect(params).toContainEqual(['p1']);
  });

  it('findActiveByIds([]) devolve [] sem chamar a conexão', async () => {
    const { db, query, queryOne } = fakeConnection();
    const repo = new ProfileRepository(db);

    await expect(repo.findActiveByIds([])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
    expect(queryOne).not.toHaveBeenCalled();
  });
});
