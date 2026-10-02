import type {
  IDatabaseConnection,
  ITransactionalConnection,
  SqlParams,
} from '../../../@core/application/adapters/database-connection.interface';
import { buildCalendarDays } from '../academic-calendar.rules';
import { AcademicCalendarRepository } from '../infra/database/repositories/academic-calendar.repository';

interface SqlCall {
  method: string;
  sql: string;
  params: SqlParams;
  inTx: boolean;
}

type RowsFor = (sql: string) => Record<string, unknown>[];

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-01-02T00:00:00.000Z');

function calendarRow(id: string, allSchools = 0): Record<string, unknown> {
  return {
    id,
    tenant_id: 't1',
    school_year: 2026,
    name: `Calendário ${id}`,
    start_date: '2026-02-01',
    end_date: '2026-12-18',
    all_schools: allSchools,
    created_at: CREATED_AT,
    updated_at: UPDATED_AT,
  };
}

const DAY_ROW = {
  date: '2026-02-01',
  day_type: 'NON_SCHOOL_DAY',
  description: null,
  updated_at: UPDATED_AT,
};

const isLinksQuery = (sql: string) =>
  sql.includes('FROM academic_calendar_school');

/**
 * Conexão falsa no molde de `makeConnection` (employee.repository.spec):
 * registra todo SQL emitido e se veio da transação. `rowsFor` escolhe as
 * linhas de `query` pelo SQL.
 */
function makeConnection(opts: {
  rowsFor?: RowsFor;
  one?: Record<string, unknown> | null;
}) {
  const calls: SqlCall[] = [];
  const build = (inTx: boolean): ITransactionalConnection => {
    const record =
      (method: string, result: (sql: string) => unknown) =>
      (sql: string, params: SqlParams = []) => {
        calls.push({ method, sql, params, inTx });
        return Promise.resolve(result(sql));
      };
    const mutation = () => ({ affectedRows: 1, insertId: 0 });
    return {
      query: jest.fn(record('query', (sql) => opts.rowsFor?.(sql) ?? [])),
      queryOne: jest.fn(record('queryOne', () => opts.one ?? null)),
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

describe('AcademicCalendarRepository', () => {
  describe('create', () => {
    it('insere calendário, vínculos e dias em lote numa transação', async () => {
      const { db, calls } = makeConnection({
        one: calendarRow('c1'),
        rowsFor: (sql) =>
          isLinksQuery(sql) ? [{ calendar_id: 'c1', school_id: 's1' }] : [],
      });

      const created = await new AcademicCalendarRepository(db).create({
        tenantId: 't1',
        year: 2026,
        name: 'Calendário c1',
        startDate: '2026-02-01',
        endDate: '2026-02-07',
        allSchools: false,
        schoolIds: ['s1'],
        days: buildCalendarDays('2026-02-01', '2026-02-07'),
        createdById: 'u1',
      });

      const inserts = calls.filter((c) => c.method === 'insert');
      expect(inserts.every((c) => c.inTx)).toBe(true);
      expect(inserts[0].sql).toContain('INSERT INTO academic_calendar ');

      const links = inserts.filter((c) =>
        c.sql.includes('INSERT INTO academic_calendar_school'),
      );
      expect(links).toHaveLength(1);
      expect(links[0].sql).toContain('VALUES ?');
      const calendarId = inserts[0].params[0];
      expect(links[0].params).toEqual([[[calendarId, 's1']]]);

      const days = inserts.filter((c) =>
        c.sql.includes('INSERT INTO academic_calendar_day'),
      );
      expect(days).toHaveLength(1);
      expect(days[0].sql).toContain('VALUES ?');
      const rows = days[0].params[0] as unknown[][];
      expect(rows).toHaveLength(7);
      expect(rows[0]).toEqual(
        expect.arrayContaining([
          't1',
          calendarId,
          '2026-02-01',
          'NON_SCHOOL_DAY',
        ]),
      );
      expect(rows[1]).toEqual(
        expect.arrayContaining(['2026-02-02', 'SCHOOL_DAY']),
      );

      expect(created).toEqual({
        id: 'c1',
        tenantId: 't1',
        year: 2026,
        name: 'Calendário c1',
        startDate: '2026-02-01',
        endDate: '2026-12-18',
        allSchools: false,
        schoolIds: ['s1'],
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      });
    });

    it('não insere vínculos quando o calendário vale para todas as escolas', async () => {
      const { db, calls } = makeConnection({ one: calendarRow('c1', 1) });

      const created = await new AcademicCalendarRepository(db).create({
        tenantId: 't1',
        year: 2026,
        name: 'Calendário c1',
        startDate: '2026-02-01',
        endDate: '2026-02-02',
        allSchools: true,
        schoolIds: [],
        days: buildCalendarDays('2026-02-01', '2026-02-02'),
        createdById: 'u1',
      });

      expect(
        calls.some((c) =>
          c.sql.includes('INSERT INTO academic_calendar_school'),
        ),
      ).toBe(false);
      expect(created.allSchools).toBe(true);
      expect(created.schoolIds).toEqual([]);
    });
  });

  describe('list', () => {
    it('carrega os vínculos da página numa só query com IN (?)', async () => {
      const { db, calls } = makeConnection({
        one: { total: '2' },
        rowsFor: (sql) =>
          isLinksQuery(sql)
            ? [
                { calendar_id: 'c1', school_id: 's1' },
                { calendar_id: 'c1', school_id: 's2' },
                { calendar_id: 'c2', school_id: 's3' },
              ]
            : [calendarRow('c1'), calendarRow('c2')],
      });

      const result = await new AcademicCalendarRepository(db).list({
        tenantId: 't1',
        page: 1,
        limit: 10,
      });

      const page = calls.find(
        (c) => c.method === 'query' && !isLinksQuery(c.sql),
      );
      expect(page?.sql).toContain('c.tenant_id = ?');
      expect(page?.sql).toContain('c.deleted_at IS NULL');
      expect(page?.sql).toContain("DATE_FORMAT(c.start_date, '%Y-%m-%d')");
      expect(page?.sql).toContain(
        'ORDER BY c.school_year DESC, c.name ASC, c.id ASC',
      );

      const links = calls.filter((c) => isLinksQuery(c.sql));
      expect(links).toHaveLength(1);
      expect(links[0].sql).toContain('IN (?)');
      expect(links[0].sql).toContain('s.deleted_at IS NULL');
      expect(links[0].sql).toContain('c.tenant_id = ?');
      expect(links[0].params).toEqual(
        expect.arrayContaining(['t1', ['c1', 'c2']]),
      );

      expect(result.total).toBe(2);
      expect(result.data.map((c) => c.schoolIds)).toEqual([
        ['s1', 's2'],
        ['s3'],
      ]);
      expect(result.data[0].startDate).toBe('2026-02-01');
    });

    it('filtra por ano e por escola não excluída (ou todas as escolas)', async () => {
      const { db, calls } = makeConnection({ one: { total: 0 } });

      const result = await new AcademicCalendarRepository(db).list({
        tenantId: 't1',
        year: 2026,
        schoolId: 's1',
        page: 2,
        limit: 5,
      });

      const page = calls.find((c) => c.method === 'query');
      expect(page?.sql).toContain('c.school_year = ?');
      expect(page?.sql).toContain('c.all_schools = 1 OR EXISTS');
      expect(page?.sql).toContain('s.deleted_at IS NULL');
      expect(page?.params).toEqual(
        expect.arrayContaining(['t1', 2026, 's1', 5, 5]),
      );
      expect(calls.some((c) => isLinksQuery(c.sql))).toBe(false);
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('findById', () => {
    it('filtra tenant e excluídos e devolve null quando não acha', async () => {
      const { db, calls } = makeConnection({ one: null });

      await expect(
        new AcademicCalendarRepository(db).findById('t1', 'c1'),
      ).resolves.toBeNull();
      expect(calls[0].sql).toContain('c.tenant_id = ? AND c.id = ?');
      expect(calls[0].sql).toContain('c.deleted_at IS NULL');
      expect(calls[0].params).toEqual(['t1', 'c1']);
      expect(calls).toHaveLength(1);
    });
  });

  describe('findExistingSchoolIds', () => {
    it('lista vazia devolve [] sem SQL', async () => {
      const { db, calls } = makeConnection({});

      await expect(
        new AcademicCalendarRepository(db).findExistingSchoolIds('t1', []),
      ).resolves.toEqual([]);
      expect(calls).toHaveLength(0);
    });

    it('filtra tenant e escolas excluídas com IN (?)', async () => {
      const { db, calls } = makeConnection({ rowsFor: () => [{ id: 's1' }] });

      await expect(
        new AcademicCalendarRepository(db).findExistingSchoolIds('t1', [
          's1',
          's2',
        ]),
      ).resolves.toEqual(['s1']);
      expect(calls[0].sql).toContain('s.tenant_id = ?');
      expect(calls[0].sql).toContain('s.id IN (?)');
      expect(calls[0].sql).toContain('s.deleted_at IS NULL');
      expect(calls[0].params).toEqual(['t1', ['s1', 's2']]);
    });
  });

  describe('update', () => {
    it('grava só os campos definidos e substitui os vínculos', async () => {
      const { db, calls } = makeConnection({ one: calendarRow('c1') });

      await new AcademicCalendarRepository(db).update('t1', 'c1', {
        name: 'Novo',
        schoolIds: ['s2', 's3'],
        updatedById: 'u1',
      });

      const update = calls.find((c) => c.method === 'update');
      expect(update?.inTx).toBe(true);
      expect(update?.sql).toContain('name = ?');
      expect(update?.sql).not.toContain('all_schools = ?');
      expect(update?.sql).toContain('tenant_id = ? AND id = ?');
      expect(update?.params).toEqual(['Novo', 'u1', 't1', 'c1']);

      const del = calls.find((c) => c.method === 'delete');
      expect(del?.inTx).toBe(true);
      expect(del?.sql).toContain('c.tenant_id = ?');
      expect(del?.params).toEqual(['t1', 'c1']);

      const link = calls.find((c) =>
        c.sql.includes('INSERT INTO academic_calendar_school'),
      );
      expect(link?.params).toEqual([
        [
          ['c1', 's2'],
          ['c1', 's3'],
        ],
      ]);
    });

    it('sem schoolIds não toca os vínculos', async () => {
      const { db, calls } = makeConnection({ one: calendarRow('c1', 1) });

      await new AcademicCalendarRepository(db).update('t1', 'c1', {
        allSchools: true,
        updatedById: 'u1',
      });

      expect(calls.some((c) => c.method === 'delete')).toBe(false);
      expect(calls.some((c) => c.method === 'insert')).toBe(false);
    });
  });

  describe('softDelete', () => {
    it('marca exclusão filtrando tenant', async () => {
      const { db, calls } = makeConnection({});

      await new AcademicCalendarRepository(db).softDelete('t1', 'c1', 'u1');

      expect(calls[0].sql).toContain('deleted_at = NOW(3)');
      expect(calls[0].sql).toContain('tenant_id = ? AND id = ?');
      expect(calls[0].params).toEqual(['u1', 't1', 'c1']);
    });
  });

  describe('dias', () => {
    it('listDays lê a data formatada, filtra tenant e período e mapeia o tipo', async () => {
      const { db, calls } = makeConnection({ rowsFor: () => [DAY_ROW] });

      await expect(
        new AcademicCalendarRepository(db).listDays('t1', 'c1', {
          startDate: '2026-02-01',
          endDate: '2026-02-07',
        }),
      ).resolves.toEqual([
        {
          date: '2026-02-01',
          type: 'NON_SCHOOL_DAY',
          description: null,
          updatedAt: UPDATED_AT,
        },
      ]);
      expect(calls[0].sql).toContain("DATE_FORMAT(d.day_date, '%Y-%m-%d')");
      expect(calls[0].sql).toContain('d.tenant_id = ?');
      expect(calls[0].sql).toContain('BETWEEN ? AND ?');
      expect(calls[0].sql).toContain('ORDER BY d.day_date ASC');
      expect(calls[0].params).toEqual(['t1', 'c1', '2026-02-01', '2026-02-07']);
    });

    it('findDay devolve null quando o dia não existe', async () => {
      const { db, calls } = makeConnection({ one: null });

      await expect(
        new AcademicCalendarRepository(db).findDay('t1', 'c1', '2026-02-01'),
      ).resolves.toBeNull();
      expect(calls[0].sql).toContain('d.day_date = ?');
      expect(calls[0].params).toEqual(['t1', 'c1', '2026-02-01']);
    });

    it('updateDay grava os campos definidos e relê na transação', async () => {
      const { db, calls } = makeConnection({ one: DAY_ROW });

      const day = await new AcademicCalendarRepository(db).updateDay(
        't1',
        'c1',
        '2026-02-01',
        { description: null, updatedById: 'u1' },
      );

      const update = calls.find((c) => c.method === 'update');
      expect(update?.inTx).toBe(true);
      expect(update?.sql).toContain('description = ?');
      expect(update?.sql).not.toContain('day_type = ?');
      expect(update?.sql).toContain(
        'tenant_id = ? AND calendar_id = ? AND day_date = ?',
      );
      expect(update?.params).toEqual([null, 'u1', 't1', 'c1', '2026-02-01']);
      expect(day.date).toBe('2026-02-01');
    });

    it('countDaysByType agrupa por tipo e converte total para número', async () => {
      const { db, calls } = makeConnection({
        rowsFor: () => [
          { day_type: 'SCHOOL_DAY', total: '5' },
          { day_type: 'NON_SCHOOL_DAY', total: 2 },
        ],
      });

      await expect(
        new AcademicCalendarRepository(db).countDaysByType('t1', 'c1'),
      ).resolves.toEqual([
        { type: 'SCHOOL_DAY', total: 5 },
        { type: 'NON_SCHOOL_DAY', total: 2 },
      ]);
      expect(calls[0].sql).toContain('GROUP BY d.day_type');
      expect(calls[0].sql).toContain('d.tenant_id = ?');
      expect(calls[0].params).toEqual(['t1', 'c1']);
    });
  });
});
