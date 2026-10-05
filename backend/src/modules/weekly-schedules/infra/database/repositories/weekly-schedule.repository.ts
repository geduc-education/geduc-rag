import { randomUUID } from 'node:crypto';
import type {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../../../../@core/application/adapters/database-connection.interface';
import type { DayType } from '../../../../academic-calendar/academic-calendar.rules';
import type {
  IWeeklyScheduleRepository,
  NewWeekInput,
  ReplaceWeekInput,
  SaveWeeksInput,
  SaveWeeksResult,
  ScheduleClassRecord,
  ScheduleDayInput,
  UpdateLessonRecordInput,
  WeeklyScheduleDayRecord,
  WeeklyScheduleLessonRecord,
  WeeklyScheduleListFilter,
  WeeklyScheduleRecord,
  WeeklyScheduleSummaryRecord,
} from '../../../application/interface/repository/weekly-schedule.repository.interface';
import type {
  CalendarDayCandidate,
  ScheduleStatus,
  SlotTimes,
} from '../../../weekly-schedule.rules';
import {
  buildWeeklyScheduleListQuery,
  WEEKLY_SCHEDULE_COLUMNS,
  WEEKLY_SCHEDULE_FROM,
} from '../queries/weekly-schedule-list.query';

const FIND_CLASS_SQL = `
  SELECT sc.id, sc.school_id, sc.school_year
    FROM school_class sc
   WHERE sc.tenant_id = ? AND sc.id = ? AND sc.deleted_at IS NULL
   LIMIT 1`;

const EXISTING_SUBJECTS_SQL = `
  SELECT sub.id
    FROM subject sub
   WHERE sub.tenant_id = ? AND sub.id IN (?) AND sub.deleted_at IS NULL
   ORDER BY sub.id ASC`;

const LESSON_SLOTS_SQL = `
  SELECT ls.id,
         TIME_FORMAT(ls.start_time, '%H:%i') AS start_time,
         TIME_FORMAT(ls.end_time, '%H:%i') AS end_time
    FROM school_lesson_slot ls
   WHERE ls.tenant_id = ? AND ls.school_id = ? AND ls.id IN (?)
     AND ls.deleted_at IS NULL
   ORDER BY ls.id ASC`;

/** Dias de calendários não excluídos, gerais ou vinculados à escola. */
const CALENDAR_CANDIDATES_SQL = `
  SELECT DATE_FORMAT(d.day_date, '%Y-%m-%d') AS \`date\`, d.calendar_id, d.day_type,
         (acs.school_id IS NOT NULL) AS is_specific
    FROM academic_calendar_day d
    JOIN academic_calendar c
      ON c.id = d.calendar_id AND c.tenant_id = d.tenant_id AND c.deleted_at IS NULL
    LEFT JOIN academic_calendar_school acs
      ON acs.calendar_id = c.id AND acs.school_id = ?
   WHERE d.tenant_id = ? AND (c.all_schools = 1 OR acs.school_id IS NOT NULL)
     AND d.day_date IN (?)
   ORDER BY d.day_date ASC, d.calendar_id ASC`;

const SCHEDULE_SELECT = `
  SELECT ${WEEKLY_SCHEDULE_COLUMNS}
    FROM ${WEEKLY_SCHEDULE_FROM}
   WHERE ws.tenant_id = ? AND ws.deleted_at IS NULL`;

const FIND_SQL = `${SCHEDULE_SELECT} AND ws.id = ? LIMIT 1`;

const FIND_BY_IDS_SQL = `${SCHEDULE_SELECT} AND ws.id IN (?)`;

const FIND_BY_WEEKS_SQL = `${SCHEDULE_SELECT}
     AND ws.school_class_id = ? AND ws.start_date IN (?)
   ORDER BY ws.start_date ASC, ws.id ASC`;

const DAYS_SQL = `
  SELECT wd.id, wd.schedule_id, DATE_FORMAT(wd.day_date, '%Y-%m-%d') AS day_date,
         wd.calendar_id, wd.day_type
    FROM weekly_schedule_day wd
   WHERE wd.tenant_id = ? AND wd.schedule_id IN (?)
   ORDER BY wd.day_date ASC`;

/**
 * As horas vêm do horário da escola (reflete mudanças dela); a cópia gravada
 * na aula só vale para aula sem horário. O horário excluído segue legível.
 */
const LESSON_COLUMNS = `l.id, l.schedule_day_id, l.lesson_slot_id, ls.name AS slot_name,
         l.subject_id, sub.name AS subject_name,
         TIME_FORMAT(COALESCE(ls.start_time, l.start_time), '%H:%i') AS start_time,
         TIME_FORMAT(COALESCE(ls.end_time, l.end_time), '%H:%i') AS end_time,
         l.content_recorded, l.attendance_recorded, l.updated_at`;

const LESSON_SLOT_JOIN = `LEFT JOIN school_lesson_slot ls
      ON ls.id = l.lesson_slot_id AND ls.tenant_id = l.tenant_id`;

const LESSONS_SQL = `
  SELECT ${LESSON_COLUMNS}
    FROM weekly_schedule_lesson l
    JOIN weekly_schedule_day wd ON wd.id = l.schedule_day_id
    JOIN subject sub ON sub.id = l.subject_id
    ${LESSON_SLOT_JOIN}
   WHERE l.tenant_id = ? AND wd.schedule_id IN (?)
   ORDER BY COALESCE(ls.start_time, l.start_time) ASC, l.id ASC`;

/** Aula de horário não excluído do tenant. */
const LESSON_SCOPE = `
    FROM weekly_schedule_lesson l
    JOIN weekly_schedule_day wd ON wd.id = l.schedule_day_id
    JOIN weekly_schedule ws ON ws.id = wd.schedule_id
    JOIN subject sub ON sub.id = l.subject_id
    ${LESSON_SLOT_JOIN}
   WHERE l.tenant_id = ? AND ws.tenant_id = l.tenant_id AND ws.id = ? AND l.id = ?
     AND ws.deleted_at IS NULL`;

const FIND_LESSON_SQL = `SELECT ${LESSON_COLUMNS}${LESSON_SCOPE} LIMIT 1`;

const INSERT_SCHEDULES_SQL = `
  INSERT INTO weekly_schedule (
    id, tenant_id, school_class_id, start_date, end_date, created_by_id, updated_at
  ) VALUES ?`;

const TOUCH_SCHEDULES_SQL = `
  UPDATE weekly_schedule SET updated_at = NOW(3), updated_by_id = ?
   WHERE tenant_id = ? AND id IN (?) AND deleted_at IS NULL`;

/** Aulas caem por CASCADE. */
const DELETE_DAYS_SQL = `
  DELETE FROM weekly_schedule_day WHERE tenant_id = ? AND schedule_id IN (?)`;

const INSERT_DAYS_SQL = `
  INSERT INTO weekly_schedule_day (
    id, tenant_id, schedule_id, day_date, calendar_id, day_type, updated_at
  ) VALUES ?`;

const INSERT_LESSONS_SQL = `
  INSERT INTO weekly_schedule_lesson (
    id, tenant_id, schedule_day_id, lesson_slot_id, subject_id, start_time, end_time,
    content_recorded, attendance_recorded, updated_at
  ) VALUES ?`;

const SOFT_DELETE_SQL = `
  UPDATE weekly_schedule
     SET deleted_at = NOW(3), deleted_by_id = ?, updated_at = NOW(3)
   WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`;

/** Allow-list campo do input → coluna gravável da aula. */
const LESSON_FLAG_COLUMNS = {
  contentRecorded: 'l.content_recorded',
  attendanceRecorded: 'l.attendance_recorded',
} as const;

interface ClassRow {
  id: string;
  school_id: string;
  school_year: number | string;
}

interface CandidateRow {
  date: string;
  calendar_id: string;
  day_type: DayType;
  is_specific: number | string | boolean;
}

interface ScheduleRow {
  id: string;
  tenant_id: string;
  school_class_id: string;
  start_date: string;
  end_date: string;
  status: ScheduleStatus;
  lesson_count: number | string;
  content_recorded_count: number | string | null;
  attendance_recorded_count: number | string | null;
  created_at: Date;
  updated_at: Date;
}

interface DayRow {
  id: string;
  schedule_id: string;
  day_date: string;
  calendar_id: string | null;
  day_type: DayType | null;
}

interface LessonRow {
  id: string;
  schedule_day_id: string;
  lesson_slot_id: string | null;
  slot_name: string | null;
  subject_id: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  content_recorded: number | boolean;
  attendance_recorded: number | boolean;
  updated_at: Date;
}

/** Linha de dia a gravar, com o id do horário já resolvido. */
interface DayToWrite {
  scheduleId: string;
  day: ScheduleDayInput;
}

function toSummary(row: ScheduleRow): WeeklyScheduleSummaryRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    schoolClassId: row.school_class_id,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    lessonCount: Number(row.lesson_count ?? 0),
    contentRecordedCount: Number(row.content_recorded_count ?? 0),
    attendanceRecordedCount: Number(row.attendance_recorded_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toLesson(row: LessonRow): WeeklyScheduleLessonRecord {
  return {
    id: row.id,
    lessonSlotId: row.lesson_slot_id,
    slotName: row.slot_name,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    startTime: row.start_time,
    endTime: row.end_time,
    contentRecorded: Number(row.content_recorded) === 1,
    attendanceRecorded: Number(row.attendance_recorded) === 1,
    updatedAt: row.updated_at,
  };
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(key(row)) ?? [];
    list.push(row);
    groups.set(key(row), list);
  }
  return groups;
}

function toDay(
  row: DayRow,
  lessons: ReadonlyMap<string, LessonRow[]>,
): WeeklyScheduleDayRecord {
  return {
    date: row.day_date,
    calendarId: row.calendar_id,
    dayType: row.day_type,
    lessons: (lessons.get(row.id) ?? []).map(toLesson),
  };
}

function scheduleValues(
  tenantId: string,
  actorId: string,
  weeks: readonly { id: string; week: NewWeekInput }[],
) {
  const now = new Date();
  return weeks.map(({ id, week }) => [
    id,
    tenantId,
    week.schoolClassId,
    week.startDate,
    week.endDate,
    actorId,
    now,
  ]);
}

/** Valores de `weekly_schedule_day` e `weekly_schedule_lesson` em lote. */
function dayAndLessonValues(tenantId: string, days: readonly DayToWrite[]) {
  const now = new Date();
  const dayRows: unknown[][] = [];
  const lessonRows: unknown[][] = [];
  for (const { scheduleId, day } of days) {
    const dayId = randomUUID();
    dayRows.push([
      dayId,
      tenantId,
      scheduleId,
      day.date,
      day.calendarId,
      day.dayType,
      now,
    ]);
    for (const lesson of day.lessons) {
      lessonRows.push([
        randomUUID(),
        tenantId,
        dayId,
        lesson.lessonSlotId,
        lesson.subjectId,
        lesson.startTime,
        lesson.endTime,
        lesson.contentRecorded,
        lesson.attendanceRecorded,
        now,
      ]);
    }
  }
  return { dayRows, lessonRows };
}

function daysToWrite(
  created: readonly { id: string; week: NewWeekInput }[],
  replaces: readonly ReplaceWeekInput[],
): DayToWrite[] {
  const weeks = [
    ...created.map(({ id, week }) => ({ id, days: week.days })),
    ...replaces,
  ];
  return weeks.flatMap(({ id, days }) =>
    days.map((day) => ({ scheduleId: id, day })),
  );
}

/** SET só com as flags definidas, mais a auditoria. */
function buildLessonSet(input: UpdateLessonRecordInput) {
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const [field, column] of Object.entries(LESSON_FLAG_COLUMNS)) {
    const value = input[field as keyof typeof LESSON_FLAG_COLUMNS];
    if (value === undefined) continue;
    assignments.push(`${column} = ?`);
    params.push(value);
  }
  assignments.push('l.updated_by_id = ?', 'l.updated_at = NOW(3)');
  params.push(input.updatedById);
  return { sql: assignments.join(', '), params };
}

function pickInOrder(
  records: ReadonlyMap<string, WeeklyScheduleRecord>,
  ids: readonly string[],
): WeeklyScheduleRecord[] {
  return ids.map((id) => {
    const record = records.get(id);
    if (!record) {
      throw new Error(`Horário ${id} não encontrado após gravação.`);
    }
    return record;
  });
}

/**
 * `IWeeklyScheduleRepository` em SQL; todo acesso filtra `tenant_id` e
 * nenhuma query roda em laço (dias e aulas vêm em lote por `IN (?)`).
 */
export class WeeklyScheduleRepository implements IWeeklyScheduleRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async findClass(
    tenantId: string,
    schoolClassId: string,
  ): Promise<ScheduleClassRecord | null> {
    const row = await this.db.queryOne<ClassRow>(FIND_CLASS_SQL, [
      tenantId,
      schoolClassId,
    ]);
    if (!row) return null;
    return {
      id: row.id,
      schoolId: row.school_id,
      schoolYear: Number(row.school_year),
    };
  }

  async findExistingSubjectIds(
    tenantId: string,
    subjectIds: readonly string[],
  ): Promise<string[]> {
    if (subjectIds.length === 0) return [];
    const rows = await this.db.query<{ id: string }>(EXISTING_SUBJECTS_SQL, [
      tenantId,
      [...subjectIds],
    ]);
    return rows.map((row) => row.id);
  }

  async findLessonSlots(
    tenantId: string,
    schoolId: string,
    ids: readonly string[],
  ): Promise<SlotTimes[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.query<{
      id: string;
      start_time: string;
      end_time: string;
    }>(LESSON_SLOTS_SQL, [tenantId, schoolId, [...ids]]);
    return rows.map((row) => ({
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
    }));
  }

  async findCalendarCandidates(
    tenantId: string,
    schoolId: string,
    dates: readonly string[],
  ): Promise<CalendarDayCandidate[]> {
    if (dates.length === 0) return [];
    const rows = await this.db.query<CandidateRow>(CALENDAR_CANDIDATES_SQL, [
      schoolId,
      tenantId,
      [...dates],
    ]);
    return rows.map((row) => ({
      date: row.date,
      calendarId: row.calendar_id,
      type: row.day_type,
      specific: Number(row.is_specific) === 1,
    }));
  }

  async findByWeeks(
    tenantId: string,
    schoolClassId: string,
    startDates: readonly string[],
  ): Promise<WeeklyScheduleRecord[]> {
    if (startDates.length === 0) return [];
    const rows = await this.db.query<ScheduleRow>(FIND_BY_WEEKS_SQL, [
      tenantId,
      schoolClassId,
      [...startDates],
    ]);
    return this.withDays(this.db, tenantId, rows);
  }

  async list(
    filter: WeeklyScheduleListFilter,
  ): Promise<{ data: WeeklyScheduleSummaryRecord[]; total: number }> {
    const { page, count } = buildWeeklyScheduleListQuery(filter);
    const [rows, counted] = await Promise.all([
      this.db.query<ScheduleRow>(page.sql, page.params),
      this.db.queryOne<{ total: number | string }>(count.sql, count.params),
    ]);
    return { data: rows.map(toSummary), total: Number(counted?.total ?? 0) };
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<WeeklyScheduleRecord | null> {
    const row = await this.db.queryOne<ScheduleRow>(FIND_SQL, [tenantId, id]);
    if (!row) return null;
    const [record] = await this.withDays(this.db, tenantId, [row]);
    return record;
  }

  saveWeeks(input: SaveWeeksInput): Promise<SaveWeeksResult> {
    const created = input.creates.map((week) => ({ id: randomUUID(), week }));
    const replacedIds = input.replaces.map((week) => week.id);
    return this.db.runInTransaction(async (tx) => {
      if (created.length > 0) {
        await tx.insert(INSERT_SCHEDULES_SQL, [
          scheduleValues(input.tenantId, input.actorId, created),
        ]);
      }
      if (replacedIds.length > 0) {
        await tx.update(TOUCH_SCHEDULES_SQL, [
          input.actorId,
          input.tenantId,
          replacedIds,
        ]);
        await tx.delete(DELETE_DAYS_SQL, [input.tenantId, replacedIds]);
      }
      await this.insertDays(
        tx,
        input.tenantId,
        daysToWrite(created, input.replaces),
      );
      const createdIds = created.map(({ id }) => id);
      const records = await this.findByIds(tx, input.tenantId, [
        ...createdIds,
        ...replacedIds,
      ]);
      return {
        created: pickInOrder(records, createdIds),
        replaced: pickInOrder(records, replacedIds),
      };
    });
  }

  async softDelete(
    tenantId: string,
    id: string,
    deletedById: string,
  ): Promise<void> {
    await this.db.update(SOFT_DELETE_SQL, [deletedById, tenantId, id]);
  }

  updateLessonRecord(
    tenantId: string,
    scheduleId: string,
    lessonId: string,
    input: UpdateLessonRecordInput,
  ): Promise<WeeklyScheduleLessonRecord | null> {
    const set = buildLessonSet(input);
    const scope = [tenantId, scheduleId, lessonId];
    return this.db.runInTransaction(async (tx) => {
      await tx.update(
        `UPDATE weekly_schedule_lesson l
           JOIN weekly_schedule_day wd ON wd.id = l.schedule_day_id
           JOIN weekly_schedule ws ON ws.id = wd.schedule_id
            SET ${set.sql}
          WHERE l.tenant_id = ? AND ws.tenant_id = l.tenant_id AND ws.id = ? AND l.id = ?
            AND ws.deleted_at IS NULL`,
        [...set.params, ...scope],
      );
      const row = await tx.queryOne<LessonRow>(FIND_LESSON_SQL, scope);
      return row ? toLesson(row) : null;
    });
  }

  private async insertDays(
    tx: ITransactionalConnection,
    tenantId: string,
    days: readonly DayToWrite[],
  ): Promise<void> {
    if (days.length === 0) return;
    const { dayRows, lessonRows } = dayAndLessonValues(tenantId, days);
    await tx.insert(INSERT_DAYS_SQL, [dayRows]);
    if (lessonRows.length > 0) {
      await tx.insert(INSERT_LESSONS_SQL, [lessonRows]);
    }
  }

  private async findByIds(
    conn: ITransactionalConnection,
    tenantId: string,
    ids: readonly string[],
  ): Promise<Map<string, WeeklyScheduleRecord>> {
    if (ids.length === 0) return new Map();
    const rows = await conn.query<ScheduleRow>(FIND_BY_IDS_SQL, [
      tenantId,
      [...ids],
    ]);
    const records = await this.withDays(conn, tenantId, rows);
    return new Map(records.map((record) => [record.id, record]));
  }

  /** Dias e aulas de todos os horários em duas queries `IN (?)`. */
  private async withDays(
    conn: ITransactionalConnection,
    tenantId: string,
    rows: readonly ScheduleRow[],
  ): Promise<WeeklyScheduleRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const dayRows = await conn.query<DayRow>(DAYS_SQL, [tenantId, ids]);
    const lessonRows = await conn.query<LessonRow>(LESSONS_SQL, [
      tenantId,
      ids,
    ]);
    const lessons = groupBy(lessonRows, (lesson) => lesson.schedule_day_id);
    const days = groupBy(dayRows, (day) => day.schedule_id);
    return rows.map((row) => ({
      ...toSummary(row),
      days: (days.get(row.id) ?? []).map((day) => toDay(day, lessons)),
    }));
  }
}
