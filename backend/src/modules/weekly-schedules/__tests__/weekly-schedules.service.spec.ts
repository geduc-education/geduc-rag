import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  weekdayOf,
  type DayType,
} from '../../academic-calendar/academic-calendar.rules';
import type {
  IWeeklyScheduleRepository,
  NewWeekInput,
  ReplaceWeekInput,
  SaveWeeksInput,
  WeeklyScheduleRecord,
} from '../application/interface/repository/weekly-schedule.repository.interface';
import type { CalendarDayCandidate } from '../weekly-schedule.rules';
import { WeeklySchedulesService } from '../weekly-schedules.service';

const NOW = new Date('2026-09-01T00:00:00.000Z');
const SCHOOL_CLASS = { id: 'sc1', schoolId: 's1', schoolYear: 2026 };
const MATH = 'sub-math';
const HISTORY = 'sub-history';

/** Horários de aula da escola `s1` conhecidos pelo repositório falso. */
const SLOTS = [
  { id: 'ls-0800', name: '1ª aula', startTime: '08:00', endTime: '08:50' },
  { id: 'ls-0850', name: '2ª aula', startTime: '08:50', endTime: '09:40' },
];

type Overrides = Record<
  string,
  { type: DayType; specific?: boolean; calendarId?: string }[]
>;

/** Segunda a sexta letivo e fim de semana não letivo, salvo `overrides`. */
function candidatesFor(
  dates: readonly string[],
  overrides: Overrides = {},
): CalendarDayCandidate[] {
  return dates.flatMap((date) => {
    const custom = overrides[date];
    if (custom) {
      return custom.map((c, i) => ({
        date,
        calendarId: c.calendarId ?? `cal-${i}`,
        type: c.type,
        specific: c.specific ?? false,
      }));
    }
    const weekday = weekdayOf(date);
    const type: DayType =
      weekday === 0 || weekday === 6 ? 'NON_SCHOOL_DAY' : 'SCHOOL_DAY';
    return [{ date, calendarId: 'cal-0', type, specific: false }];
  });
}

function addDays(date: string, days: number): string {
  const time = new Date(date + 'T00:00:00Z').getTime() + days * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}

function weekDates(startDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
}

interface LessonSeed {
  lessonSlotId: string | null;
  subjectId: string;
  startTime: string;
  endTime: string;
  contentRecorded?: boolean;
  attendanceRecorded?: boolean;
}

function scheduleRecord(
  id: string,
  startDate: string,
  lessonsByDate: Record<string, LessonSeed[]> = {},
): WeeklyScheduleRecord {
  let seq = 0;
  return {
    id,
    tenantId: 't1',
    schoolClassId: SCHOOL_CLASS.id,
    startDate,
    endDate: addDays(startDate, 6),
    status: 'UP_TO_DATE',
    lessonCount: 0,
    contentRecordedCount: 0,
    attendanceRecordedCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    days: weekDates(startDate).map((date) => ({
      date,
      calendarId: 'cal-0',
      dayType: 'SCHOOL_DAY',
      lessons: (lessonsByDate[date] ?? []).map((l) => ({
        id: `${id}-l${++seq}`,
        subjectName: 'Disciplina',
        slotName: 'Aula',
        contentRecorded: false,
        attendanceRecorded: false,
        updatedAt: NOW,
        ...l,
      })),
    })),
  };
}

function fromInput(
  id: string,
  week: { startDate: string; days: NewWeekInput['days'] },
): WeeklyScheduleRecord {
  const record = scheduleRecord(id, week.startDate);
  return {
    ...record,
    days: week.days.map((day) => ({
      date: day.date,
      calendarId: day.calendarId,
      dayType: day.dayType,
      lessons: day.lessons.map((l, i) => ({
        ...l,
        id: `${id}-${day.date}-${i}`,
        subjectName: 'Disciplina',
        slotName: 'Aula',
        updatedAt: NOW,
      })),
    })),
  };
}

function makeRepository(): jest.Mocked<IWeeklyScheduleRepository> {
  return {
    findClass: jest.fn().mockResolvedValue(SCHOOL_CLASS),
    findExistingSubjectIds: jest
      .fn()
      .mockImplementation((_t: string, ids: readonly string[]) =>
        Promise.resolve([...ids]),
      ),
    findLessonSlots: jest
      .fn()
      .mockImplementation((_t: string, _s: string, ids: readonly string[]) =>
        Promise.resolve(SLOTS.filter((slot) => ids.includes(slot.id))),
      ),
    findCalendarCandidates: jest
      .fn()
      .mockImplementation((_t: string, _s: string, dates: readonly string[]) =>
        Promise.resolve(candidatesFor(dates)),
      ),
    findByWeeks: jest.fn().mockResolvedValue([]),
    list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findById: jest.fn().mockResolvedValue(null),
    saveWeeks: jest.fn().mockImplementation((input: SaveWeeksInput) =>
      Promise.resolve({
        created: input.creates.map((c, i) => fromInput(`new-${i}`, c)),
        replaced: input.replaces.map((r: ReplaceWeekInput) =>
          fromInput(r.id, { startDate: r.days[0].date, days: r.days }),
        ),
      }),
    ),
    softDelete: jest.fn().mockResolvedValue(undefined),
    updateLessonRecord: jest.fn().mockResolvedValue(null),
  };
}

function makeService() {
  const repository = makeRepository();
  const service = new WeeklySchedulesService(repository);
  return { service, repository };
}

function overrideCalendar(
  repository: jest.Mocked<IWeeklyScheduleRepository>,
  overrides: Overrides,
): void {
  repository.findCalendarCandidates.mockImplementation(
    (_t: string, _s: string, dates: readonly string[]) =>
      Promise.resolve(candidatesFor(dates, overrides)),
  );
}

async function expectCode(
  promise: Promise<unknown>,
  type: unknown,
  code: string,
) {
  await expect(promise).rejects.toBeInstanceOf(type);
  await expect(promise).rejects.toMatchObject({ response: { code } });
}

const MONDAY_LESSON = {
  lessonSlotId: 'ls-0800',
  subjectId: MATH,
  startTime: '08:00',
  endTime: '08:50',
};
/** Entrada da aula no POST/PUT: só a referência ao horário e a disciplina. */
const MONDAY_INPUT = { lessonSlotId: 'ls-0800', subjectId: MATH };

function createDto(
  startDate: string,
  lessonDate = startDate,
  lessons: { lessonSlotId: string; subjectId: string }[] = [MONDAY_INPUT],
) {
  return {
    schoolClassId: SCHOOL_CLASS.id,
    startDate,
    endDate: addDays(startDate, 6),
    days: [{ date: lessonDate, lessons }],
  };
}

describe('WeeklySchedulesService', () => {
  describe('create', () => {
    it('grava a semana com o instantâneo do calendário', async () => {
      const { service, repository } = makeService();
      const result = await service.create('t1', createDto('2026-09-28'), 'u1');

      const input = repository.saveWeeks.mock.calls[0][0];
      expect(input.replaces).toEqual([]);
      expect(input.creates).toHaveLength(1);
      expect(input.creates[0].days).toHaveLength(7);
      expect(input.creates[0].days[0]).toEqual({
        date: '2026-09-28',
        calendarId: 'cal-0',
        dayType: 'SCHOOL_DAY',
        lessons: [
          {
            ...MONDAY_LESSON,
            contentRecorded: false,
            attendanceRecorded: false,
          },
        ],
      });
      expect(repository.findLessonSlots).toHaveBeenCalledWith('t1', 's1', [
        'ls-0800',
      ]);
      expect(result.days[0]).toMatchObject({ weekday: 1, hasClass: true });
      expect(result.days[0].lessons[0]).toMatchObject({
        lessonSlotId: 'ls-0800',
        slotName: 'Aula',
        startTime: '08:00',
        endTime: '08:50',
      });
      expect(result.days[6]).toMatchObject({ weekday: 0, hasClass: false });
    });

    it('(a) SCHEDULE_SATURDAY_WITHOUT_LESSONS: calendário da escola prevalece no sábado', async () => {
      const { service, repository } = makeService();
      overrideCalendar(repository, {
        // O geral tem o menor id: só a precedência da escola dá SCHOOL_DAY.
        '2026-10-03': [
          { type: 'NON_SCHOOL_DAY', specific: false, calendarId: 'cal-a' },
          { type: 'SCHOOL_DAY', specific: true, calendarId: 'cal-z' },
        ],
      });
      await expectCode(
        service.create('t1', createDto('2026-09-28'), 'u1'),
        BadRequestException,
        'SCHEDULE_SATURDAY_WITHOUT_LESSONS',
      );
      expect(repository.saveWeeks).not.toHaveBeenCalled();
    });

    it('(b) aula em dia não letivo → SCHEDULE_LESSON_ON_NON_SCHOOL_DAY', async () => {
      const { service, repository } = makeService();
      overrideCalendar(repository, {
        '2026-10-12': [{ type: 'NON_SCHOOL_DAY' }],
      });
      await expectCode(
        service.create('t1', createDto('2026-10-12'), 'u1'),
        BadRequestException,
        'SCHEDULE_LESSON_ON_NON_SCHOOL_DAY',
      );
      expect(repository.saveWeeks).not.toHaveBeenCalled();
    });

    it('(c) semana começando no domingo → SCHEDULE_INVALID_PERIOD', async () => {
      const { service, repository } = makeService();
      await expectCode(
        service.create('t1', createDto('2026-09-27', '2026-09-28'), 'u1'),
        BadRequestException,
        'SCHEDULE_INVALID_PERIOD',
      );
      expect(repository.saveWeeks).not.toHaveBeenCalled();
    });

    it('(d) semana ocupada → SCHEDULE_WEEK_TAKEN', async () => {
      const { service, repository } = makeService();
      repository.findByWeeks.mockResolvedValue([
        scheduleRecord('w1', '2026-09-28'),
      ]);
      await expectCode(
        service.create('t1', createDto('2026-09-28'), 'u1'),
        ConflictException,
        'SCHEDULE_WEEK_TAKEN',
      );
      expect(repository.findByWeeks).toHaveBeenCalledWith('t1', 'sc1', [
        '2026-09-28',
      ]);
      expect(repository.saveWeeks).not.toHaveBeenCalled();
    });

    it('turma inexistente → SCHOOL_CLASS_NOT_FOUND', async () => {
      const { service, repository } = makeService();
      repository.findClass.mockResolvedValue(null);
      await expectCode(
        service.create('t1', createDto('2026-09-28'), 'u1'),
        NotFoundException,
        'SCHOOL_CLASS_NOT_FOUND',
      );
    });

    it('horário de aula de outra escola → SCHEDULE_LESSON_SLOT_INVALID', async () => {
      const { service, repository } = makeService();
      await expectCode(
        service.create(
          't1',
          createDto('2026-09-28', '2026-09-28', [
            { lessonSlotId: 'ls-outra', subjectId: MATH },
          ]),
          'u1',
        ),
        BadRequestException,
        'SCHEDULE_LESSON_SLOT_INVALID',
      );
      expect(repository.saveWeeks).not.toHaveBeenCalled();
    });

    it('mesmo horário repetido no dia → SCHEDULE_LESSON_OVERLAP', async () => {
      const { service, repository } = makeService();
      await expectCode(
        service.create(
          't1',
          createDto('2026-09-28', '2026-09-28', [
            MONDAY_INPUT,
            { lessonSlotId: 'ls-0800', subjectId: HISTORY },
          ]),
          'u1',
        ),
        BadRequestException,
        'SCHEDULE_LESSON_OVERLAP',
      );
      expect(repository.saveWeeks).not.toHaveBeenCalled();
    });

    it('disciplina inexistente → SCHEDULE_SUBJECTS_INVALID', async () => {
      const { service, repository } = makeService();
      repository.findExistingSubjectIds.mockResolvedValue([]);
      await expectCode(
        service.create('t1', createDto('2026-09-28'), 'u1'),
        BadRequestException,
        'SCHEDULE_SUBJECTS_INVALID',
      );
    });
  });

  describe('replicate', () => {
    const SOURCE = scheduleRecord('src', '2026-09-28', {
      '2026-09-28': [MONDAY_LESSON],
    });

    it('(e) cria, sobrescreve com OVERWRITTEN preservando a registrada e descarta RECORDED_CONFLICT e NON_SCHOOL_DAY', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(SOURCE);
      overrideCalendar(repository, {
        '2026-10-12': [{ type: 'NON_SCHOOL_DAY' }],
      });
      repository.findByWeeks.mockResolvedValue([
        scheduleRecord('w19', '2026-10-19', {
          '2026-10-19': [
            {
              lessonSlotId: 'ls-0820',
              subjectId: HISTORY,
              startTime: '08:20',
              endTime: '09:10',
              attendanceRecorded: true,
            },
            {
              lessonSlotId: 'ls-1000',
              subjectId: MATH,
              startTime: '10:00',
              endTime: '10:50',
            },
          ],
          '2026-10-20': [
            {
              lessonSlotId: 'ls-0900',
              subjectId: HISTORY,
              startTime: '09:00',
              endTime: '09:50',
            },
          ],
        }),
      ]);

      const result = await service.replicate(
        't1',
        'src',
        { targetStartDates: ['2026-10-12', '2026-10-19', '2026-10-26'] },
        'u1',
      );

      expect(repository.findCalendarCandidates).toHaveBeenCalledTimes(1);
      expect(repository.findByWeeks).toHaveBeenCalledWith('t1', 'sc1', [
        '2026-10-12',
        '2026-10-19',
        '2026-10-26',
      ]);
      expect(repository.saveWeeks).toHaveBeenCalledTimes(1);
      const input = repository.saveWeeks.mock.calls[0][0];
      expect(input.creates).toHaveLength(2);
      expect(input.replaces).toHaveLength(1);
      expect(input.replaces[0].id).toBe('w19');
      // Aulas antigas sem registro (10:00 da segunda, terça inteira) saem.
      expect(input.replaces[0].days[1]).toMatchObject({
        date: '2026-10-20',
        lessons: [],
      });
      expect(input.replaces[0].days[0].lessons).toEqual([
        {
          lessonSlotId: 'ls-0820',
          subjectId: HISTORY,
          startTime: '08:20',
          endTime: '09:10',
          contentRecorded: false,
          attendanceRecorded: true,
        },
      ]);

      const [oct12, oct19, oct26] = result.data;
      expect(oct12.action).toBe('CREATED');
      expect(oct12.schedule.startDate).toBe('2026-10-12');
      expect(oct12.discarded).toEqual([
        { ...MONDAY_LESSON, date: '2026-10-12', reason: 'NON_SCHOOL_DAY' },
      ]);
      expect(oct19.action).toBe('OVERWRITTEN');
      expect(oct19.schedule.id).toBe('w19');
      expect(oct19.preserved).toEqual([
        {
          date: '2026-10-19',
          lessonSlotId: 'ls-0820',
          subjectId: HISTORY,
          startTime: '08:20',
          endTime: '09:10',
          contentRecorded: false,
          attendanceRecorded: true,
        },
      ]);
      expect(oct19.discarded).toEqual([
        { ...MONDAY_LESSON, date: '2026-10-19', reason: 'RECORDED_CONFLICT' },
      ]);
      expect(oct26).toMatchObject({
        action: 'CREATED',
        preserved: [],
        discarded: [],
      });
      expect(oct26.schedule.days[0].lessons).toHaveLength(1);
      // A replicação copia a referência ao horário da escola.
      expect(input.creates[1].days[0].lessons[0]).toMatchObject({
        lessonSlotId: 'ls-0800',
      });
    });

    it('(f) SCHEDULE_SATURDAY_WITHOUT_LESSONS: sábado alvo letivo sem aula', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(SOURCE);
      overrideCalendar(repository, {
        '2026-10-24': [{ type: 'SCHOOL_DAY', specific: true }],
      });
      await expectCode(
        service.replicate(
          't1',
          'src',
          { targetStartDates: ['2026-10-12', '2026-10-19'] },
          'u1',
        ),
        BadRequestException,
        'SCHEDULE_SATURDAY_WITHOUT_LESSONS',
      );
      expect(repository.saveWeeks).not.toHaveBeenCalled();
    });

    it('alvo igual à semana de origem → SCHEDULE_INVALID_PERIOD', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(SOURCE);
      await expectCode(
        service.replicate(
          't1',
          'src',
          { targetStartDates: ['2026-09-28'] },
          'u1',
        ),
        BadRequestException,
        'SCHEDULE_INVALID_PERIOD',
      );
    });

    it('origem inexistente → SCHEDULE_NOT_FOUND', async () => {
      const { service } = makeService();
      await expectCode(
        service.replicate(
          't1',
          'x',
          { targetStartDates: ['2026-10-05'] },
          'u1',
        ),
        NotFoundException,
        'SCHEDULE_NOT_FOUND',
      );
    });
  });

  describe('update', () => {
    const RECORDED = scheduleRecord('w1', '2026-09-28', {
      '2026-09-28': [{ ...MONDAY_LESSON, attendanceRecorded: true }],
    });

    it('(g) remover aula registrada → SCHEDULE_HAS_RECORDS', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(RECORDED);
      await expectCode(
        service.update(
          't1',
          'w1',
          {
            days: [
              {
                date: '2026-09-29',
                lessons: [{ ...MONDAY_INPUT }],
              },
            ],
          },
          'u1',
        ),
        ConflictException,
        'SCHEDULE_HAS_RECORDS',
      );
      expect(repository.saveWeeks).not.toHaveBeenCalled();
    });

    it('mantém a aula registrada com as flags e substitui os dias', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(RECORDED);
      await service.update(
        't1',
        'w1',
        { days: [{ date: '2026-09-28', lessons: [MONDAY_INPUT] }] },
        'u1',
      );
      const input = repository.saveWeeks.mock.calls[0][0];
      expect(input.creates).toEqual([]);
      expect(input.replaces[0].id).toBe('w1');
      expect(input.replaces[0].days[0].lessons[0]).toMatchObject({
        attendanceRecorded: true,
      });
    });

    it('horário inexistente → SCHEDULE_NOT_FOUND', async () => {
      const { service } = makeService();
      await expectCode(
        service.update('t1', 'x', { days: [] }, 'u1'),
        NotFoundException,
        'SCHEDULE_NOT_FOUND',
      );
    });
  });

  describe('remove', () => {
    it('horário com aula registrada → SCHEDULE_HAS_RECORDS', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(
        scheduleRecord('w1', '2026-09-28', {
          '2026-09-28': [{ ...MONDAY_LESSON, contentRecorded: true }],
        }),
      );
      await expectCode(
        service.remove('t1', 'w1', 'u1'),
        ConflictException,
        'SCHEDULE_HAS_RECORDS',
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('exclui logicamente sem registros', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(scheduleRecord('w1', '2026-09-28'));
      await service.remove('t1', 'w1', 'u1');
      expect(repository.softDelete).toHaveBeenCalledWith('t1', 'w1', 'u1');
    });
  });

  describe('updateLessonRecord', () => {
    it('(h) aula inexistente → SCHEDULE_LESSON_NOT_FOUND', async () => {
      const { service, repository } = makeService();
      await expectCode(
        service.updateLessonRecord(
          't1',
          'w1',
          'l1',
          { attendanceRecorded: true },
          'u1',
        ),
        NotFoundException,
        'SCHEDULE_LESSON_NOT_FOUND',
      );
      expect(repository.updateLessonRecord).toHaveBeenCalledWith(
        't1',
        'w1',
        'l1',
        {
          contentRecorded: undefined,
          attendanceRecorded: true,
          updatedById: 'u1',
        },
      );
    });
  });

  describe('findOne / list', () => {
    it('mapeia contagens e dias', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue({
        ...scheduleRecord('w1', '2026-09-28', {
          '2026-09-28': [MONDAY_LESSON],
        }),
        lessonCount: 1,
      });
      const result = await service.findOne('t1', 'w1');
      expect(result).not.toHaveProperty('tenantId');
      expect(result.record).toEqual({
        lessons: 1,
        contentRecorded: 0,
        attendanceRecorded: 0,
      });
      expect(result.days[0]).toMatchObject({
        date: '2026-09-28',
        dayType: 'SCHOOL_DAY',
        hasClass: true,
      });
    });

    it('findOne inexistente → SCHEDULE_NOT_FOUND', async () => {
      const { service } = makeService();
      await expectCode(
        service.findOne('t1', 'x'),
        NotFoundException,
        'SCHEDULE_NOT_FOUND',
      );
    });

    it('list aplica paginação padrão', async () => {
      const { service, repository } = makeService();
      await service.list('t1', { schoolClassId: 'sc1' });
      expect(repository.list).toHaveBeenCalledWith({
        tenantId: 't1',
        schoolClassId: 'sc1',
        from: undefined,
        to: undefined,
        page: 1,
        limit: 20,
      });
    });
  });
});
