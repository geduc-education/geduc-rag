import {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../../@core/application/adapters/database-connection.interface';
import { UserRepository } from '../infra/database/repositories/user.repository';

type ConnectionMock = {
  [K in keyof IDatabaseConnection]: jest.Mock;
};

type Call = [string, unknown[]];

const PROFILES_RE = /FROM user_profile up\s+JOIN profile p/;
const KEYS_RE = /pe\.`key`/;
const TENANTS_RE = /FROM user_tenant ut\s+JOIN tenant t/;

function userRow(id: string, name: string) {
  return {
    id,
    name,
    email: `${id}@geduc.test`,
    active: 1,
    must_change_password: 0,
    is_super_admin: 0,
    last_login_at: null,
    created_at: new Date('2026-09-01T10:00:00Z'),
    updated_at: new Date('2026-09-01T10:05:00Z'),
  };
}

/** Linhas devolvidas pelas 3 queries em lote, pela forma do SQL. */
function batchRows(sql: string): unknown[] {
  if (KEYS_RE.test(sql)) {
    return [
      { user_id: 'u1', key: 'users.read' },
      { user_id: 'u1', key: 'users.write' },
      { user_id: 'u2', key: 'users.read' },
    ];
  }
  if (PROFILES_RE.test(sql)) {
    return [
      { user_id: 'u1', id: 'p1', name: 'Admin' },
      { user_id: 'u2', id: 'p2', name: 'Leitor' },
      { user_id: 'u1', id: 'p3', name: 'Suporte' },
    ];
  }
  if (TENANTS_RE.test(sql)) {
    return [{ user_id: 'u2', id: 't1', name: 'Escola', slug: 'escola' }];
  }
  return [userRow('u1', 'Ana'), userRow('u2', 'Bruno')];
}

function makeTx(): { [K in keyof ITransactionalConnection]: jest.Mock } {
  return {
    query: jest.fn().mockResolvedValue([]),
    queryOne: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue({ affectedRows: 1, insertId: 0 }),
    update: jest.fn().mockResolvedValue({ affectedRows: 1, insertId: 0 }),
    delete: jest.fn().mockResolvedValue({ affectedRows: 1, insertId: 0 }),
  };
}

function makeConnection(tx: ReturnType<typeof makeTx>): ConnectionMock {
  return {
    query: jest.fn((sql: string) => Promise.resolve(batchRows(sql))),
    queryOne: jest.fn().mockResolvedValue({ total: 2 }),
    insert: jest.fn(),
    update: jest.fn().mockResolvedValue({ affectedRows: 1, insertId: 0 }),
    delete: jest.fn(),
    runInTransaction: jest.fn(
      (work: (conn: ITransactionalConnection) => Promise<unknown>) => work(tx),
    ),
  };
}

function callsOf(...mocks: jest.Mock[]): Call[] {
  return mocks.flatMap((mock) => mock.mock.calls as Call[]);
}

/** SQL sem `:nome` sobrando, sem `${`, sem `SELECT *` e com um `?` por param. */
function expectWellFormed([sql, params = []]: Call): void {
  expect(sql).not.toMatch(/[^:]:[A-Za-z_]/);
  expect(sql).not.toContain('${');
  expect(sql).not.toMatch(/SELECT \*/i);
  expect((sql.match(/\?/g) ?? []).length).toBe(params.length);
}

describe('UserRepository', () => {
  let tx: ReturnType<typeof makeTx>;
  let connection: ConnectionMock;
  let repository: UserRepository;

  beforeEach(() => {
    tx = makeTx();
    connection = makeConnection(tx);
    repository = new UserRepository(connection);
  });

  afterEach(() => {
    const all = callsOf(
      connection.query,
      connection.queryOne,
      connection.update,
      tx.query,
      tx.queryOne,
      tx.insert,
      tx.update,
      tx.delete,
    );
    all.forEach(expectWellFormed);
  });

  describe('list', () => {
    it('emite página, contagem e 3 queries em lote por IN (?)', async () => {
      const result = await repository.list({
        scope: ['t1'],
        page: 1,
        limit: 20,
      });

      const calls = callsOf(connection.query, connection.queryOne);
      expect(calls).toHaveLength(5);

      const [pageSql, pageParams] = (connection.query.mock.calls as Call[])[0];
      expect(pageSql).toContain('EXISTS');
      expect(pageSql).toContain('ut.tenant_id IN (?)');
      expect(pageSql).toContain('u.deleted_at IS NULL');
      expect(pageSql).toContain('ORDER BY u.name ASC, u.id ASC');
      expect(pageSql.trim()).toMatch(/LIMIT \? OFFSET \?$/);
      expect(pageParams).toEqual([['t1'], 20, 0]);

      const batches = (connection.query.mock.calls as Call[]).slice(1);
      expect(batches).toHaveLength(3);
      for (const [sql, params] of batches) {
        expect(sql).toContain('IN (?)');
        expect(params).toEqual([['u1', 'u2']]);
      }

      expect(result.total).toBe(2);
      expect(result.data.map((u) => u.id)).toEqual(['u1', 'u2']);
      const [ana, bruno] = result.data;
      expect(ana.active).toBe(true);
      expect(ana.mustChangePassword).toBe(false);
      expect(ana.profiles).toEqual([
        { id: 'p1', name: 'Admin' },
        { id: 'p3', name: 'Suporte' },
      ]);
      expect(ana.tenants).toEqual([]);
      expect(ana.permissionKeys).toEqual(['users.read', 'users.write']);
      expect(bruno.profiles).toEqual([{ id: 'p2', name: 'Leitor' }]);
      expect(bruno.tenants).toEqual([
        { id: 't1', name: 'Escola', slug: 'escola' },
      ]);
    });

    it('scope vazio devolve lista vazia sem consultar', async () => {
      await expect(
        repository.list({ scope: [], page: 1, limit: 20 }),
      ).resolves.toEqual({ data: [], total: 0 });
      expect(connection.query).not.toHaveBeenCalled();
      expect(connection.queryOne).not.toHaveBeenCalled();
    });

    it("scope 'all' não filtra por vínculo; tenantId e search viram filtros", async () => {
      await repository.list({
        scope: 'all',
        tenantId: 't9',
        search: '50%',
        active: false,
        page: 2,
        limit: 10,
      });
      const [sql, params] = (connection.query.mock.calls as Call[])[0];
      expect(sql).not.toContain('ut.tenant_id IN');
      expect(sql).toContain('u.active = ?');
      expect(sql).toMatch(/EXISTS \(.*tenant_id = \?/s);
      expect(sql).toContain('u.name LIKE ?');
      expect(sql).toContain('u.email LIKE ?');
      expect(params).toContain('%50\\%%');
      expect(params).toContain('t9');
      expect(params.slice(-2)).toEqual([10, 10]);
    });

    it('página vazia não dispara as queries em lote', async () => {
      connection.query.mockResolvedValueOnce([]);
      connection.queryOne.mockResolvedValueOnce({ total: 0 });
      await expect(
        repository.list({ scope: 'all', page: 1, limit: 20 }),
      ).resolves.toEqual({ data: [], total: 0 });
      expect(connection.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('leituras de um usuário', () => {
    beforeEach(() => {
      connection.queryOne.mockResolvedValue(userRow('u1', 'Ana'));
    });

    it('findInScope filtra exclusão e vínculo, e monta o agregado', async () => {
      const user = await repository.findInScope('u1', ['t1']);
      const [sql, params] = (connection.queryOne.mock.calls as Call[])[0];
      expect(sql).toContain('u.deleted_at IS NULL');
      expect(sql).toContain('ut.tenant_id IN (?)');
      expect(params).toEqual(['u1', ['t1']]);
      expect(user?.profiles).toHaveLength(2);
      expect(connection.query).toHaveBeenCalledTimes(3);
    });

    it('findInScope com scope vazio devolve null sem consultar', async () => {
      await expect(repository.findInScope('u1', [])).resolves.toBeNull();
      expect(connection.queryOne).not.toHaveBeenCalled();
    });

    it('findInScope devolve null quando não encontra', async () => {
      connection.queryOne.mockResolvedValueOnce(null);
      await expect(repository.findInScope('u1', 'all')).resolves.toBeNull();
      expect(connection.query).not.toHaveBeenCalled();
    });

    it('findActiveById exige ativo e não excluído', async () => {
      await repository.findActiveById('u1');
      const [sql] = (connection.queryOne.mock.calls as Call[])[0];
      expect(sql).toContain('u.active = ?');
      expect(sql).toContain('u.deleted_at IS NULL');
    });

    it('findById não filtra exclusão', async () => {
      await repository.findById('u1');
      const [sql, params] = (connection.queryOne.mock.calls as Call[])[0];
      expect(sql).not.toContain('deleted_at');
      expect(params).toEqual(['u1']);
    });
  });

  describe('credenciais e e-mail', () => {
    it('findCredentialsByEmail filtra exclusão e converte active', async () => {
      connection.queryOne.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@b.c',
        password_hash: 'hash',
        active: 0,
      });
      await expect(repository.findCredentialsByEmail('a@b.c')).resolves.toEqual(
        { id: 'u1', email: 'a@b.c', passwordHash: 'hash', active: false },
      );
      const [sql, params] = (connection.queryOne.mock.calls as Call[])[0];
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['a@b.c']);
    });

    it('findActiveCredentialsById exige ativo e não excluído', async () => {
      connection.queryOne.mockResolvedValueOnce(null);
      await expect(repository.findActiveCredentialsById('u1')).resolves.toBe(
        null,
      );
      const [sql] = (connection.queryOne.mock.calls as Call[])[0];
      expect(sql).toContain('active = ?');
      expect(sql).toContain('deleted_at IS NULL');
    });

    it('findIdByEmail não filtra exclusão', async () => {
      connection.queryOne.mockResolvedValueOnce({ id: 'u1' });
      await expect(repository.findIdByEmail('a@b.c')).resolves.toBe('u1');
      const [sql] = (connection.queryOne.mock.calls as Call[])[0];
      expect(sql).not.toContain('deleted_at');
    });
  });

  describe('escritas', () => {
    it('create grava user e vínculos na transação com updated_at = NOW(3)', async () => {
      const id = await repository.create({
        name: 'Ana',
        email: 'a@b.c',
        passwordHash: 'hash',
        active: true,
        createdById: 'a',
        profileIds: ['p1'],
        tenantIds: ['t1', 't2'],
      });
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(connection.runInTransaction).toHaveBeenCalledTimes(1);
      const inserts = tx.insert.mock.calls as Call[];
      expect(inserts).toHaveLength(3);
      expect(inserts[0][0]).toContain('NOW(3)');
      expect(inserts[0][1]).toContain(id);
      const [profileSql, [profileRows]] = inserts[1];
      expect(profileSql).toContain('INSERT INTO user_profile');
      expect(profileSql).toContain('ON DUPLICATE KEY UPDATE id = id');
      expect(profileRows).toEqual([[expect.any(String), id, 'p1', 'a']]);
      const [tenantSql, [tenantRows]] = inserts[2];
      expect(tenantSql).toContain('INSERT INTO user_tenant');
      expect(tenantRows).toHaveLength(2);
    });

    it('create sem vínculos grava só o user', async () => {
      await repository.create({
        name: 'Ana',
        email: 'a@b.c',
        passwordHash: 'hash',
        active: true,
        createdById: 'a',
        profileIds: [],
        tenantIds: [],
      });
      expect(tx.insert).toHaveBeenCalledTimes(1);
    });

    it('update com profileIds [] apaga todos os perfis sem NOT IN', async () => {
      await repository.update('u1', { updatedById: 'a', profileIds: [] });
      const [sql, params] = (tx.delete.mock.calls as Call[])[0];
      expect(sql).toBe('DELETE FROM user_profile WHERE user_id = ?');
      expect(sql).not.toContain('NOT IN');
      expect(params).toEqual(['u1']);
      expect(tx.insert).not.toHaveBeenCalled();
      const [updateSql] = (tx.update.mock.calls as Call[])[0];
      expect(updateSql).toContain('updated_at = NOW(3)');
    });

    it('update só grava campos definidos e troca perfis por NOT IN + upsert', async () => {
      await repository.update('u1', {
        name: 'Ana',
        updatedById: 'a',
        profileIds: ['p1', 'p2'],
      });
      const [updateSql, updateParams] = (tx.update.mock.calls as Call[])[0];
      expect(updateSql).toContain('name = ?');
      expect(updateSql).not.toContain('email');
      expect(updateSql).not.toMatch(/\bactive\b/);
      expect(updateParams).toEqual(['Ana', 'a', 'u1']);
      const [deleteSql, deleteParams] = (tx.delete.mock.calls as Call[])[0];
      expect(deleteSql).toContain('profile_id NOT IN (?)');
      expect(deleteParams).toEqual(['u1', ['p1', 'p2']]);
      const [insertSql, [rows]] = (tx.insert.mock.calls as Call[])[0];
      expect(insertSql).toContain('ON DUPLICATE KEY UPDATE id = id');
      expect(rows).toEqual([
        [expect.any(String), 'u1', 'p1', 'a'],
        [expect.any(String), 'u1', 'p2', 'a'],
      ]);
    });

    it('update sem profileIds não toca user_profile', async () => {
      await repository.update('u1', { active: false, updatedById: 'a' });
      const [, params] = (tx.update.mock.calls as Call[])[0];
      expect(params).toEqual([false, 'a', 'u1']);
      expect(tx.delete).not.toHaveBeenCalled();
    });

    it("replaceTenants('u1', [], 'a') apaga todos sem NOT IN e grava updated_by_id", async () => {
      await repository.replaceTenants('u1', [], 'a');
      const [sql, params] = (tx.delete.mock.calls as Call[])[0];
      expect(sql).toBe('DELETE FROM user_tenant WHERE user_id = ?');
      expect(sql).not.toContain('NOT IN');
      expect(params).toEqual(['u1']);
      expect(tx.insert).not.toHaveBeenCalled();
      const [updateSql, updateParams] = (tx.update.mock.calls as Call[])[0];
      expect(updateSql).toContain('updated_by_id = ?');
      expect(updateSql).toContain('updated_at = NOW(3)');
      expect(updateParams).toEqual(['a', 'u1']);
    });

    it('replaceTenants com lista usa NOT IN e upsert', async () => {
      await repository.replaceTenants('u1', ['t1'], 'a');
      const [sql] = (tx.delete.mock.calls as Call[])[0];
      expect(sql).toContain('tenant_id NOT IN (?)');
      const [insertSql, [rows]] = (tx.insert.mock.calls as Call[])[0];
      expect(insertSql).toContain('ON DUPLICATE KEY UPDATE id = id');
      expect(rows).toEqual([[expect.any(String), 'u1', 't1']]);
    });

    it('updatePassword grava hash e flag; updated_by_id só se informado', async () => {
      await repository.updatePassword('u1', {
        passwordHash: 'h',
        mustChangePassword: false,
      });
      const [sql, params] = (connection.update.mock.calls as Call[])[0];
      expect(sql).not.toContain('updated_by_id');
      expect(sql).toContain('updated_at = NOW(3)');
      expect(params).toEqual(['h', false, 'u1']);
    });

    it('touchLastLogin e softDelete gravam NOW(3)', async () => {
      await repository.touchLastLogin('u1');
      await repository.softDelete('u1', 'a');
      const [touchSql] = (connection.update.mock.calls as Call[])[0];
      expect(touchSql).toContain('last_login_at = NOW(3)');
      const [deleteSql, params] = (connection.update.mock.calls as Call[])[1];
      expect(deleteSql).toContain('deleted_at = NOW(3)');
      expect(deleteSql).toContain('active = 0');
      expect(params).toEqual(['a', 'u1']);
    });
  });
});
