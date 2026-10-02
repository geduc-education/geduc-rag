import { BadRequestException } from '@nestjs/common';
import {
  assertCalendarRange,
  assertDayTypeChangeAllowed,
  buildCalendarDays,
  countByType,
  defaultDayType,
  resolvePeriod,
  totalsFromCounts,
  weekdayOf,
} from '../academic-calendar.rules';

function codeOf(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const body = (error as BadRequestException).getResponse() as {
      code: string;
    };
    return body.code;
  }
  return undefined;
}

describe('academic-calendar.rules', () => {
  it('weekdayOf e defaultDayType seguem o calendário civil em UTC', () => {
    expect(weekdayOf('2026-02-01')).toBe(0);
    expect(weekdayOf('2026-02-07')).toBe(6);
    expect(defaultDayType('2026-02-01')).toBe('NON_SCHOOL_DAY');
    expect(defaultDayType('2026-02-02')).toBe('SCHOOL_DAY');
  });

  it('buildCalendarDays gera um dia por data, inclusivo, com tipo padrão', () => {
    const days = buildCalendarDays('2026-02-01', '2026-02-07');
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: '2026-02-01', type: 'NON_SCHOOL_DAY' });
    expect(days[6]).toEqual({ date: '2026-02-07', type: 'NON_SCHOOL_DAY' });
    expect(days.slice(1, 6).every((d) => d.type === 'SCHOOL_DAY')).toBe(true);
    expect(days.map((d) => d.date)).toEqual([
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
      '2026-02-05',
      '2026-02-06',
      '2026-02-07',
    ]);
  });

  it('resolvePeriod calcula dia, semana (domingo a sábado), mês e ano', () => {
    expect(resolvePeriod('day', '2026-02-04')).toEqual({
      startDate: '2026-02-04',
      endDate: '2026-02-04',
    });
    expect(resolvePeriod('week', '2026-02-04')).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-07',
    });
    expect(resolvePeriod('month', '2028-02-10')).toEqual({
      startDate: '2028-02-01',
      endDate: '2028-02-29',
    });
    expect(resolvePeriod('year', '2026-07-15')).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
  });

  it('countByType do ano de 2026 inteiro', () => {
    const types = buildCalendarDays('2026-01-01', '2026-12-31').map(
      (d) => d.type,
    );
    expect(countByType(types)).toEqual({
      SCHOOL_DAY: 261,
      NON_SCHOOL_DAY: 104,
      OPTIONAL_DAY: 0,
      LESSON_PLANNING: 0,
      TEACHER_TRAINING: 0,
      total: 365,
    });
  });

  it('totalsFromCounts preenche as chaves ausentes com zero', () => {
    expect(
      totalsFromCounts([
        { type: 'SCHOOL_DAY', total: 3 },
        { type: 'OPTIONAL_DAY', total: 2 },
      ]),
    ).toEqual({
      SCHOOL_DAY: 3,
      NON_SCHOOL_DAY: 0,
      OPTIONAL_DAY: 2,
      LESSON_PLANNING: 0,
      TEACHER_TRAINING: 0,
      total: 5,
    });
  });

  it('assertDayTypeChangeAllowed protege só o domingo', () => {
    expect(
      codeOf(() => assertDayTypeChangeAllowed('2026-02-01', 'SCHOOL_DAY')),
    ).toBe('CALENDAR_SUNDAY_IMMUTABLE');
    expect(() =>
      assertDayTypeChangeAllowed('2026-02-07', 'SCHOOL_DAY'),
    ).not.toThrow();
    expect(() =>
      assertDayTypeChangeAllowed('2026-02-01', 'NON_SCHOOL_DAY'),
    ).not.toThrow();
    expect(() =>
      assertDayTypeChangeAllowed('2026-02-01', undefined),
    ).not.toThrow();
  });

  it('assertCalendarRange exige datas ordenadas dentro do ano', () => {
    expect(
      codeOf(() => assertCalendarRange(2026, '2026-12-31', '2027-01-02')),
    ).toBe('CALENDAR_INVALID_RANGE');
    expect(
      codeOf(() => assertCalendarRange(2026, '2026-03-10', '2026-03-01')),
    ).toBe('CALENDAR_INVALID_RANGE');
    expect(() =>
      assertCalendarRange(2026, '2026-02-01', '2026-12-18'),
    ).not.toThrow();
  });
});
