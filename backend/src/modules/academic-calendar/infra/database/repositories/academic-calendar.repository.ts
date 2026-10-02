import { randomUUID } from 'node:crypto';
import type {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../../../../@core/application/adapters/database-connection.interface';
import type {
  DatePeriod,
  DayType,
  DayTypeCount,
  GeneratedDay,
} from '../../../academic-calendar.rules';
import type {
  AcademicCalendarListFilter,
  AcademicCalendarRecord,
  CalendarDayRecord,
  CreateAcademicCalendarInput,
  IAcademicCalendarRepository,
  UpdateAcademicCalendarInput,
  UpdateCalendarDayInput,
} from '../../../application/interface/repository/academic-calendar.repository.interface';
import {
  ACADEMIC_CALENDAR_COLUMNS,
  ACADEMIC_CALENDAR_FROM,
  buildAcademicCalendarListQuery,
} from '../queries/academic-calendar-list.query';

const FIND_SQL = `
  SELECT ${ACADEMIC_CALENDAR_COLUMNS}
    FROM ${ACADEMIC_CALENDAR_FROM}
   WHERE c.tenant_id = ? AND c.id = ? AND c.deleted_at IS NULL
   LIMIT 1`;

/** Vínculos de vários calendários de uma vez, só com escolas não excluídas. */
const LINKS_SQL = `
  SELECT acs.calendar_id, acs.school_id
    FROM academic_calendar_school acs
    JOIN academic_calendar c ON c.id = acs.calendar_id
    JOIN school s ON s.id = acs.school_id
   WHERE c.tenant_id = ? AND s.tenant_id = c.tenant_id
     AND s.deleted_at IS NULL AND acs.calendar_id IN (?)
   ORDER BY acs.school_id ASC`;

const EXISTING_SCHOOLS_SQL = `
  SELECT s.id
    FROM school s
   WHERE s.tenant_id = ? AND s.id IN (?) AND s.deleted_at IS NULL
   ORDER BY s.id ASC`;

const INSERT_SQL = `
  INSERT INTO academic_calendar (
    id, tenant_id, school_year, name, start_date, end_date, all_schools, created_by_id, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`;

const INSERT_LINKS_SQL =
  'INSERT INTO academic_calendar_school (calendar_id, school_id) VALUES ?';

const INSERT_DAYS_SQL = `
  INSERT INTO academic_calendar_day
    (id, tenant_id, calendar_id, day_date, day_type, updated_at)
  VALUES ?`;

/** Sempre restrito ao tenant pelo join com `academic_calendar`. */
const DELETE_LINKS_SQL = `
  DELETE acs FROM academic_calendar_school acs
    JOIN academic_calendar c ON c.id = acs.calendar_id
   WHERE c.tenant_id = ? AND acs.calendar_id = ?`;

const SOFT_DELETE_SQL = `
  UPDATE academic_calendar
     SET deleted_at = NOW(3), deleted_by_id = ?, updated_at = NOW(3)
   WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`;

/** Dia de calendário não excluído do tenant. */
const DAY_FROM = `
    FROM academic_calendar_day d
    JOIN academic_calendar c
      ON c.id = d.calendar_id AND c.tenant_id = d.tenant_id AND c.deleted_at IS NULL
   WHERE d.tenant_id = ? AND d.calendar_id = ?`;

const DAY_COLUMNS =
  "DATE_FORMAT(d.day_date, '%Y-%m-%d') AS `date`, d.day_type, d.description, d.updated_at";

const LIST_DAYS_SQL = `
  SELECT ${DAY_COLUMNS}${DAY_FROM}
     AND d.day_date BETWEEN ? AND ?
   ORDER BY d.day_date ASC`;

const FIND_DAY_SQL = `
  SELECT ${DAY_COLUMNS}${DAY_FROM}
     AND d.day_date = ?
   LIMIT 1`;

const COUNT_DAYS_SQL = `
  SELECT d.day_type, COUNT(*) AS total${DAY_FROM}
   GROUP BY d.day_type`;

/** Allow-list campo do input → coluna gravável no UPDATE do calendário. */
const CALENDAR_COLUMNS = {
  name: 'name',
  allSchools: 'all_schools',
} as const;

/** Allow-list campo do input → coluna gravável no UPDATE do dia. */
const DAY_UPDATABLE_COLUMNS = {
  type: 'day_type',
  description: 'description',
} as const;

interface CalendarRow {
  id: string;
  tenant_id: string;
  school_year: number;
  name: string;
  start_date: string;
  end_date: string;
  all_schools: number | boolean;
  created_at: Date;
  updated_at: Date;
}

interface LinkRow {
  calendar_id: string;
  school_id: string;
}

interface DayRow {
  date: string;
  day_type: DayType;
  description: string | null;
  updated_at: Date;
}

interface CountRow {
  day_type: DayType;
  total: number | string;
}

function toRecord(
  row: CalendarRow,
  links: ReadonlyMap<string, string[]>,
): AcademicCalendarRecord {
  const allSchools = Number(row.all_schools) === 1;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    year: Number(row.school_year),
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    allSchools,
    schoolIds: allSchools ? [] : (links.get(row.id) ?? []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDay(row: DayRow): CalendarDayRecord {
  return {
    date: row.date,
    type: row.day_type,
    description: row.description,
    updatedAt: row.updated_at,
  };
}

function groupLinks(rows: readonly LinkRow[]): Map<string, string[]> {
  const links = new Map<string, string[]>();
  for (const { calendar_id, school_id } of rows) {
    const list = links.get(calendar_id) ?? [];
    list.push(school_id);
    links.set(calendar_id, list);
  }
  return links;
}

/** SET só com os campos definidos (`null` grava NULL), mais a auditoria. */
function buildSet(
  columns: Record<string, string>,
  input: Record<string, unknown> & { updatedById: string },
): { sql: string; params: unknown[] } {
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const [field, column] of Object.entries(columns)) {
    const value = input[field];
    if (value === undefined) continue;
    assignments.push(`${column} = ?`);
    params.push(value);
  }
  assignments.push('updated_by_id = ?', 'updated_at = NOW(3)');
  params.push(input.updatedById);
  return { sql: assignments.join(', '), params };
}

function linkValues(calendarId: string, schoolIds: readonly string[]) {
  return schoolIds.map((schoolId) => [calendarId, schoolId]);
}

function dayValues(
  tenantId: string,
  calendarId: string,
  days: readonly GeneratedDay[],
) {
  const now = new Date();
  return days.map((day) => [
    randomUUID(),
    tenantId,
    calendarId,
    day.date,
    day.type,
    now,
  ]);
}

/**
 * `IAcademicCalendarRepository` em SQL; todo acesso filtra `tenant_id`
 * (direto ou pelo join com `academic_calendar`) e nenhuma query roda em laço.
 */
export class AcademicCalendarRepository implements IAcademicCalendarRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async list(
    filter: AcademicCalendarListFilter,
  ): Promise<{ data: AcademicCalendarRecord[]; total: number }> {
    const { page, count } = buildAcademicCalendarListQuery(filter);
    const [rows, counted] = await Promise.all([
      this.db.query<CalendarRow>(page.sql, page.params),
      this.db.queryOne<{ total: number | string }>(count.sql, count.params),
    ]);
    const data = await this.withLinks(this.db, filter.tenantId, rows);
    return { data, total: Number(counted?.total ?? 0) };
  }

  findById(
    tenantId: string,
    id: string,
  ): Promise<AcademicCalendarRecord | null> {
    return this.findWith(this.db, tenantId, id);
  }

  async findExistingSchoolIds(
    tenantId: string,
    schoolIds: readonly string[],
  ): Promise<string[]> {
    if (schoolIds.length === 0) return [];
    const rows = await this.db.query<{ id: string }>(EXISTING_SCHOOLS_SQL, [
      tenantId,
      [...schoolIds],
    ]);
    return rows.map((row) => row.id);
  }

  create(input: CreateAcademicCalendarInput): Promise<AcademicCalendarRecord> {
    const id = randomUUID();
    return this.db.runInTransaction(async (tx) => {
      await tx.insert(INSERT_SQL, [
        id,
        input.tenantId,
        input.year,
        input.name,
        input.startDate,
        input.endDate,
        input.allSchools,
        input.createdById,
      ]);
      if (!input.allSchools) {
        await this.insertLinks(tx, id, input.schoolIds);
      }
      if (input.days.length > 0) {
        await tx.insert(INSERT_DAYS_SQL, [
          dayValues(input.tenantId, id, input.days),
        ]);
      }
      return this.findOrThrow(tx, input.tenantId, id);
    });
  }

  update(
    tenantId: string,
    id: string,
    input: UpdateAcademicCalendarInput,
  ): Promise<AcademicCalendarRecord> {
    const set = buildSet(CALENDAR_COLUMNS, { ...input });
    return this.db.runInTransaction(async (tx) => {
      await tx.update(
        `UPDATE academic_calendar SET ${set.sql} WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`,
        [...set.params, tenantId, id],
      );
      if (input.schoolIds !== undefined) {
        await tx.delete(DELETE_LINKS_SQL, [tenantId, id]);
        await this.insertLinks(tx, id, input.schoolIds);
      }
      return this.findOrThrow(tx, tenantId, id);
    });
  }

  async softDelete(
    tenantId: string,
    id: string,
    deletedById: string,
  ): Promise<void> {
    await this.db.update(SOFT_DELETE_SQL, [deletedById, tenantId, id]);
  }

  async listDays(
    tenantId: string,
    calendarId: string,
    period: DatePeriod,
  ): Promise<CalendarDayRecord[]> {
    const rows = await this.db.query<DayRow>(LIST_DAYS_SQL, [
      tenantId,
      calendarId,
      period.startDate,
      period.endDate,
    ]);
    return rows.map(toDay);
  }

  findDay(
    tenantId: string,
    calendarId: string,
    date: string,
  ): Promise<CalendarDayRecord | null> {
    return this.findDayWith(this.db, tenantId, calendarId, date);
  }

  updateDay(
    tenantId: string,
    calendarId: string,
    date: string,
    input: UpdateCalendarDayInput,
  ): Promise<CalendarDayRecord> {
    const set = buildSet(DAY_UPDATABLE_COLUMNS, { ...input });
    return this.db.runInTransaction(async (tx) => {
      await tx.update(
        `UPDATE academic_calendar_day SET ${set.sql} WHERE tenant_id = ? AND calendar_id = ? AND day_date = ?`,
        [...set.params, tenantId, calendarId, date],
      );
      const day = await this.findDayWith(tx, tenantId, calendarId, date);
      if (!day) {
        throw new Error(
          `Dia ${date} do calendário ${calendarId} não encontrado após gravação.`,
        );
      }
      return day;
    });
  }

  async countDaysByType(
    tenantId: string,
    calendarId: string,
  ): Promise<DayTypeCount[]> {
    const rows = await this.db.query<CountRow>(COUNT_DAYS_SQL, [
      tenantId,
      calendarId,
    ]);
    return rows.map((row) => ({
      type: row.day_type,
      total: Number(row.total),
    }));
  }

  private async insertLinks(
    tx: ITransactionalConnection,
    calendarId: string,
    schoolIds: readonly string[],
  ): Promise<void> {
    if (schoolIds.length === 0) return;
    await tx.insert(INSERT_LINKS_SQL, [linkValues(calendarId, schoolIds)]);
  }

  /** Uma só query `IN (?)` para os vínculos de todos os calendários. */
  private async withLinks(
    conn: ITransactionalConnection,
    tenantId: string,
    rows: readonly CalendarRow[],
  ): Promise<AcademicCalendarRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const links = await conn.query<LinkRow>(LINKS_SQL, [tenantId, ids]);
    const grouped = groupLinks(links);
    return rows.map((row) => toRecord(row, grouped));
  }

  private async findWith(
    conn: ITransactionalConnection,
    tenantId: string,
    id: string,
  ): Promise<AcademicCalendarRecord | null> {
    const row = await conn.queryOne<CalendarRow>(FIND_SQL, [tenantId, id]);
    if (!row) return null;
    const [record] = await this.withLinks(conn, tenantId, [row]);
    return record;
  }

  private async findOrThrow(
    conn: ITransactionalConnection,
    tenantId: string,
    id: string,
  ): Promise<AcademicCalendarRecord> {
    const calendar = await this.findWith(conn, tenantId, id);
    if (!calendar) {
      throw new Error(`Calendário ${id} não encontrado após gravação.`);
    }
    return calendar;
  }

  private async findDayWith(
    conn: ITransactionalConnection,
    tenantId: string,
    calendarId: string,
    date: string,
  ): Promise<CalendarDayRecord | null> {
    const row = await conn.queryOne<DayRow>(FIND_DAY_SQL, [
      tenantId,
      calendarId,
      date,
    ]);
    return row ? toDay(row) : null;
  }
}
