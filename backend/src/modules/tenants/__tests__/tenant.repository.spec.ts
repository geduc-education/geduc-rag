import type {
  IDatabaseConnection,
  ITransactionalConnection,
  SqlParams,
} from '../../../@core/application/adapters/database-connection.interface';
import { TenantRepository } from '../infra/database/repositories/tenant.repository';

interface SqlCall {
  method: string;
  sql: string;
  params: SqlParams;
  inTx: boolean;
}

const ROW = {
  id: 't1',
  name: 'Secretaria',
  slug: 'secretaria',
  active: 1,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};

/** Conexão falsa que registra todo SQL emitido (e se veio da transação). */
function makeConnection(opts: {
  rows?: Record<string, unknown>[];
  one?: Record<string, unknown> | null;
}) {
  const calls: SqlCall[] = [];
  const build = (inTx: boolean): ITransactionalConnection => {
    const record =
      (method: string, result: unknown) =>
      (sql: string, params: SqlParams = []) => {
        calls.push({ method, sql, params, inTx });
        return Promise.resolve(result);
      };
    const mutation = { affectedRows: 1, insertId: 0 };
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

const TENANT = {
  id: 't1',
  name: 'Secretaria',
  slug: 'secretaria',
  active: true,
  createdAt: ROW.created_at,
  updatedAt: ROW.updated_at,
};

describe('TenantRepository', () => {
  describe('list', () => {
    it('scope [] devolve [] sem SQL', async () => {
      const { db, calls } = makeConnection({});

      await expect(new TenantRepository(db).list([])).resolves.toEqual([]);
      expect(calls).toHaveLength(0);
    });

    it("scope 'all' lista não excluídos por nome sem filtro de id", async () => {
      const { db, calls } = makeConnection({ rows: [ROW] });

      await expect(new TenantRepository(db).list('all')).resolves.toEqual([
        TENANT,
      ]);
      expect(calls).toHaveLength(1);
      expect(calls[0].sql).toContain('deleted_at IS NULL');
      expect(calls[0].sql).toContain('ORDER BY name ASC');
      expect(calls[0].sql).not.toContain('IN (?)');
      expect(calls[0].params).toEqual([]);
    });

    it('scope com ids filtra por IN (?)', async () => {
      const { db, calls } = makeConnection({ rows: [] });

      await new TenantRepository(db).list(['t1', 't2']);
      expect(calls[0].sql).toContain('id IN (?)');
      expect(calls[0].sql).toContain('deleted_at IS NULL');
      expect(calls[0].params).toEqual([['t1', 't2']]);
    });
  });

  describe('findById', () => {
    it('devolve null sem linha e filtra excluídos', async () => {
      const { db, calls } = makeConnection({ one: null });

      await expect(new TenantRepository(db).findById('t1')).resolves.toBeNull();
      expect(calls[0].sql).toContain('deleted_at IS NULL');
      expect(calls[0].params).toEqual(['t1']);
    });

    it('converte a linha em TenantRecord', async () => {
      const { db } = makeConnection({ one: ROW });

      await expect(new TenantRepository(db).findById('t1')).resolves.toEqual(
        TENANT,
      );
    });
  });

  describe('create', () => {
    const input = {
      name: 'Nova',
      slug: 'nova',
      active: true,
      createdById: 'u1',
    };

    it('insere tenant e vínculo na mesma transação', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await new TenantRepository(db).create({ ...input, linkUserId: 'u1' });

      const inserts = calls.filter((c) => c.method === 'insert');
      expect(inserts).toHaveLength(2);
      expect(inserts.every((c) => c.inTx)).toBe(true);
      expect(inserts[0].sql).toContain('INSERT INTO tenant');
      expect(inserts[0].sql).toContain('NOW(3)');
      const [tenantId, ...rest] = inserts[0].params;
      expect(tenantId).toMatch(/^[0-9a-f-]{36}$/);
      expect(rest).toEqual(['Nova', 'nova', true, 'u1']);
      expect(inserts[1].sql).toContain('INSERT INTO user_tenant');
      expect(inserts[1].params).toEqual([expect.any(String), 'u1', tenantId]);
    });

    it('sem linkUserId não cria vínculo', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await expect(
        new TenantRepository(db).create({ ...input, linkUserId: null }),
      ).resolves.toEqual(TENANT);
      const inserts = calls.filter((c) => c.method === 'insert');
      expect(inserts).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('só grava os campos definidos, mais auditoria', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await expect(
        new TenantRepository(db).update('t1', {
          name: 'Y',
          updatedById: 'u1',
        }),
      ).resolves.toEqual(TENANT);

      const update = calls.find((c) => c.method === 'update');
      expect(update?.inTx).toBe(true);
      expect(update?.sql).toContain('name = ?');
      expect(update?.sql).not.toContain('slug');
      expect(update?.sql).not.toContain('active');
      expect(update?.sql).toContain('updated_by_id = ?');
      expect(update?.sql).toContain('updated_at = NOW(3)');
      expect(update?.sql).toContain('WHERE id = ?');
      expect(update?.params).toEqual(['Y', 'u1', 't1']);
    });

    it('grava slug e active quando definidos', async () => {
      const { db, calls } = makeConnection({ one: ROW });

      await new TenantRepository(db).update('t1', {
        slug: 's',
        active: false,
        updatedById: 'u1',
      });
      const update = calls.find((c) => c.method === 'update');
      expect(update?.sql).toContain('slug = ?');
      expect(update?.sql).toContain('active = ?');
      expect(update?.sql).not.toContain('name = ?');
      expect(update?.params).toEqual(['s', false, 'u1', 't1']);
    });

    it('tenant sumido depois do UPDATE lança erro', async () => {
      const { db } = makeConnection({ one: null });

      await expect(
        new TenantRepository(db).update('t1', { updatedById: 'u1' }),
      ).rejects.toThrow();
    });
  });

  describe('countExisting', () => {
    it('lista vazia devolve 0 sem SQL', async () => {
      const { db, calls } = makeConnection({});

      await expect(new TenantRepository(db).countExisting([])).resolves.toBe(0);
      expect(calls).toHaveLength(0);
    });

    it('conta não excluídos por IN (?)', async () => {
      const { db, calls } = makeConnection({ one: { total: 2 } });

      await expect(
        new TenantRepository(db).countExisting(['t1', 't2']),
      ).resolves.toBe(2);
      expect(calls[0].sql).toContain('id IN (?)');
      expect(calls[0].sql).toContain('deleted_at IS NULL');
      expect(calls[0].params).toEqual([['t1', 't2']]);
    });
  });
});
