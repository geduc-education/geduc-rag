import type {
  IDatabaseConnection,
  ITransactionalConnection,
  SqlParams,
} from '../../../@core/application/adapters/database-connection.interface';
import { SchoolRepository } from '../infra/database/repositories/school.repository';

interface SqlCall {
  method: string;
  sql: string;
  params: SqlParams;
  inTx: boolean;
}

const ROW = {
  id: 's1',
  tenant_id: 't1',
  name: 'Escola A',
  active: 1,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};

const SCHOOL = {
  id: 's1',
  tenantId: 't1',
  name: 'Escola A',
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

describe('SchoolRepository', () => {
  describe('list', () => {
    it('filtra tenant e excluídas, ordena, pagina e conta', async () => {
      const { db, calls } = makeConnection({
        rows: [ROW],
        one: { total: '1' },
      });

      await expect(
        new SchoolRepository(db).list({
          tenantId: 't1',
          search: 'esc',
          page: 2,
          limit: 10,
        }),
      ).resolves.toEqual({ data: [SCHOOL], total: 1 });

      const [page, count] = calls;
      expect(page.sql).toContain('s.tenant_id = ?');
      expect(page.sql).toContain('s.deleted_at IS NULL');
      expect(page.sql).toContain('s.name LIKE ?');
      expect(page.sql).toContain('ORDER BY s.name ASC, s.id ASC');
      expect(page.sql).not.toMatch(/SELECT\s+\*/);
      expect(page.params).toEqual(
        expect.arrayContaining(['t1', '%esc%', 10, 10]),
      );
      expect(count.sql).toContain('COUNT(*)');
      expect(count.params).toEqual(expect.arrayContaining(['t1', '%esc%']));
    });
  });

  describe('findById', () => {
    it('filtra por tenant e ignora excluída', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await expect(
        new SchoolRepository(db).findById('t1', 's1'),
      ).resolves.toEqual(SCHOOL);
      expect(calls[0].sql).toContain('s.tenant_id = ? AND s.id = ?');
      expect(calls[0].sql).toContain('s.deleted_at IS NULL');
      expect(calls[0].params).toEqual(['t1', 's1']);
    });

    it('devolve null quando não encontra', async () => {
      const { db } = makeConnection({ one: null });

      await expect(
        new SchoolRepository(db).findById('t1', 's1'),
      ).resolves.toBeNull();
    });
  });

  describe('findIdByName', () => {
    it('não filtra excluídas', async () => {
      const { db, calls } = makeConnection({ one: { id: 's1' } });

      await expect(
        new SchoolRepository(db).findIdByName('t1', 'Escola A'),
      ).resolves.toBe('s1');
      expect(calls[0].sql).toContain(
        'SELECT id FROM school WHERE tenant_id = ? AND name = ?',
      );
      expect(calls[0].sql).not.toContain('deleted_at');
      expect(calls[0].params).toEqual(['t1', 'Escola A']);
    });
  });

  describe('create', () => {
    it('insere e relê na mesma transação', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await expect(
        new SchoolRepository(db).create({
          tenantId: 't1',
          name: 'Escola A',
          active: true,
          createdById: 'u1',
        }),
      ).resolves.toEqual(SCHOOL);

      const insert = calls.find((c) => c.method === 'insert');
      expect(insert?.inTx).toBe(true);
      expect(insert?.sql).toContain('INSERT INTO school');
      expect(insert?.sql).toContain('NOW(3)');
      const [id, ...rest] = insert?.params ?? [];
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(rest).toEqual(['t1', 'Escola A', true, 'u1']);
      expect(calls.find((c) => c.method === 'queryOne')?.inTx).toBe(true);
    });
  });

  describe('update', () => {
    it('só grava os campos definidos', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await new SchoolRepository(db).update('t1', 's1', {
        name: 'Escola B',
        updatedById: 'u1',
      });

      const update = calls.find((c) => c.method === 'update');
      expect(update?.inTx).toBe(true);
      expect(update?.sql).toContain('name = ?');
      expect(update?.sql).not.toContain('active = ?');
      expect(update?.sql).toContain('updated_at = NOW(3)');
      expect(update?.sql).toContain(
        'WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL',
      );
      expect(update?.params).toEqual(['Escola B', 'u1', 't1', 's1']);
    });

    it('escola sumida depois do UPDATE lança erro', async () => {
      const { db } = makeConnection({ one: null });

      await expect(
        new SchoolRepository(db).update('t1', 's1', { updatedById: 'u1' }),
      ).rejects.toThrow();
    });
  });

  describe('softDelete', () => {
    it('inativa e marca deleted_at com auditoria no tenant', async () => {
      const { db, calls } = makeConnection({});

      await new SchoolRepository(db).softDelete('t1', 's1', 'u1');
      expect(calls[0].method).toBe('update');
      expect(calls[0].sql).toContain('UPDATE school');
      expect(calls[0].sql).toContain('active = 0');
      expect(calls[0].sql).toContain('deleted_at = NOW(3)');
      expect(calls[0].sql).toContain(
        'WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL',
      );
      expect(calls[0].params).toEqual(['u1', 't1', 's1']);
    });
  });
});
