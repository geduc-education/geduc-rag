import type { DayType } from '../../../../academic-calendar/academic-calendar.rules';
import type {
  CalendarDayCandidate,
  FlaggedLesson,
  ScheduleStatus,
  SlotTimes,
} from '../../../weekly-schedule.rules';

export const WEEKLY_SCHEDULE_REPOSITORY = 'IWeeklyScheduleRepository';

/** Turma não excluída, com o que o horário precisa para validar a semana. */
export interface ScheduleClassRecord {
  id: string;
  schoolId: string;
  schoolYear: number;
}

/**
 * Aula do horário; horas em `HH:mm`, as do horário da escola quando houver
 * (`lessonSlotId`/`slotName` `null` só em aula anterior aos horários).
 */
export interface WeeklyScheduleLessonRecord {
  id: string;
  lessonSlotId: string | null;
  slotName: string | null;
  subjectId: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  contentRecorded: boolean;
  attendanceRecorded: boolean;
  updatedAt: Date;
}

/** Dia do horário com o instantâneo do calendário; aulas por `startTime`. */
export interface WeeklyScheduleDayRecord {
  date: string;
  calendarId: string | null;
  dayType: DayType | null;
  lessons: WeeklyScheduleLessonRecord[];
}

/** Horário sem os dias; `status` e contagens calculados em SQL. */
export interface WeeklyScheduleSummaryRecord {
  id: string;
  tenantId: string;
  schoolClassId: string;
  startDate: string;
  endDate: string;
  status: ScheduleStatus;
  lessonCount: number;
  contentRecordedCount: number;
  attendanceRecordedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Horário completo; dias por data crescente. */
export interface WeeklyScheduleRecord extends WeeklyScheduleSummaryRecord {
  days: WeeklyScheduleDayRecord[];
}

/** `from`/`to`: a semana do horário cruza o intervalo informado. */
export interface WeeklyScheduleListFilter {
  tenantId: string;
  schoolClassId?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface ScheduleDayInput {
  date: string;
  calendarId: string | null;
  dayType: DayType | null;
  lessons: FlaggedLesson[];
}

export interface NewWeekInput {
  schoolClassId: string;
  startDate: string;
  endDate: string;
  days: ScheduleDayInput[];
}

/** Substitui todos os dias (e aulas) do horário `id`. */
export interface ReplaceWeekInput {
  id: string;
  days: ScheduleDayInput[];
}

export interface SaveWeeksInput {
  tenantId: string;
  actorId: string;
  creates: readonly NewWeekInput[];
  replaces: readonly ReplaceWeekInput[];
}

/** Na ordem dos inputs. */
export interface SaveWeeksResult {
  created: WeeklyScheduleRecord[];
  replaced: WeeklyScheduleRecord[];
}

/** `undefined` = não altera. */
export interface UpdateLessonRecordInput {
  contentRecorded?: boolean;
  attendanceRecorded?: boolean;
  updatedById: string;
}

/**
 * Horários semanais de turma. Todo método recebe `tenantId` e só enxerga o
 * próprio tenant; leituras ignoram horário excluído. Nenhuma query em laço.
 */
export interface IWeeklyScheduleRepository {
  /** Turma não excluída. */
  findClass(
    tenantId: string,
    schoolClassId: string,
  ): Promise<ScheduleClassRecord | null>;
  /** Disciplinas não excluídas; lista vazia → `[]` sem SQL. */
  findExistingSubjectIds(
    tenantId: string,
    subjectIds: readonly string[],
  ): Promise<string[]>;
  /** Horários não excluídos da escola entre os ids; lista vazia → `[]` sem SQL. */
  findLessonSlots(
    tenantId: string,
    schoolId: string,
    ids: readonly string[],
  ): Promise<SlotTimes[]>;
  /** Calendários gerais ou da escola com dia nas datas; lista vazia → `[]` sem SQL. */
  findCalendarCandidates(
    tenantId: string,
    schoolId: string,
    dates: readonly string[],
  ): Promise<CalendarDayCandidate[]>;
  /** Horários não excluídos da turma nas semanas; lista vazia → `[]` sem SQL. */
  findByWeeks(
    tenantId: string,
    schoolClassId: string,
    startDates: readonly string[],
  ): Promise<WeeklyScheduleRecord[]>;
  /** Ordenado por semana (desc) e id. */
  list(
    filter: WeeklyScheduleListFilter,
  ): Promise<{ data: WeeklyScheduleSummaryRecord[]; total: number }>;
  findById(tenantId: string, id: string): Promise<WeeklyScheduleRecord | null>;
  /** Uma transação, número fixo de comandos independente das semanas. */
  saveWeeks(input: SaveWeeksInput): Promise<SaveWeeksResult>;
  softDelete(tenantId: string, id: string, deletedById: string): Promise<void>;
  /** `null` quando a aula não pertence a horário não excluído do tenant. */
  updateLessonRecord(
    tenantId: string,
    scheduleId: string,
    lessonId: string,
    input: UpdateLessonRecordInput,
  ): Promise<WeeklyScheduleLessonRecord | null>;
}
