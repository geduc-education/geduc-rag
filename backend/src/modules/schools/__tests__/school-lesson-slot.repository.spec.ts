import type {
  IDatabaseConnection,
  ITransactionalConnection,
  SqlParams,
} from '../../../@core/application/adapters/database-connection.interface';
import { SchoolLessonSlotRepository } from '../infra/database/repositories/school-lesson-slot.repository';

interface SqlCall {
  method: string;
  sql: string;
  params: SqlParams;
  inTx: boolean;
}

const ROW = {
  id: 'ls1',
  tenant_id: 't1',
  school_id: 's1',
  name: '1ª aula',
  start_time: '07:00',
  end_time: '07:50',
  position: 1,
};

const SLOT = {
  id: 'ls1',
  tenantId: 't1',
  schoolId: 's1',
  name: '1ª aula',
  startTime: '07:00',
  endTime: '07:50',
  position: 1,
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

describe('SchoolLessonSlotRepository', () => {
  it('listBySchool filtra tenant, escola e excluídos e ordena por posição e início', async () => {
    const { db, calls } = makeConnection({ rows: [ROW] });

    await expect(
      new SchoolLessonSlotRepository(db).listBySchool('t1', 's1'),
    ).resolves.toEqual([SLOT]);
    const { sql, params } = calls[0];
    expect(sql).toContain('ls.tenant_id = ? AND ls.school_id = ?');
    expect(sql).toContain('ls.deleted_at IS NULL');
    expect(sql).toContain("TIME_FORMAT(ls.start_time, '%H:%i')");
    expect(sql).toContain(
      'ORDER BY ls.position ASC, ls.start_time ASC, ls.id ASC',
    );
    expect(sql).not.toMatch(/SELECT\s+\*/);
    expect(params).toEqual(['t1', 's1']);
  });

  it('findById filtra tenant, escola e excluído', async () => {
    const { db, calls } = makeConnection({ one: ROW });

    await expect(
      new SchoolLessonSlotRepository(db).findById('t1', 's1', 'ls1'),
    ).resolves.toEqual(SLOT);
    expect(calls[0].sql).toContain('ls.id = ?');
    expect(calls[0].sql).toContain('ls.deleted_at IS NULL');
    expect(calls[0].params).toEqual(['t1', 's1', 'ls1']);
  });

  it('findIdByName só considera horários não excluídos da escola', async () => {
    const { db, calls } = makeConnection({ one: { id: 'ls1' } });

    await expect(
      new SchoolLessonSlotRepository(db).findIdByName('t1', 's1', '1ª aula'),
    ).resolves.toBe('ls1');
    expect(calls[0].sql).toContain(
      'WHERE tenant_id = ? AND school_id = ? AND name = ? AND deleted_at IS NULL',
    );
    expect(calls[0].params).toEqual(['t1', 's1', '1ª aula']);
  });

  it('create insere e relê na mesma transação', async () => {
    const { db, calls } = makeConnection({ one: ROW });

    await expect(
      new SchoolLessonSlotRepository(db).create({
        tenantId: 't1',
        schoolId: 's1',
        name: '1ª aula',
        startTime: '07:00',
        endTime: '07:50',
        position: 1,
        createdById: 'u1',
      }),
    ).resolves.toEqual(SLOT);
    const insert = calls.find((c) => c.method === 'insert');
    expect(insert?.inTx).toBe(true);
    expect(insert?.sql).toContain('INSERT INTO school_lesson_slot');
    expect(insert?.sql).toContain('NOW(3)');
    const [id, ...rest] = insert?.params ?? [];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(rest).toEqual(['t1', 's1', '1ª aula', '07:00', '07:50', 1, 'u1']);
    expect(calls.find((c) => c.method === 'queryOne')?.inTx).toBe(true);
  });

  it('update só grava os campos definidos, no escopo do tenant e da escola', async () => {
    const { db, calls } = makeConnection({ one: ROW });

    await new SchoolLessonSlotRepository(db).update('t1', 's1', 'ls1', {
      endTime: '07:45',
      updatedById: 'u1',
    });
    const update = calls.find((c) => c.method === 'update');
    expect(update?.inTx).toBe(true);
    expect(update?.sql).toContain('end_time = ?');
    expect(update?.sql).not.toContain('name = ?');
    expect(update?.sql).toContain('updated_at = NOW(3)');
    expect(update?.sql).toContain(
      'WHERE tenant_id = ? AND school_id = ? AND id = ? AND deleted_at IS NULL',
    );
    expect(update?.params).toEqual(['07:45', 'u1', 't1', 's1', 'ls1']);
  });

  it('softDelete marca deleted_at com auditoria', async () => {
    const { db, calls } = makeConnection({});

    await new SchoolLessonSlotRepository(db).softDelete(
      't1',
      's1',
      'ls1',
      'u1',
    );
    expect(calls[0].method).toBe('update');
    expect(calls[0].sql).toContain('UPDATE school_lesson_slot');
    expect(calls[0].sql).toContain('deleted_at = NOW(3)');
    expect(calls[0].sql).toContain(
      'WHERE tenant_id = ? AND school_id = ? AND id = ? AND deleted_at IS NULL',
    );
    expect(calls[0].params).toEqual(['u1', 't1', 's1', 'ls1']);
  });

  it('isInUse só conta aulas de horário semanal não excluído', async () => {
    const { db, calls } = makeConnection({ one: { found: 1 } });

    await expect(
      new SchoolLessonSlotRepository(db).isInUse('t1', 'ls1'),
    ).resolves.toBe(true);
    expect(calls[0].sql).toContain('l.lesson_slot_id = ?');
    expect(calls[0].sql).toContain('ws.deleted_at IS NULL');
    expect(calls[0].sql).toContain('l.tenant_id = ?');
    expect(calls[0].params).toEqual(['t1', 'ls1']);
  });

  it('isInUse sem aula devolve false', async () => {
    const { db } = makeConnection({ one: null });

    await expect(
      new SchoolLessonSlotRepository(db).isInUse('t1', 'ls1'),
    ).resolves.toBe(false);
  });
});
