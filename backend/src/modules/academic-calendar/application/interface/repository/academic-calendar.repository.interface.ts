import type {
  DatePeriod,
  DayType,
  DayTypeCount,
  GeneratedDay,
} from '../../../academic-calendar.rules';

export const ACADEMIC_CALENDAR_REPOSITORY = 'IAcademicCalendarRepository';

/**
 * Calendário (ano letivo) de um tenant. Datas em texto `YYYY-MM-DD`;
 * `schoolIds` só de escolas não excluídas, em ordem crescente, e `[]` quando
 * `allSchools`.
 */
export interface AcademicCalendarRecord {
  id: string;
  tenantId: string;
  year: number;
  name: string;
  startDate: string;
  endDate: string;
  allSchools: boolean;
  schoolIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarDayRecord {
  date: string;
  type: DayType;
  description: string | null;
  updatedAt: Date;
}

export interface AcademicCalendarListFilter {
  tenantId: string;
  year?: number;
  /** Casa calendário de todas as escolas ou vinculado à escola não excluída. */
  schoolId?: string;
  page: number;
  limit: number;
}

export interface CreateAcademicCalendarInput {
  tenantId: string;
  year: number;
  name: string;
  startDate: string;
  endDate: string;
  allSchools: boolean;
  schoolIds: string[];
  days: GeneratedDay[];
  createdById: string;
}

/** `undefined` = não altera; `schoolIds` definido substitui todos os vínculos. */
export interface UpdateAcademicCalendarInput {
  name?: string;
  allSchools?: boolean;
  schoolIds?: string[];
  updatedById: string;
}

/** `undefined` = não altera; `null` em `description` limpa o campo. */
export interface UpdateCalendarDayInput {
  type?: DayType;
  description?: string | null;
  updatedById: string;
}

/**
 * Calendários acadêmicos e seus dias. Todo método recebe `tenantId` e só
 * enxerga o próprio tenant; leituras ignoram calendário excluído.
 */
export interface IAcademicCalendarRepository {
  /** Ordenado por ano (desc), nome e id. */
  list(
    filter: AcademicCalendarListFilter,
  ): Promise<{ data: AcademicCalendarRecord[]; total: number }>;
  findById(
    tenantId: string,
    id: string,
  ): Promise<AcademicCalendarRecord | null>;
  /** Ids de escolas não excluídas do tenant; lista vazia → `[]` sem SQL. */
  findExistingSchoolIds(
    tenantId: string,
    schoolIds: readonly string[],
  ): Promise<string[]>;
  /** Calendário, vínculos e dias numa só transação. */
  create(input: CreateAcademicCalendarInput): Promise<AcademicCalendarRecord>;
  update(
    tenantId: string,
    id: string,
    input: UpdateAcademicCalendarInput,
  ): Promise<AcademicCalendarRecord>;
  softDelete(tenantId: string, id: string, deletedById: string): Promise<void>;
  /** Dias do período (inclusivo), em ordem de data. */
  listDays(
    tenantId: string,
    calendarId: string,
    period: DatePeriod,
  ): Promise<CalendarDayRecord[]>;
  findDay(
    tenantId: string,
    calendarId: string,
    date: string,
  ): Promise<CalendarDayRecord | null>;
  updateDay(
    tenantId: string,
    calendarId: string,
    date: string,
    input: UpdateCalendarDayInput,
  ): Promise<CalendarDayRecord>;
  /** Só os tipos presentes; ver `totalsFromCounts`. */
  countDaysByType(
    tenantId: string,
    calendarId: string,
  ): Promise<DayTypeCount[]>;
}
