import type {
  IDatabaseConnection,
  ITransactionalConnection,
  SqlParams,
} from '../../../@core/application/adapters/database-connection.interface';
import { SchoolClassRepository } from '../infra/database/repositories/school-class.repository';

interface SqlCall {
  method: string;
  sql: string;
  params: SqlParams;
  inTx: boolean;
}

const ROW = {
  id: 'c1',
  tenant_id: 't1',
  school_id: 's1',
  school_name: 'Escola A',
  school_year: 2026,
  name: '8º A',
  active: 1,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};

const SCHOOL_CLASS = {
  id: 'c1',
  tenantId: 't1',
  schoolId: 's1',
  schoolName: 'Escola A',
  schoolYear: 2026,
  name: '8º A',
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

describe('SchoolClassRepository', () => {
  describe('list', () => {
    it('filtra tenant e excluídas, junta a escola, ordena, pagina e conta', async () => {
      const { db, calls } = makeConnection({
        rows: [ROW],
        one: { total: '1' },
      });

      await expect(
        new SchoolClassRepository(db).list({
          tenantId: 't1',
          schoolId: 's1',
          schoolYear: 2026,
          search: '8º',
          page: 2,
          limit: 10,
        }),
      ).resolves.toEqual({ data: [SCHOOL_CLASS], total: 1 });

      const [page, count] = calls;
      expect(page.sql).toContain('sc.tenant_id = ?');
      expect(page.sql).toContain('sc.deleted_at IS NULL');
      expect(page.sql).toContain('JOIN school sch');
      expect(page.sql).toContain('sc.school_id = ?');
      expect(page.sql).toContain('sc.school_year = ?');
      expect(page.sql).toContain('sc.name LIKE ?');
      expect(page.sql).toContain(
        'ORDER BY sc.school_year DESC, sc.name ASC, sc.id ASC',
      );
      expect(page.sql).not.toMatch(/SELECT\s+\*/);
      expect(page.params).toEqual(
        expect.arrayContaining(['t1', 's1', 2026, '%8º%', 10, 10]),
      );
      expect(count.sql).toContain('COUNT(*)');
      expect(count.params).toEqual(
        expect.arrayContaining(['t1', 's1', 2026, '%8º%']),
      );
    });
  });

  describe('findById', () => {
    it('filtra por tenant e ignora excluída', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await expect(
        new SchoolClassRepository(db).findById('t1', 'c1'),
      ).resolves.toEqual(SCHOOL_CLASS);
      expect(calls[0].sql).toContain('sc.tenant_id = ? AND sc.id = ?');
      expect(calls[0].sql).toContain('sc.deleted_at IS NULL');
      expect(calls[0].sql).toContain('JOIN school sch');
      expect(calls[0].params).toEqual(['t1', 'c1']);
    });

    it('devolve null quando não encontra', async () => {
      const { db } = makeConnection({ one: null });

      await expect(
        new SchoolClassRepository(db).findById('t1', 'c1'),
      ).resolves.toBeNull();
    });
  });

  describe('findIdByName', () => {
    it('busca por tenant, escola, ano e nome sem filtrar excluídas', async () => {
      const { db, calls } = makeConnection({ one: { id: 'c1' } });

      await expect(
        new SchoolClassRepository(db).findIdByName('t1', 's1', 2026, '8º A'),
      ).resolves.toBe('c1');
      expect(calls[0].sql).toContain('FROM school_class');
      expect(calls[0].sql).not.toContain('deleted_at');
      expect(calls[0].params).toEqual(['t1', 's1', 2026, '8º A']);
    });
  });

  describe('schoolExists', () => {
    it('consulta a escola não excluída do tenant', async () => {
      const { db, calls } = makeConnection({ one: { id: 's1' } });

      await expect(
        new SchoolClassRepository(db).schoolExists('t1', 's1'),
      ).resolves.toBe(true);
      expect(calls[0].sql).toContain('FROM school');
      expect(calls[0].sql).toContain('tenant_id = ?');
      expect(calls[0].sql).toContain('id = ?');
      expect(calls[0].sql).toContain('deleted_at IS NULL');
      expect(calls[0].params).toEqual(['t1', 's1']);
    });

    it('devolve false quando a escola não existe', async () => {
      const { db } = makeConnection({ one: null });

      await expect(
        new SchoolClassRepository(db).schoolExists('t1', 's1'),
      ).resolves.toBe(false);
    });
  });

  describe('create', () => {
    it('insere e relê na mesma transação', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await expect(
        new SchoolClassRepository(db).create({
          tenantId: 't1',
          schoolId: 's1',
          schoolYear: 2026,
          name: '8º A',
          active: true,
          createdById: 'u1',
        }),
      ).resolves.toEqual(SCHOOL_CLASS);

      const insert = calls.find((c) => c.method === 'insert');
      expect(insert?.inTx).toBe(true);
      expect(insert?.sql).toContain('INSERT INTO school_class');
      expect(insert?.sql).toContain('NOW(3)');
      const [id, ...rest] = insert?.params ?? [];
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(rest).toEqual(['t1', 's1', 2026, '8º A', true, 'u1']);
      expect(calls.find((c) => c.method === 'queryOne')?.inTx).toBe(true);
    });
  });

  describe('update', () => {
    it('só grava os campos definidos', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await new SchoolClassRepository(db).update('t1', 'c1', {
        name: '8º B',
        updatedById: 'u1',
      });

      const update = calls.find((c) => c.method === 'update');
      expect(update?.inTx).toBe(true);
      expect(update?.sql).toContain('UPDATE school_class');
      expect(update?.sql).toContain('name = ?');
      expect(update?.sql).not.toContain('active = ?');
      expect(update?.sql).toContain('updated_at = NOW(3)');
      expect(update?.sql).toContain(
        'WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL',
      );
      expect(update?.params).toEqual(['8º B', 'u1', 't1', 'c1']);
    });

    it('turma sumida depois do UPDATE lança erro', async () => {
      const { db } = makeConnection({ one: null });

      await expect(
        new SchoolClassRepository(db).update('t1', 'c1', {
          updatedById: 'u1',
        }),
      ).rejects.toThrow();
    });
  });

  describe('softDelete', () => {
    it('inativa e marca deleted_at com auditoria no tenant', async () => {
      const { db, calls } = makeConnection({});

      await new SchoolClassRepository(db).softDelete('t1', 'c1', 'u1');
      expect(calls[0].method).toBe('update');
      expect(calls[0].sql).toContain('UPDATE school_class');
      expect(calls[0].sql).toContain('active = 0');
      expect(calls[0].sql).toContain('deleted_at = NOW(3)');
      expect(calls[0].sql).toContain(
        'WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL',
      );
      expect(calls[0].params).toEqual(['u1', 't1', 'c1']);
    });
  });
});
