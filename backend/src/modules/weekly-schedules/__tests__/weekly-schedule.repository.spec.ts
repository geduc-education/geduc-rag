import type {
  IDatabaseConnection,
  ITransactionalConnection,
  SqlParams,
} from '../../../@core/application/adapters/database-connection.interface';
import { WeeklyScheduleRepository } from '../infra/database/repositories/weekly-schedule.repository';

interface SqlCall {
  method: string;
  sql: string;
  params: SqlParams;
  inTx: boolean;
}

type Row = Record<string, unknown>;

/**
 * Conexão falsa que registra todo SQL emitido (e se veio da transação),
 * copiada de `school.repository.spec.ts`; `respond` escolhe as linhas pelo SQL.
 */
function makeConnection(opts: { respond?: (sql: string) => Row[] } = {}) {
  const calls: SqlCall[] = [];
  const respond = opts.respond ?? (() => []);
  const build = (inTx: boolean): ITransactionalConnection => {
    const log = (method: string, sql: string, params: SqlParams) =>
      calls.push({ method, sql, params, inTx });
    const mutation = { affectedRows: 1, insertId: 0 };
    const write =
      (method: string) =>
      (sql: string, params: SqlParams = []) => {
        log(method, sql, params);
        return Promise.resolve(mutation);
      };
    return {
      query: jest.fn((sql: string, params: SqlParams = []) => {
        log('query', sql, params);
        return Promise.resolve(respond(sql));
      }),
      queryOne: jest.fn((sql: string, params: SqlParams = []) => {
        log('queryOne', sql, params);
        return Promise.resolve(respond(sql)[0] ?? null);
      }),
      insert: jest.fn(write('insert')),
      update: jest.fn(write('update')),
      delete: jest.fn(write('delete')),
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

const SCHEDULE_ROW = {
  id: 'ws1',
  tenant_id: 't1',
  school_class_id: 'sc1',
  start_date: '2026-10-19',
  end_date: '2026-10-25',
  status: 'OUTDATED',
  lesson_count: 1,
  content_recorded_count: '1',
  attendance_recorded_count: '0',
  created_at: new Date('2026-10-01T00:00:00.000Z'),
  updated_at: new Date('2026-10-02T00:00:00.000Z'),
};

const DAY_ROWS = [
  {
    id: 'wd1',
    schedule_id: 'ws1',
    day_date: '2026-10-19',
    calendar_id: 'cal1',
    day_type: 'SCHOOL_DAY',
  },
  {
    id: 'wd2',
    schedule_id: 'ws1',
    day_date: '2026-10-20',
    calendar_id: null,
    day_type: null,
  },
];

const LESSON_ROW = {
  id: 'l1',
  schedule_day_id: 'wd1',
  lesson_slot_id: 'ls1',
  slot_name: '1ª aula',
  subject_id: 'sub1',
  subject_name: 'Matemática',
  start_time: '07:30',
  end_time: '08:20',
  content_recorded: 1,
  attendance_recorded: 0,
  updated_at: new Date('2026-10-02T00:00:00.000Z'),
};

/** Linhas pela tabela principal do SELECT (primeira coluna). */
function respondSchedule(sql: string): Row[] {
  if (/^\s*SELECT l\.id/.test(sql)) return [LESSON_ROW];
  if (/^\s*SELECT wd\.id/.test(sql)) return DAY_ROWS;
  if (/^\s*SELECT ws\.id/.test(sql)) return [SCHEDULE_ROW];
  return [];
}

const LESSON = {
  lessonSlotId: 'ls1',
  subjectId: 'sub1',
  startTime: '07:30',
  endTime: '08:20',
  contentRecorded: false,
  attendanceRecorded: false,
};

describe('WeeklyScheduleRepository', () => {
  describe('listas vazias', () => {
    it('findCalendarCandidates e findByWeeks devolvem [] sem SQL', async () => {
      const { db, calls } = makeConnection();
      const repo = new WeeklyScheduleRepository(db);

      await expect(
        repo.findCalendarCandidates('t1', 's1', []),
      ).resolves.toEqual([]);
      await expect(repo.findByWeeks('t1', 'sc1', [])).resolves.toEqual([]);
      await expect(repo.findExistingSubjectIds('t1', [])).resolves.toEqual([]);
      await expect(repo.findLessonSlots('t1', 's1', [])).resolves.toEqual([]);
      expect(calls).toHaveLength(0);
    });
  });

  describe('findCalendarCandidates', () => {
    it('filtra calendário geral ou da escola numa query e mapeia is_specific', async () => {
      const { db, calls } = makeConnection({
        respond: () => [
          {
            date: '2026-10-03',
            calendar_id: 'cal1',
            day_type: 'SCHOOL_DAY',
            is_specific: 1,
          },
        ],
      });

      await expect(
        new WeeklyScheduleRepository(db).findCalendarCandidates('t1', 's1', [
          '2026-10-03',
        ]),
      ).resolves.toEqual([
        {
          date: '2026-10-03',
          calendarId: 'cal1',
          type: 'SCHOOL_DAY',
          specific: true,
        },
      ]);
      expect(calls).toHaveLength(1);
      const { sql, params } = calls[0];
      expect(sql).toContain('c.all_schools = 1');
      expect(sql).toContain('academic_calendar_school');
      expect(sql).toContain('d.day_date IN (?)');
      expect(sql).toContain('c.deleted_at IS NULL');
      expect(params).toEqual(expect.arrayContaining(['t1', 's1']));
      expect(params).toContainEqual(['2026-10-03']);
    });
  });

  describe('findLessonSlots', () => {
    it('busca só horários não excluídos da escola no tenant', async () => {
      const { db, calls } = makeConnection({
        respond: () => [{ id: 'ls1', start_time: '07:00', end_time: '07:50' }],
      });

      await expect(
        new WeeklyScheduleRepository(db).findLessonSlots('t1', 's1', ['ls1']),
      ).resolves.toEqual([{ id: 'ls1', startTime: '07:00', endTime: '07:50' }]);
      const { sql, params } = calls[0];
      expect(sql).toContain('FROM school_lesson_slot ls');
      expect(sql).toContain('ls.tenant_id = ? AND ls.school_id = ?');
      expect(sql).toContain('ls.id IN (?)');
      expect(sql).toContain('ls.deleted_at IS NULL');
      expect(sql).toContain("TIME_FORMAT(ls.start_time, '%H:%i')");
      expect(params).toEqual(['t1', 's1', ['ls1']]);
    });
  });

  describe('findByWeeks', () => {
    it('busca horários não excluídos das semanas com dias e aulas em 3 queries', async () => {
      const { db, calls } = makeConnection({ respond: respondSchedule });

      const result = await new WeeklyScheduleRepository(db).findByWeeks(
        't1',
        'sc1',
        ['2026-10-19'],
      );

      expect(result).toHaveLength(1);
      expect(result[0].days).toHaveLength(2);
      expect(calls).toHaveLength(3);
      expect(calls[0].sql).toContain('ws.start_date IN (?)');
      expect(calls[0].sql).toContain('ws.deleted_at IS NULL');
      expect(calls[0].params).toEqual(['t1', 'sc1', ['2026-10-19']]);
    });
  });

  describe('findById', () => {
    it('emite SQL de situação OUTDATED e TIME_FORMAT, mapeia dias e aulas', async () => {
      const { db, calls } = makeConnection({ respond: respondSchedule });

      const record = await new WeeklyScheduleRepository(db).findById(
        't1',
        'ws1',
      );

      expect(calls).toHaveLength(3);
      const all = calls.map((call) => call.sql).join('\n');
      expect(all).toContain("DATE_FORMAT(ws.start_date, '%Y-%m-%d')");
      // Horas do horário da escola prevalecem sobre a cópia gravada na aula.
      expect(all).toContain(
        "TIME_FORMAT(COALESCE(ls.start_time, l.start_time), '%H:%i')",
      );
      expect(all).toContain(
        "TIME_FORMAT(COALESCE(ls.end_time, l.end_time), '%H:%i')",
      );
      expect(all).toContain('LEFT JOIN school_lesson_slot ls');
      expect(calls[0].sql).toMatch(
        /wd\.calendar_id IS NOT NULL[\s\S]*cd\.day_type <> wd\.day_type[\s\S]*'OUTDATED'/,
      );
      expect(record).toMatchObject({
        id: 'ws1',
        tenantId: 't1',
        schoolClassId: 'sc1',
        startDate: '2026-10-19',
        endDate: '2026-10-25',
        status: 'OUTDATED',
        lessonCount: 1,
        contentRecordedCount: 1,
        attendanceRecordedCount: 0,
      });
      expect(record?.days).toEqual([
        {
          date: '2026-10-19',
          calendarId: 'cal1',
          dayType: 'SCHOOL_DAY',
          lessons: [
            {
              id: 'l1',
              lessonSlotId: 'ls1',
              slotName: '1ª aula',
              subjectId: 'sub1',
              subjectName: 'Matemática',
              startTime: '07:30',
              endTime: '08:20',
              contentRecorded: true,
              attendanceRecorded: false,
              updatedAt: LESSON_ROW.updated_at,
            },
          ],
        },
        { date: '2026-10-20', calendarId: null, dayType: null, lessons: [] },
      ]);
    });

    it('TIME_FORMAT: linha { start_time: "07:30" } vira startTime "07:30"', async () => {
      const { db } = makeConnection({ respond: respondSchedule });

      const record = await new WeeklyScheduleRepository(db).findById(
        't1',
        'ws1',
      );

      expect(record?.days[0].lessons[0].startTime).toBe('07:30');
    });

    it('devolve null sem horário e não busca dias', async () => {
      const { db, calls } = makeConnection();

      await expect(
        new WeeklyScheduleRepository(db).findById('t1', 'x'),
      ).resolves.toBeNull();
      expect(calls).toHaveLength(1);
    });
  });

  describe('list', () => {
    it('filtra tenant, turma, intervalo e ordena por semana desc', async () => {
      const { db, calls } = makeConnection({
        respond: (sql) =>
          sql.includes('COUNT(*) AS total') ? [{ total: '1' }] : [SCHEDULE_ROW],
      });

      const result = await new WeeklyScheduleRepository(db).list({
        tenantId: 't1',
        schoolClassId: 'sc1',
        from: '2026-10-01',
        to: '2026-10-31',
        page: 1,
        limit: 10,
      });

      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({ id: 'ws1', status: 'OUTDATED' });
      const page = calls.find((call) => call.method === 'query');
      expect(page?.sql).toContain('ws.deleted_at IS NULL');
      expect(page?.sql).toContain('ORDER BY ws.start_date DESC, ws.id ASC');
      expect(page?.sql).toContain("THEN 'OUTDATED'");
      expect(page?.params).toEqual([
        't1',
        'sc1',
        '2026-10-01',
        '2026-10-31',
        10,
        0,
      ]);
    });
  });

  describe('saveWeeks', () => {
    it('grava creates e replaces numa transação com número fixo de comandos', async () => {
      const { db, calls } = makeConnection({
        respond: (sql) => {
          if (!/^\s*SELECT ws\.id/.test(sql)) return [];
          const created = calls.find((call) =>
            call.sql.includes('INSERT INTO weekly_schedule '),
          );
          const values = created?.params[0] as unknown[][];
          return [
            { ...SCHEDULE_ROW, id: values[0][0] },
            { ...SCHEDULE_ROW, id: 'ws1' },
          ];
        },
      });
      const day = {
        date: '2026-10-19',
        calendarId: 'cal1',
        dayType: 'SCHOOL_DAY' as const,
        lessons: [LESSON],
      };

      const result = await new WeeklyScheduleRepository(db).saveWeeks({
        tenantId: 't1',
        actorId: 'u1',
        creates: [
          {
            schoolClassId: 'sc1',
            startDate: '2026-10-26',
            endDate: '2026-11-01',
            days: [{ ...day, date: '2026-10-26' }],
          },
        ],
        replaces: [{ id: 'ws1', days: [day] }],
      });

      expect(db.runInTransaction).toHaveBeenCalledTimes(1);
      const writes = calls.filter((call) => call.method !== 'query');
      expect(writes.every((call) => call.inTx)).toBe(true);
      const count = (fragment: string) =>
        writes.filter((call) => call.sql.includes(fragment));
      const [insertSchedule] = count('INSERT INTO weekly_schedule ');
      expect(count('INSERT INTO weekly_schedule ')).toHaveLength(1);
      expect(insertSchedule.sql).toContain('VALUES ?');
      expect(count('UPDATE weekly_schedule')).toHaveLength(1);
      expect(count('UPDATE weekly_schedule')[0].sql).toContain('id IN (?)');
      expect(count('DELETE FROM weekly_schedule_day')).toHaveLength(1);
      expect(count('DELETE FROM weekly_schedule_day')[0].sql).toContain(
        'schedule_id IN (?)',
      );
      expect(count('INSERT INTO weekly_schedule_day')).toHaveLength(1);
      expect(count('INSERT INTO weekly_schedule_day')[0].sql).toContain(
        'VALUES ?',
      );
      expect(count('INSERT INTO weekly_schedule_lesson')).toHaveLength(1);
      expect(count('INSERT INTO weekly_schedule_lesson')[0].sql).toContain(
        'VALUES ?',
      );
      expect(writes).toHaveLength(5);
      const dayValues = count('INSERT INTO weekly_schedule_day')[0]
        .params[0] as unknown[][];
      expect(dayValues).toHaveLength(2);
      const insertLessons = count('INSERT INTO weekly_schedule_lesson')[0];
      expect(insertLessons.sql).toContain('lesson_slot_id');
      const lessonValues = insertLessons.params[0] as unknown[][];
      expect(lessonValues[0]).toEqual(
        expect.arrayContaining(['ls1', 'sub1', '07:30', '08:20']),
      );
      expect(result.created).toHaveLength(1);
      expect(result.replaced.map((record) => record.id)).toEqual(['ws1']);
    });
  });

  describe('updateLessonRecord', () => {
    it('devolve null quando a aula não pertence a horário do tenant', async () => {
      const { db, calls } = makeConnection();

      await expect(
        new WeeklyScheduleRepository(db).updateLessonRecord('t1', 'ws1', 'l1', {
          contentRecorded: true,
          updatedById: 'u1',
        }),
      ).resolves.toBeNull();
      const update = calls.find((call) => call.method === 'update');
      expect(update?.sql).toContain('ws.deleted_at IS NULL');
      expect(update?.sql).not.toContain('attendance_recorded =');
    });
  });
});
