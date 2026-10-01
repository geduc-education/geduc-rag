import type {
  IDatabaseConnection,
  ITransactionalConnection,
  SqlParams,
} from '../../../@core/application/adapters/database-connection.interface';
import { EmployeeRepository } from '../infra/database/repositories/employee.repository';

interface SqlCall {
  method: string;
  sql: string;
  params: SqlParams;
  inTx: boolean;
}

const ROW = {
  id: 'e1',
  tenant_id: 't1',
  user_id: null,
  name: 'João',
  email: 'joao@escola.com',
  document: '12345678909',
  position: 'Professor',
  active: 1,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};

const EMPLOYEE = {
  id: 'e1',
  tenantId: 't1',
  userId: null,
  name: 'João',
  email: 'joao@escola.com',
  document: '12345678909',
  position: 'Professor',
  active: true,
  createdAt: ROW.created_at,
  updatedAt: ROW.updated_at,
};

/** Conexão falsa que registra todo SQL emitido (e se veio da transação). */
function makeConnection(opts: {
  rows?: Record<string, unknown>[];
  one?: Record<string, unknown> | null;
  affectedRows?: number;
}) {
  const calls: SqlCall[] = [];
  const build = (inTx: boolean): ITransactionalConnection => {
    const record =
      (method: string, result: unknown) =>
      (sql: string, params: SqlParams = []) => {
        calls.push({ method, sql, params, inTx });
        return Promise.resolve(result);
      };
    const mutation = { affectedRows: opts.affectedRows ?? 1, insertId: 0 };
    return {
      query: jest.fn(record('query', opts.rows ?? [])),
      queryOne: jest.fn(record('queryOne', opts.one ?? null)),
      insert: jest.fn(record('insert', mutation)),
      update: jest.fn(record('update', mutation)),
      delete: jest.fn(record('delete', mutation)),
    } as unknown as ITransactionalConnection;
  };
  const db = {
    ...build(false),
    runInTransaction: jest.fn(
      (work: (tx: ITransactionalConnection) => Promise<unknown>) =>
        work(build(true)),
    ),
  } as unknown as IDatabaseConnection;
  return { db, calls };
}

describe('EmployeeRepository', () => {
  describe('list', () => {
    it('filtra tenant e excluídos, pagina e conta', async () => {
      const { db, calls } = makeConnection({ rows: [ROW], one: { total: 1 } });

      await expect(
        new EmployeeRepository(db).list({
          tenantId: 't1',
          search: 'jo',
          page: 2,
          limit: 10,
        }),
      ).resolves.toEqual({ data: [EMPLOYEE], total: 1 });

      const [page, count] = calls;
      expect(page.sql).toContain('e.tenant_id = ?');
      expect(page.sql).toContain('e.deleted_at IS NULL');
      expect(page.sql).toContain('e.document LIKE ?');
      expect(page.sql).toContain('ORDER BY e.name ASC');
      expect(page.params).toEqual(
        expect.arrayContaining(['t1', '%jo%', 10, 10]),
      );
      expect(count.sql).toContain('COUNT(*)');
      expect(count.params).toEqual(expect.arrayContaining(['t1', '%jo%']));
    });
  });

  describe('findById', () => {
    it('filtra por tenant e excluídos', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await expect(
        new EmployeeRepository(db).findById('t1', 'e1'),
      ).resolves.toEqual(EMPLOYEE);
      expect(calls[0].sql).toContain('e.tenant_id = ? AND e.id = ?');
      expect(calls[0].sql).toContain('e.deleted_at IS NULL');
      expect(calls[0].params).toEqual(['t1', 'e1']);
    });
  });

  describe('lookups de unicidade', () => {
    it.each([
      ['findIdByEmail', 'email = ?'],
      ['findIdByDocument', 'document = ?'],
      ['findIdByUserId', 'user_id = ?'],
    ] as const)('%s não filtra excluídos', async (method, column) => {
      const { db, calls } = makeConnection({ one: { id: 'e1' } });

      await expect(new EmployeeRepository(db)[method]('t1', 'x')).resolves.toBe(
        'e1',
      );
      expect(calls[0].sql).toContain(`tenant_id = ? AND ${column}`);
      expect(calls[0].sql).not.toContain('deleted_at');
      expect(calls[0].params).toEqual(['t1', 'x']);
    });
  });

  describe('create', () => {
    it('insere e relê na mesma transação', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await new EmployeeRepository(db).create({
        tenantId: 't1',
        userId: null,
        name: 'João',
        email: 'joao@escola.com',
        document: '12345678909',
        position: null,
        active: true,
        createdById: 'u1',
      });

      const insert = calls.find((c) => c.method === 'insert');
      expect(insert?.inTx).toBe(true);
      expect(insert?.sql).toContain('INSERT INTO employee');
      expect(insert?.sql).toContain('NOW(3)');
      const [id, ...rest] = insert?.params ?? [];
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(rest).toEqual([
        't1',
        null,
        'João',
        'joao@escola.com',
        '12345678909',
        null,
        true,
        'u1',
      ]);
      expect(calls.find((c) => c.method === 'queryOne')?.inTx).toBe(true);
    });
  });

  describe('update', () => {
    it('só grava os campos definidos; null limpa', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await new EmployeeRepository(db).update('t1', 'e1', {
        name: 'Y',
        userId: null,
        updatedById: 'u1',
      });

      const update = calls.find((c) => c.method === 'update');
      expect(update?.inTx).toBe(true);
      expect(update?.sql).toContain('user_id = ?');
      expect(update?.sql).toContain('name = ?');
      expect(update?.sql).not.toContain('email = ?');
      expect(update?.sql).toContain('updated_at = NOW(3)');
      expect(update?.sql).toContain('WHERE tenant_id = ? AND id = ?');
      expect(update?.params).toEqual([null, 'Y', 'u1', 't1', 'e1']);
    });

    it('funcionário sumido depois do UPDATE lança erro', async () => {
      const { db } = makeConnection({ one: null });

      await expect(
        new EmployeeRepository(db).update('t1', 'e1', { updatedById: 'u1' }),
      ).rejects.toThrow();
    });
  });

  describe('softDelete', () => {
    it('marca deleted_at com auditoria no tenant', async () => {
      const { db, calls } = makeConnection({});

      await new EmployeeRepository(db).softDelete('t1', 'e1', 'u1');
      expect(calls[0].method).toBe('update');
      expect(calls[0].sql).toContain('deleted_at = NOW(3)');
      expect(calls[0].sql).toContain('WHERE tenant_id = ? AND id = ?');
      expect(calls[0].params).toEqual(['u1', 't1', 'e1']);
    });
  });

  describe('hardDelete', () => {
    it('remove a linha do tenant', async () => {
      const { db, calls } = makeConnection({});

      await expect(
        new EmployeeRepository(db).hardDelete('t1', 'e1'),
      ).resolves.toBe(true);
      expect(calls[0].method).toBe('delete');
      expect(calls[0].sql).toContain('DELETE FROM employee');
      expect(calls[0].sql).toContain('WHERE tenant_id = ? AND id = ?');
      expect(calls[0].params).toEqual(['t1', 'e1']);
    });

    it('nenhuma linha afetada devolve false', async () => {
      const { db } = makeConnection({ affectedRows: 0 });

      await expect(
        new EmployeeRepository(db).hardDelete('t1', 'e1'),
      ).resolves.toBe(false);
    });
  });
});
