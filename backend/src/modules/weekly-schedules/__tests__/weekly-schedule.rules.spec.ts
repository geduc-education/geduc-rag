import {
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import {
  assertDaysMatchCalendar,
  assertLessonsValid,
  assertScheduleWeek,
  attachSlotTimes,
  carryLessonRecords,
  listPeriodDates,
  mergeWithRecorded,
  normalizePlannedDays,
  replicateDays,
  resolveCalendarDays,
  weekPeriod,
  type DatedLesson,
  type PlannedDay,
  type ResolvedCalendarDay,
} from '../weekly-schedule.rules';

function codeOf(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const body = (error as HttpException).getResponse() as { code: string };
    return body.code;
  }
  return undefined;
}

function lesson(
  startTime: string,
  endTime: string,
  subjectId = 's1',
  lessonSlotId: string | null = `slot-${startTime}`,
) {
  return { lessonSlotId, subjectId, startTime, endTime };
}

function schoolWeek(
  startDate: string,
  overrides: Record<string, ResolvedCalendarDay['type']> = {},
): ResolvedCalendarDay[] {
  return listPeriodDates(startDate, weekPeriod(startDate).endDate).map(
    (date) => ({
      date,
      calendarId: 'c1',
      type: date in overrides ? overrides[date] : 'SCHOOL_DAY',
    }),
  );
}

describe('weekly-schedule.rules', () => {
  it('weekPeriod e listPeriodDates cobrem segunda a domingo', () => {
    expect(weekPeriod('2026-10-12')).toEqual({
      startDate: '2026-10-12',
      endDate: '2026-10-18',
    });
    expect(listPeriodDates('2026-12-28', '2027-01-03')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });

  it('assertScheduleWeek exige segunda, 7 dias e o ano letivo', () => {
    expect(
      codeOf(() =>
        assertScheduleWeek(
          { startDate: '2026-09-28', endDate: '2026-10-04' },
          2026,
        ),
      ),
    ).toBeUndefined();
    expect(
      codeOf(() =>
        assertScheduleWeek(
          { startDate: '2026-12-28', endDate: '2027-01-03' },
          2026,
        ),
      ),
    ).toBeUndefined();
    expect(
      codeOf(() =>
        assertScheduleWeek(
          { startDate: '2026-09-27', endDate: '2026-10-03' },
          2026,
        ),
      ),
    ).toBe('SCHEDULE_INVALID_PERIOD');
    expect(
      codeOf(() =>
        assertScheduleWeek(
          { startDate: '2026-09-28', endDate: '2026-10-05' },
          2026,
        ),
      ),
    ).toBe('SCHEDULE_INVALID_PERIOD');
    expect(
      codeOf(() =>
        assertScheduleWeek(
          { startDate: '2026-09-28', endDate: '2026-10-04' },
          2025,
        ),
      ),
    ).toBe('SCHEDULE_INVALID_PERIOD');
  });

  it('assertLessonsValid recusa o mesmo horário repetido no dia', () => {
    expect(
      codeOf(() =>
        assertLessonsValid([
          lesson('07:30', '08:20', 's1', 'ls1'),
          lesson('07:30', '08:20', 's2', 'ls1'),
        ]),
      ),
    ).toBe('SCHEDULE_LESSON_OVERLAP');
    expect(
      codeOf(() =>
        assertLessonsValid([
          lesson('07:30', '08:20', 's1', 'ls1'),
          lesson('08:20', '09:10', 's1', 'ls2'),
        ]),
      ),
    ).toBeUndefined();
  });

  it('attachSlotTimes copia as horas do horário da escola', () => {
    const slots = [
      { id: 'ls1', startTime: '07:00', endTime: '07:50' },
      { id: 'ls2', startTime: '07:50', endTime: '08:40' },
    ];
    expect(
      attachSlotTimes(
        [
          {
            date: '2026-10-13',
            lessons: [
              { lessonSlotId: 'ls2', subjectId: 's1' },
              { lessonSlotId: 'ls1', subjectId: 's2' },
            ],
          },
        ],
        slots,
      ),
    ).toEqual([
      {
        date: '2026-10-13',
        lessons: [
          lesson('07:50', '08:40', 's1', 'ls2'),
          lesson('07:00', '07:50', 's2', 'ls1'),
        ],
      },
    ]);
  });

  it('attachSlotTimes recusa horário que não é da escola da turma', () => {
    expect(
      codeOf(() =>
        attachSlotTimes(
          [
            {
              date: '2026-10-13',
              lessons: [{ lessonSlotId: 'outra', subjectId: 's1' }],
            },
          ],
          [{ id: 'ls1', startTime: '07:00', endTime: '07:50' }],
        ),
      ),
    ).toBe('SCHEDULE_LESSON_SLOT_INVALID');
  });

  it('normalizePlannedDays preenche a semana, ordena e recusa data fora', () => {
    const period = weekPeriod('2026-10-12');
    const days = normalizePlannedDays(period, [
      {
        date: '2026-10-13',
        lessons: [lesson('09:00', '09:50'), lesson('07:30', '08:20')],
      },
    ]);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: '2026-10-12', lessons: [] });
    expect(days[1].lessons.map((l) => l.startTime)).toEqual(['07:30', '09:00']);
    expect(
      codeOf(() =>
        normalizePlannedDays(period, [{ date: '2026-10-19', lessons: [] }]),
      ),
    ).toBe('SCHEDULE_INVALID_PERIOD');
    expect(
      codeOf(() =>
        normalizePlannedDays(period, [
          { date: '2026-10-13', lessons: [] },
          { date: '2026-10-13', lessons: [] },
        ]),
      ),
    ).toBe('SCHEDULE_INVALID_PERIOD');
  });

  it('resolveCalendarDays prefere o calendário da escola ao geral', () => {
    expect(
      resolveCalendarDays(
        ['2026-10-03'],
        [
          {
            date: '2026-10-03',
            calendarId: 'geral',
            type: 'NON_SCHOOL_DAY',
            specific: false,
          },
          {
            date: '2026-10-03',
            calendarId: 'escola',
            type: 'SCHOOL_DAY',
            specific: true,
          },
        ],
      ),
    ).toEqual([
      { date: '2026-10-03', calendarId: 'escola', type: 'SCHOOL_DAY' },
    ]);
  });

  it('resolveCalendarDays desempata pelo menor calendarId', () => {
    expect(
      resolveCalendarDays(
        ['2026-10-05'],
        [
          {
            date: '2026-10-05',
            calendarId: 'b',
            type: 'SCHOOL_DAY',
            specific: true,
          },
          {
            date: '2026-10-05',
            calendarId: 'a',
            type: 'OPTIONAL_DAY',
            specific: true,
          },
        ],
      ),
    ).toEqual([{ date: '2026-10-05', calendarId: 'a', type: 'OPTIONAL_DAY' }]);
  });

  it('resolveCalendarDays: 2026-12-19 fora do calendário vira null sem erro', () => {
    const resolved = resolveCalendarDays(
      ['2026-12-18', '2026-12-19'],
      [
        {
          date: '2026-12-18',
          calendarId: 'escola',
          type: 'SCHOOL_DAY',
          specific: true,
        },
      ],
    );
    expect(resolved).toHaveLength(2);
    expect(resolved[1]).toEqual({
      date: '2026-12-19',
      calendarId: null,
      type: null,
    });
  });

  it('resolveCalendarDays recusa semana inteira sem calendário', () => {
    expect(codeOf(() => resolveCalendarDays(['2026-10-04'], []))).toBe(
      'SCHEDULE_CALENDAR_NOT_FOUND',
    );
  });

  it('assertDaysMatchCalendar exige aula no sábado letivo', () => {
    const calendar = schoolWeek('2026-09-28');
    const days: PlannedDay[] = calendar.map(({ date }) => ({
      date,
      lessons: date === '2026-10-03' ? [] : [lesson('07:30', '08:20')],
    }));
    const error = (() => {
      try {
        assertDaysMatchCalendar(
          days.filter((d) => d.date !== '2026-10-04'),
          calendar,
        );
      } catch (e) {
        return e as BadRequestException;
      }
      return undefined;
    })();
    expect(error).toBeInstanceOf(BadRequestException);
    const body = error?.getResponse() as { code: string; message: string };
    expect(body.code).toBe('SCHEDULE_SATURDAY_WITHOUT_LESSONS');
    expect(body.message).toContain('2026-10-03');
  });

  it('assertDaysMatchCalendar recusa aula em dia não letivo', () => {
    const calendar = schoolWeek('2026-10-12', {
      '2026-10-12': 'NON_SCHOOL_DAY',
      '2026-10-17': 'NON_SCHOOL_DAY',
      '2026-10-18': 'NON_SCHOOL_DAY',
    });
    const days: PlannedDay[] = [
      { date: '2026-10-12', lessons: [lesson('07:30', '08:20')] },
    ];
    expect(codeOf(() => assertDaysMatchCalendar(days, calendar))).toBe(
      'SCHEDULE_LESSON_ON_NON_SCHOOL_DAY',
    );
  });

  it('assertDaysMatchCalendar: semana com fim do calendário no meio (2026-12-19 null recusa aula)', () => {
    const calendar: ResolvedCalendarDay[] = listPeriodDates(
      '2026-12-14',
      '2026-12-20',
    ).map((date) =>
      date <= '2026-12-18'
        ? { date, calendarId: 'escola', type: 'SCHOOL_DAY' }
        : { date, calendarId: null, type: null },
    );
    const okDays: PlannedDay[] = calendar.map(({ date }) => ({
      date,
      lessons: date <= '2026-12-18' ? [lesson('07:30', '08:20')] : [],
    }));
    expect(codeOf(() => assertDaysMatchCalendar(okDays, calendar))).toBe(
      undefined,
    );
    const badDays = okDays.map((d) =>
      d.date === '2026-12-19'
        ? { ...d, lessons: [lesson('07:30', '08:20')] }
        : d,
    );
    expect(codeOf(() => assertDaysMatchCalendar(badDays, calendar))).toBe(
      'SCHEDULE_LESSON_ON_NON_SCHOOL_DAY',
    );
  });

  it('replicateDays descarta aula em dia não letivo do alvo', () => {
    const source: PlannedDay[] = [
      { date: '2026-09-28', lessons: [lesson('07:30', '08:20')] },
      { date: '2026-09-29', lessons: [lesson('08:00', '08:50', 's2')] },
    ];
    const targetDates = listPeriodDates('2026-10-12', '2026-10-18');
    const calendar = schoolWeek('2026-10-12', {
      '2026-10-12': 'NON_SCHOOL_DAY',
      '2026-10-17': 'NON_SCHOOL_DAY',
      '2026-10-18': 'NON_SCHOOL_DAY',
    });
    const result = replicateDays(source, targetDates, calendar);
    expect(result.days).toHaveLength(7);
    expect(result.days[0]).toEqual({ date: '2026-10-12', lessons: [] });
    expect(result.days[1]).toEqual({
      date: '2026-10-13',
      lessons: [lesson('08:00', '08:50', 's2')],
    });
    expect(result.discarded).toEqual([
      {
        ...lesson('07:30', '08:20'),
        date: '2026-10-12',
        reason: 'NON_SCHOOL_DAY',
      },
    ]);
  });

  it('mergeWithRecorded preserva registradas e descarta conflitos', () => {
    const existing: DatedLesson[] = [
      {
        ...lesson('08:20', '09:10'),
        date: '2026-10-19',
        contentRecorded: false,
        attendanceRecorded: true,
      },
      {
        ...lesson('10:00', '10:50'),
        date: '2026-10-19',
        contentRecorded: false,
        attendanceRecorded: false,
      },
    ];
    const replicated: PlannedDay[] = [
      {
        date: '2026-10-19',
        lessons: [lesson('09:10', '10:00'), lesson('08:00', '08:50')],
      },
      { date: '2026-10-20', lessons: [] },
    ];
    const result = mergeWithRecorded(replicated, existing);
    expect(result.days[0]).toEqual({
      date: '2026-10-19',
      lessons: [
        {
          ...lesson('08:20', '09:10'),
          contentRecorded: false,
          attendanceRecorded: true,
        },
        {
          ...lesson('09:10', '10:00'),
          contentRecorded: false,
          attendanceRecorded: false,
        },
      ],
    });
    expect(result.days[1]).toEqual({ date: '2026-10-20', lessons: [] });
    expect(result.preserved).toEqual([existing[0]]);
    expect(result.discarded).toEqual([
      {
        ...lesson('08:00', '08:50'),
        date: '2026-10-19',
        reason: 'RECORDED_CONFLICT',
      },
    ]);
  });

  it('mergeWithRecorded absorve replicada idêntica à registrada', () => {
    const existing: DatedLesson[] = [
      {
        ...lesson('08:20', '09:10'),
        date: '2026-10-19',
        contentRecorded: true,
        attendanceRecorded: false,
      },
    ];
    const result = mergeWithRecorded(
      [{ date: '2026-10-19', lessons: [lesson('08:20', '09:10')] }],
      existing,
    );
    expect(result.days[0].lessons).toEqual([
      {
        ...lesson('08:20', '09:10'),
        contentRecorded: true,
        attendanceRecorded: false,
      },
    ]);
    expect(result.discarded).toEqual([]);
  });

  it('carryLessonRecords herda flags e barra remoção de aula registrada', () => {
    const existing: DatedLesson[] = [
      {
        ...lesson('07:30', '08:20'),
        date: '2026-10-19',
        contentRecorded: true,
        attendanceRecorded: true,
      },
      {
        ...lesson('08:20', '09:10'),
        date: '2026-10-19',
        contentRecorded: false,
        attendanceRecorded: false,
      },
    ];
    const carried = carryLessonRecords(existing, [
      {
        date: '2026-10-19',
        lessons: [lesson('07:30', '08:20'), lesson('09:10', '10:00')],
      },
    ]);
    expect(carried[0].lessons).toEqual([
      {
        ...lesson('07:30', '08:20'),
        contentRecorded: true,
        attendanceRecorded: true,
      },
      {
        ...lesson('09:10', '10:00'),
        contentRecorded: false,
        attendanceRecorded: false,
      },
    ]);

    // A escola mudou as horas do horário: a aula segue a mesma (mesmo slot).
    const moved = carryLessonRecords(
      [existing[0]],
      [
        {
          date: '2026-10-19',
          lessons: [lesson('07:40', '08:30', 's1', 'slot-07:30')],
        },
      ],
    );
    expect(moved[0].lessons[0]).toMatchObject({
      lessonSlotId: 'slot-07:30',
      contentRecorded: true,
      attendanceRecorded: true,
    });

    let thrown: unknown;
    try {
      carryLessonRecords(
        [{ ...existing[0], contentRecorded: false }],
        [{ date: '2026-10-19', lessons: [lesson('07:30', '08:20', 's2')] }],
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ConflictException);
    expect(
      ((thrown as ConflictException).getResponse() as { code: string }).code,
    ).toBe('SCHEDULE_HAS_RECORDS');
  });
});
