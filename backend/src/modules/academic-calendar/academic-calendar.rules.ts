import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../../common/errors/error-codes';

/**
 * Regras puras do calendário acadêmico — sem I/O, para o repositório e o
 * service comporem e os testes exercitarem isoladamente.
 *
 * Toda data é texto `YYYY-MM-DD`; a aritmética é feita em UTC para não
 * depender do fuso do processo.
 */

export const DAY_TYPES = [
  'SCHOOL_DAY',
  'NON_SCHOOL_DAY',
  'OPTIONAL_DAY',
  'LESSON_PLANNING',
  'TEACHER_TRAINING',
] as const;
export type DayType = (typeof DAY_TYPES)[number];

export const CALENDAR_VIEWS = ['day', 'week', 'month', 'year'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export interface GeneratedDay {
  date: string;
  type: DayType;
}

export interface DayTypeCount {
  type: DayType;
  total: number;
}

export type DayTypeTotals = Record<DayType, number> & { total: number };

export interface DatePeriod {
  startDate: string;
  endDate: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string): Date {
  return new Date(date + 'T00:00:00Z');
}

function formatUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return formatUtc(new Date(toUtc(date).getTime() + days * DAY_MS));
}

/** Dia da semana em UTC: 0 = domingo … 6 = sábado. */
export function weekdayOf(date: string): number {
  return toUtc(date).getUTCDay();
}

/** Fim de semana nasce não letivo; segunda a sexta, letivo. */
export function defaultDayType(date: string): DayType {
  const weekday = weekdayOf(date);
  return weekday === 0 || weekday === 6 ? 'NON_SCHOOL_DAY' : 'SCHOOL_DAY';
}

/** Intervalo ordenado e inteiramente dentro do ano letivo informado. */
export function assertCalendarRange(
  year: number,
  startDate: string,
  endDate: string,
): void {
  const prefix = `${year}-`;
  const inYear = startDate.startsWith(prefix) && endDate.startsWith(prefix);
  if (inYear && startDate <= endDate) return;
  throw new BadRequestException({
    code: ERROR_CODES.CALENDAR_INVALID_RANGE,
    message: `O período deve estar dentro de ${year} e o início não pode ser posterior ao fim.`,
  });
}

/** Um dia por data, inclusivo nas duas pontas, em ordem crescente. */
export function buildCalendarDays(
  startDate: string,
  endDate: string,
): GeneratedDay[] {
  const days: GeneratedDay[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    days.push({ date, type: defaultDayType(date) });
  }
  return days;
}

function monthPeriod(date: string): DatePeriod {
  const start = toUtc(date.slice(0, 8) + '01');
  const nextMonth = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    1,
  );
  return {
    startDate: formatUtc(start),
    endDate: formatUtc(new Date(nextMonth - DAY_MS)),
  };
}

/** Período da visão que contém `date` (semana = domingo a sábado). */
export function resolvePeriod(view: CalendarView, date: string): DatePeriod {
  if (view === 'day') return { startDate: date, endDate: date };
  if (view === 'month') return monthPeriod(date);
  if (view === 'year') {
    const year = date.slice(0, 4);
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  const startDate = addDays(date, -weekdayOf(date));
  return { startDate, endDate: addDays(startDate, 6) };
}

function emptyTotals(): DayTypeTotals {
  return {
    SCHOOL_DAY: 0,
    NON_SCHOOL_DAY: 0,
    OPTIONAL_DAY: 0,
    LESSON_PLANNING: 0,
    TEACHER_TRAINING: 0,
    total: 0,
  };
}

/** Todas as 5 chaves presentes (ausentes = 0) e `total` = soma. */
export function totalsFromCounts(
  counts: readonly DayTypeCount[],
): DayTypeTotals {
  const totals = emptyTotals();
  for (const { type, total } of counts) {
    totals[type] += total;
    totals.total += total;
  }
  return totals;
}

export function countByType(types: readonly DayType[]): DayTypeTotals {
  return totalsFromCounts(types.map((type) => ({ type, total: 1 })));
}

/** Domingo é sempre não letivo: só aceita `NON_SCHOOL_DAY` (no-op). */
export function assertDayTypeChangeAllowed(
  date: string,
  type: DayType | undefined,
): void {
  if (weekdayOf(date) !== 0) return;
  if (type === undefined || type === 'NON_SCHOOL_DAY') return;
  throw new BadRequestException({
    code: ERROR_CODES.CALENDAR_SUNDAY_IMMUTABLE,
    message:
      'O domingo é sempre dia não letivo e não pode ter o tipo alterado.',
  });
}
