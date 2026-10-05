import { BadRequestException, ConflictException } from '@nestjs/common';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  weekdayOf,
  type DatePeriod,
  type DayType,
} from '../academic-calendar/academic-calendar.rules';

/**
 * Regras puras do horário semanal — sem I/O, para o repositório e o service
 * comporem e os testes exercitarem isoladamente.
 *
 * Toda data é texto `YYYY-MM-DD` e toda hora `HH:mm`; a aritmética de datas é
 * feita em UTC. `calendarId`/`type` `null` = data fora de qualquer calendário.
 */

export const SCHEDULE_STATUSES = ['UP_TO_DATE', 'OUTDATED'] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const DISCARD_REASONS = ['NON_SCHOOL_DAY', 'RECORDED_CONFLICT'] as const;
export type DiscardReason = (typeof DISCARD_REASONS)[number];

/**
 * Aula planejada: referência ao horário da escola e as horas dele copiadas.
 * `lessonSlotId` `null` só em aula gravada antes dos horários da escola.
 */
export interface PlannedLesson {
  lessonSlotId: string | null;
  subjectId: string;
  startTime: string;
  endTime: string;
}

/** Aula como chega no POST/PUT: só o horário da escola e a disciplina. */
export interface LessonInput {
  lessonSlotId: string;
  subjectId: string;
}

export interface DayInput {
  date: string;
  lessons: LessonInput[];
}

/** Horário de aula da escola da turma, com as horas vigentes. */
export interface SlotTimes {
  id: string;
  startTime: string;
  endTime: string;
}

export interface RecordFlags {
  contentRecorded: boolean;
  attendanceRecorded: boolean;
}

export type FlaggedLesson = PlannedLesson & RecordFlags;
export type DatedLesson = FlaggedLesson & { date: string };

export interface PlannedDay {
  date: string;
  lessons: PlannedLesson[];
}

export interface FlaggedDay {
  date: string;
  lessons: FlaggedLesson[];
}

export type DiscardedLesson = PlannedLesson & {
  date: string;
  reason: DiscardReason;
};

export interface CalendarDayCandidate {
  date: string;
  calendarId: string;
  type: DayType;
  specific: boolean;
}

export interface ResolvedCalendarDay {
  date: string;
  calendarId: string | null;
  type: DayType | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SATURDAY = 6;

function badRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

export function addDays(date: string, days: number): string {
  const time = new Date(date + 'T00:00:00Z').getTime() + days * DAY_MS;
  return new Date(time).toISOString().slice(0, 10);
}

/** Datas do período, inclusivo nas duas pontas, em ordem crescente. */
export function listPeriodDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/** Semana de segunda (`startDate`) a domingo. */
export function weekPeriod(startDate: string): DatePeriod {
  return { startDate, endDate: addDays(startDate, 6) };
}

/** Segunda a domingo, tocando o ano letivo da turma. */
export function assertScheduleWeek(
  period: DatePeriod,
  schoolYear: number,
): void {
  const { startDate, endDate } = period;
  const prefix = `${schoolYear}-`;
  const touchesYear =
    startDate.startsWith(prefix) || endDate.startsWith(prefix);
  const isWeek =
    weekdayOf(startDate) === 1 && endDate === addDays(startDate, 6);
  if (isWeek && touchesYear) return;
  throw badRequest(
    ERROR_CODES.SCHEDULE_INVALID_PERIOD,
    `A semana deve ir de segunda a domingo e tocar o ano letivo ${schoolYear}.`,
  );
}

function overlaps(a: PlannedLesson, b: PlannedLesson): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

function byStartTime<T extends PlannedLesson>(lessons: readonly T[]): T[] {
  return [...lessons].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** O mesmo horário da escola não se repete no dia. */
export function assertLessonsValid(lessons: readonly PlannedLesson[]): void {
  const ids = lessons.flatMap((l) => (l.lessonSlotId ? [l.lessonSlotId] : []));
  if (new Set(ids).size === ids.length) return;
  throw badRequest(
    ERROR_CODES.SCHEDULE_LESSON_OVERLAP,
    'O mesmo horário de aula se repete no dia.',
  );
}

/** Troca cada referência pelas horas do horário; fora da escola é 400. */
export function attachSlotTimes(
  days: readonly DayInput[],
  slots: readonly SlotTimes[],
): PlannedDay[] {
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  return days.map((day) => ({
    date: day.date,
    lessons: day.lessons.map((lesson) => {
      const slot = byId.get(lesson.lessonSlotId);
      if (!slot) {
        throw badRequest(
          ERROR_CODES.SCHEDULE_LESSON_SLOT_INVALID,
          'Um ou mais horários de aula não pertencem à escola da turma.',
        );
      }
      return {
        lessonSlotId: slot.id,
        subjectId: lesson.subjectId,
        startTime: slot.startTime,
        endTime: slot.endTime,
      };
    }),
  }));
}

function indexPlannedDays(
  dates: readonly string[],
  days: readonly PlannedDay[],
): Map<string, PlannedDay> {
  const allowed = new Set(dates);
  const byDate = new Map<string, PlannedDay>();
  for (const day of days) {
    if (!allowed.has(day.date) || byDate.has(day.date)) {
      throw badRequest(
        ERROR_CODES.SCHEDULE_INVALID_PERIOD,
        `O dia ${day.date} está fora da semana ou repetido.`,
      );
    }
    byDate.set(day.date, day);
  }
  return byDate;
}

/** Um dia por data do período, aulas ordenadas e validadas. */
export function normalizePlannedDays(
  period: DatePeriod,
  days: readonly PlannedDay[],
): PlannedDay[] {
  const dates = listPeriodDates(period.startDate, period.endDate);
  const byDate = indexPlannedDays(dates, days);
  return dates.map((date) => {
    const lessons = byStartTime(byDate.get(date)?.lessons ?? []);
    assertLessonsValid(lessons);
    return { date, lessons };
  });
}

function preferCandidate(
  a: CalendarDayCandidate,
  b: CalendarDayCandidate,
): CalendarDayCandidate {
  if (a.specific !== b.specific) return a.specific ? a : b;
  return a.calendarId <= b.calendarId ? a : b;
}

/** Calendário da escola prevalece sobre o geral; empate → menor `calendarId`. */
export function resolveCalendarDays(
  dates: readonly string[],
  candidates: readonly CalendarDayCandidate[],
): ResolvedCalendarDay[] {
  const best = new Map<string, CalendarDayCandidate>();
  for (const candidate of candidates) {
    const current = best.get(candidate.date);
    best.set(
      candidate.date,
      current ? preferCandidate(current, candidate) : candidate,
    );
  }
  const resolved = dates.map((date) => {
    const chosen = best.get(date);
    if (!chosen) return { date, calendarId: null, type: null };
    return { date, calendarId: chosen.calendarId, type: chosen.type };
  });
  if (resolved.some((day) => day.calendarId !== null)) return resolved;
  throw badRequest(
    ERROR_CODES.SCHEDULE_CALENDAR_NOT_FOUND,
    'Nenhuma data da semana está coberta por um calendário da turma.',
  );
}

function typeByDate(
  calendar: readonly ResolvedCalendarDay[],
): Map<string, DayType | null> {
  return new Map(calendar.map((day) => [day.date, day.type]));
}

/** Sábado letivo precisa de ao menos uma aula. */
export function assertSaturdayLessons(
  days: readonly PlannedDay[],
  calendar: readonly ResolvedCalendarDay[],
): void {
  const types = typeByDate(calendar);
  const empty = days.find(
    (day) =>
      weekdayOf(day.date) === SATURDAY &&
      types.get(day.date) === 'SCHOOL_DAY' &&
      day.lessons.length === 0,
  );
  if (!empty) return;
  throw badRequest(
    ERROR_CODES.SCHEDULE_SATURDAY_WITHOUT_LESSONS,
    `O sábado ${empty.date} é letivo e precisa de ao menos uma aula.`,
  );
}

/** Aula só em dia letivo; depois, sábado letivo com aula. */
export function assertDaysMatchCalendar(
  days: readonly PlannedDay[],
  calendar: readonly ResolvedCalendarDay[],
): void {
  const types = typeByDate(calendar);
  const invalid = days.find(
    (day) =>
      day.lessons.length > 0 && (types.get(day.date) ?? null) !== 'SCHOOL_DAY',
  );
  if (invalid) {
    throw badRequest(
      ERROR_CODES.SCHEDULE_LESSON_ON_NON_SCHOOL_DAY,
      `O dia ${invalid.date} não é letivo e não pode ter aulas.`,
    );
  }
  assertSaturdayLessons(days, calendar);
}

/** Copia as aulas de cada dia da semana; dia alvo não letivo descarta. */
export function replicateDays(
  source: readonly PlannedDay[],
  targetDates: readonly string[],
  calendar: readonly ResolvedCalendarDay[],
): { days: PlannedDay[]; discarded: DiscardedLesson[] } {
  const byWeekday = new Map(source.map((d) => [weekdayOf(d.date), d.lessons]));
  const types = typeByDate(calendar);
  const discarded: DiscardedLesson[] = [];
  const days = targetDates.map((date) => {
    const lessons = byStartTime(byWeekday.get(weekdayOf(date)) ?? []);
    if (types.get(date) === 'SCHOOL_DAY') return { date, lessons };
    for (const lesson of lessons) {
      discarded.push({ ...lesson, date, reason: 'NON_SCHOOL_DAY' });
    }
    return { date, lessons: [] };
  });
  return { days, discarded };
}

function isRecorded(lesson: RecordFlags): boolean {
  return lesson.contentRecorded || lesson.attendanceRecorded;
}

/** Horário da escola; aula antiga sem referência usa as próprias horas. */
function slotKey(lesson: PlannedLesson): string {
  return lesson.lessonSlotId ?? `${lesson.startTime}-${lesson.endTime}`;
}

function sameSlot(a: PlannedLesson, b: PlannedLesson): boolean {
  return a.subjectId === b.subjectId && slotKey(a) === slotKey(b);
}

function toFlagged(lesson: PlannedLesson, flags: RecordFlags): FlaggedLesson {
  return {
    lessonSlotId: lesson.lessonSlotId,
    subjectId: lesson.subjectId,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    contentRecorded: flags.contentRecorded,
    attendanceRecorded: flags.attendanceRecorded,
  };
}

const NO_RECORDS: RecordFlags = {
  contentRecorded: false,
  attendanceRecorded: false,
};

function mergeDay(
  day: PlannedDay,
  kept: readonly DatedLesson[],
  discarded: DiscardedLesson[],
): FlaggedDay {
  const lessons = kept.map((lesson) => toFlagged(lesson, lesson));
  for (const lesson of day.lessons) {
    if (kept.some((k) => sameSlot(k, lesson))) continue;
    if (kept.some((k) => overlaps(k, lesson))) {
      discarded.push({
        ...lesson,
        date: day.date,
        reason: 'RECORDED_CONFLICT',
      });
      continue;
    }
    lessons.push(toFlagged(lesson, NO_RECORDS));
  }
  return { date: day.date, lessons: byStartTime(lessons) };
}

/** Sobrescreve a semana alvo mantendo as aulas já registradas. */
export function mergeWithRecorded(
  replicated: readonly PlannedDay[],
  existing: readonly DatedLesson[],
): {
  days: FlaggedDay[];
  preserved: DatedLesson[];
  discarded: DiscardedLesson[];
} {
  const preserved = existing.filter(isRecorded);
  const discarded: DiscardedLesson[] = [];
  const days = replicated.map((day) =>
    mergeDay(
      day,
      preserved.filter((p) => p.date === day.date),
      discarded,
    ),
  );
  return { days, preserved, discarded };
}

function lessonKey(date: string, lesson: PlannedLesson): string {
  return [date, slotKey(lesson), lesson.subjectId].join('|');
}

function assertRecordsKept(
  existing: readonly DatedLesson[],
  plannedKeys: ReadonlySet<string>,
): void {
  const lost = existing.find(
    (lesson) =>
      isRecorded(lesson) && !plannedKeys.has(lessonKey(lesson.date, lesson)),
  );
  if (!lost) return;
  throw new ConflictException({
    code: ERROR_CODES.SCHEDULE_HAS_RECORDS,
    message: `A aula de ${lost.date} às ${lost.startTime} tem registro e não pode ser alterada ou removida.`,
  });
}

/** Aula idêntica herda as flags; aula registrada não pode sumir. */
export function carryLessonRecords(
  existing: readonly DatedLesson[],
  planned: readonly PlannedDay[],
): FlaggedDay[] {
  const flagsByKey = new Map(
    existing.map((lesson) => [lessonKey(lesson.date, lesson), lesson]),
  );
  const plannedKeys = new Set(
    planned.flatMap((day) => day.lessons.map((l) => lessonKey(day.date, l))),
  );
  assertRecordsKept(existing, plannedKeys);
  return planned.map((day) => ({
    date: day.date,
    lessons: day.lessons.map((lesson) =>
      toFlagged(
        lesson,
        flagsByKey.get(lessonKey(day.date, lesson)) ?? NO_RECORDS,
      ),
    ),
  }));
}
