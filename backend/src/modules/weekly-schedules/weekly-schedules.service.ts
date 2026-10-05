import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  weekdayOf,
  type DatePeriod,
} from '../academic-calendar/academic-calendar.rules';
import {
  WEEKLY_SCHEDULE_REPOSITORY,
  type IWeeklyScheduleRepository,
  type ScheduleClassRecord,
  type ScheduleDayInput,
  type SaveWeeksResult,
  type WeeklyScheduleDayRecord,
  type WeeklyScheduleLessonRecord,
  type WeeklyScheduleRecord,
  type WeeklyScheduleSummaryRecord,
} from './application/interface/repository/weekly-schedule.repository.interface';
import {
  CreateWeeklyScheduleDto,
  ListWeeklySchedulesDto,
  ReplicateWeeklyScheduleDto,
  ReplicationResponseDto,
  ReplicationResultDto,
  ScheduleDayResponseDto,
  ScheduleLessonResponseDto,
  UpdateLessonRecordDto,
  UpdateWeeklyScheduleDto,
  WeeklyScheduleListResponseDto,
  WeeklyScheduleResponseDto,
  WeeklyScheduleSummaryResponseDto,
} from './dto/weekly-schedule.dto';
import {
  assertDaysMatchCalendar,
  assertSaturdayLessons,
  assertScheduleWeek,
  attachSlotTimes,
  carryLessonRecords,
  listPeriodDates,
  mergeWithRecorded,
  normalizePlannedDays,
  replicateDays,
  resolveCalendarDays,
  weekPeriod,
  type CalendarDayCandidate,
  type DatedLesson,
  type DayInput,
  type DiscardedLesson,
  type FlaggedDay,
  type PlannedDay,
  type ResolvedCalendarDay,
} from './weekly-schedule.rules';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/** Semana alvo da replicação já resolvida, pronta para `saveWeeks`. */
interface ReplicationPlan {
  period: DatePeriod;
  existing: WeeklyScheduleRecord | undefined;
  days: ScheduleDayInput[];
  preserved: DatedLesson[];
  discarded: DiscardedLesson[];
}

function toSummary(
  record: WeeklyScheduleSummaryRecord,
): WeeklyScheduleSummaryResponseDto {
  return {
    id: record.id,
    schoolClassId: record.schoolClassId,
    startDate: record.startDate,
    endDate: record.endDate,
    status: record.status,
    record: {
      lessons: record.lessonCount,
      contentRecorded: record.contentRecordedCount,
      attendanceRecorded: record.attendanceRecordedCount,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toLesson(
  lesson: WeeklyScheduleLessonRecord,
): ScheduleLessonResponseDto {
  return {
    id: lesson.id,
    lessonSlotId: lesson.lessonSlotId,
    slotName: lesson.slotName,
    subjectId: lesson.subjectId,
    subjectName: lesson.subjectName,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    contentRecorded: lesson.contentRecorded,
    attendanceRecorded: lesson.attendanceRecorded,
  };
}

function toDay(day: WeeklyScheduleDayRecord): ScheduleDayResponseDto {
  return {
    date: day.date,
    weekday: weekdayOf(day.date),
    dayType: day.dayType,
    hasClass: day.dayType === 'SCHOOL_DAY',
    lessons: day.lessons.map(toLesson),
  };
}

function toResponse(record: WeeklyScheduleRecord): WeeklyScheduleResponseDto {
  return { ...toSummary(record), days: record.days.map(toDay) };
}

/** Aulas gravadas do horário, com a data e as flags de registro. */
function datedLessons(record: WeeklyScheduleRecord): DatedLesson[] {
  return record.days.flatMap((day) =>
    day.lessons.map((l) => ({
      date: day.date,
      lessonSlotId: l.lessonSlotId,
      subjectId: l.subjectId,
      startTime: l.startTime,
      endTime: l.endTime,
      contentRecorded: l.contentRecorded,
      attendanceRecorded: l.attendanceRecorded,
    })),
  );
}

/** Dias do horário gravado como planejamento (sem flags). */
function plannedFromRecord(record: WeeklyScheduleRecord): PlannedDay[] {
  return record.days.map((day) => ({
    date: day.date,
    lessons: day.lessons.map((l) => ({
      lessonSlotId: l.lessonSlotId,
      subjectId: l.subjectId,
      startTime: l.startTime,
      endTime: l.endTime,
    })),
  }));
}

function withoutRecords(days: readonly PlannedDay[]): FlaggedDay[] {
  return days.map((day) => ({
    date: day.date,
    lessons: day.lessons.map((l) => ({
      lessonSlotId: l.lessonSlotId,
      subjectId: l.subjectId,
      startTime: l.startTime,
      endTime: l.endTime,
      contentRecorded: false,
      attendanceRecorded: false,
    })),
  }));
}

/** Junta cada dia ao instantâneo do calendário resolvido para a data. */
function toDayInputs(
  days: readonly FlaggedDay[],
  calendar: readonly ResolvedCalendarDay[],
): ScheduleDayInput[] {
  const byDate = new Map(calendar.map((c) => [c.date, c]));
  return days.map((day) => {
    const resolved = byDate.get(day.date);
    return {
      date: day.date,
      calendarId: resolved?.calendarId ?? null,
      dayType: resolved?.type ?? null,
      lessons: day.lessons,
    };
  });
}

function hasRecords(record: WeeklyScheduleRecord): boolean {
  return datedLessons(record).some(
    (l) => l.contentRecorded || l.attendanceRecorded,
  );
}

function invalidPeriod(message: string): BadRequestException {
  return new BadRequestException({
    code: ERROR_CODES.SCHEDULE_INVALID_PERIOD,
    message,
  });
}

/** Mescla a replicação com a semana alvo existente (sobrescrita). */
function mergeTarget(
  days: readonly PlannedDay[],
  existing: WeeklyScheduleRecord | undefined,
): Pick<ReplicationPlan, 'preserved' | 'discarded'> & { days: FlaggedDay[] } {
  if (!existing) {
    return { days: withoutRecords(days), preserved: [], discarded: [] };
  }
  return mergeWithRecorded(days, datedLessons(existing));
}

function planReplication(
  period: DatePeriod,
  source: readonly PlannedDay[],
  candidates: readonly CalendarDayCandidate[],
  existing: WeeklyScheduleRecord | undefined,
): ReplicationPlan {
  const dates = listPeriodDates(period.startDate, period.endDate);
  const calendar = resolveCalendarDays(dates, candidates);
  const replicated = replicateDays(source, dates, calendar);
  const merged = mergeTarget(replicated.days, existing);
  assertSaturdayLessons(merged.days, calendar);
  return {
    period,
    existing,
    days: toDayInputs(merged.days, calendar),
    preserved: merged.preserved,
    discarded: [...replicated.discarded, ...merged.discarded],
  };
}

/** Casa cada plano com o horário relido por `saveWeeks`, na ordem dos alvos. */
function assembleReplication(
  plans: readonly ReplicationPlan[],
  saved: SaveWeeksResult,
): ReplicationResultDto[] {
  const created = [...saved.created];
  const replaced = [...saved.replaced];
  return plans.map((plan) => {
    const schedule = plan.existing ? replaced.shift() : created.shift();
    return {
      action: plan.existing ? 'OVERWRITTEN' : 'CREATED',
      schedule: toResponse(schedule as WeeklyScheduleRecord),
      preserved: plan.preserved,
      discarded: plan.discarded,
    };
  });
}

/**
 * Horários semanais de turma do tenant da requisição. Aplica as regras do
 * calendário (aula só em dia letivo, sábado letivo com aula) e preserva as
 * aulas com conteúdo/frequência registrados.
 */
@Injectable()
export class WeeklySchedulesService {
  constructor(
    @Inject(WEEKLY_SCHEDULE_REPOSITORY)
    private readonly repository: IWeeklyScheduleRepository,
  ) {}

  async list(
    tenantId: string,
    query: ListWeeklySchedulesDto,
  ): Promise<WeeklyScheduleListResponseDto> {
    const { data, total } = await this.repository.list({
      tenantId,
      schoolClassId: query.schoolClassId,
      from: query.from,
      to: query.to,
      page: query.page ?? DEFAULT_PAGE,
      limit: query.limit ?? DEFAULT_LIMIT,
    });
    return { data: data.map(toSummary), total };
  }

  async findOne(
    tenantId: string,
    id: string,
  ): Promise<WeeklyScheduleResponseDto> {
    return toResponse(await this.findOrFail(tenantId, id));
  }

  async create(
    tenantId: string,
    dto: CreateWeeklyScheduleDto,
    actorId: string,
  ): Promise<WeeklyScheduleResponseDto> {
    const schoolClass = await this.findClassOrFail(tenantId, dto.schoolClassId);
    const period = { startDate: dto.startDate, endDate: dto.endDate };
    assertScheduleWeek(period, schoolClass.schoolYear);
    const planned = await this.planWeek(
      tenantId,
      schoolClass.schoolId,
      period,
      dto.days,
    );
    const calendar = await this.validateAgainstCalendar(
      tenantId,
      schoolClass,
      planned,
    );
    await this.assertWeekFree(tenantId, schoolClass.id, period.startDate);
    const { created } = await this.repository.saveWeeks({
      tenantId,
      actorId,
      creates: [
        {
          schoolClassId: schoolClass.id,
          ...period,
          days: toDayInputs(withoutRecords(planned), calendar),
        },
      ],
      replaces: [],
    });
    return toResponse(created[0]);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateWeeklyScheduleDto,
    actorId: string,
  ): Promise<WeeklyScheduleResponseDto> {
    const current = await this.findOrFail(tenantId, id);
    const schoolClass = await this.findClassOrFail(
      tenantId,
      current.schoolClassId,
    );
    const planned = await this.planWeek(
      tenantId,
      schoolClass.schoolId,
      current,
      dto.days,
    );
    const calendar = await this.validateAgainstCalendar(
      tenantId,
      schoolClass,
      planned,
    );
    const days = carryLessonRecords(datedLessons(current), planned);
    const { replaced } = await this.repository.saveWeeks({
      tenantId,
      actorId,
      creates: [],
      replaces: [{ id, days: toDayInputs(days, calendar) }],
    });
    return toResponse(replaced[0]);
  }

  async remove(tenantId: string, id: string, actorId: string): Promise<void> {
    const current = await this.findOrFail(tenantId, id);
    if (hasRecords(current)) {
      throw new ConflictException({
        code: ERROR_CODES.SCHEDULE_HAS_RECORDS,
        message:
          'O horário tem aulas com conteúdo ou frequência registrados e não pode ser excluído.',
      });
    }
    await this.repository.softDelete(tenantId, id, actorId);
  }

  async replicate(
    tenantId: string,
    id: string,
    dto: ReplicateWeeklyScheduleDto,
    actorId: string,
  ): Promise<ReplicationResponseDto> {
    const source = await this.findOrFail(tenantId, id);
    const schoolClass = await this.findClassOrFail(
      tenantId,
      source.schoolClassId,
    );
    const periods = dto.targetStartDates.map((startDate) =>
      this.targetWeek(startDate, source, schoolClass.schoolYear),
    );
    const sourceDays = plannedFromRecord(source);
    await this.assertSubjects(tenantId, sourceDays);
    const candidates = await this.repository.findCalendarCandidates(
      tenantId,
      schoolClass.schoolId,
      periods.flatMap((p) => listPeriodDates(p.startDate, p.endDate)),
    );
    const existing = await this.repository.findByWeeks(
      tenantId,
      schoolClass.id,
      dto.targetStartDates,
    );
    const plans = periods.map((period) =>
      planReplication(
        period,
        sourceDays,
        candidates,
        existing.find((e) => e.startDate === period.startDate),
      ),
    );
    const saved = await this.repository.saveWeeks({
      tenantId,
      actorId,
      creates: plans
        .filter((p) => !p.existing)
        .map((p) => ({
          schoolClassId: schoolClass.id,
          ...p.period,
          days: p.days,
        })),
      replaces: plans.flatMap((p) =>
        p.existing ? [{ id: p.existing.id, days: p.days }] : [],
      ),
    });
    return { data: assembleReplication(plans, saved) };
  }

  async updateLessonRecord(
    tenantId: string,
    scheduleId: string,
    lessonId: string,
    dto: UpdateLessonRecordDto,
    actorId: string,
  ): Promise<ScheduleLessonResponseDto> {
    const lesson = await this.repository.updateLessonRecord(
      tenantId,
      scheduleId,
      lessonId,
      {
        contentRecorded: dto.contentRecorded,
        attendanceRecorded: dto.attendanceRecorded,
        updatedById: actorId,
      },
    );
    if (!lesson) {
      throw new NotFoundException({
        code: ERROR_CODES.SCHEDULE_LESSON_NOT_FOUND,
        message: 'Aula não encontrada neste horário.',
      });
    }
    return toLesson(lesson);
  }

  private async findOrFail(
    tenantId: string,
    id: string,
  ): Promise<WeeklyScheduleRecord> {
    const schedule = await this.repository.findById(tenantId, id);
    if (schedule) return schedule;
    throw new NotFoundException({
      code: ERROR_CODES.SCHEDULE_NOT_FOUND,
      message: 'Horário semanal não encontrado.',
    });
  }

  private async findClassOrFail(
    tenantId: string,
    schoolClassId: string,
  ): Promise<ScheduleClassRecord> {
    const schoolClass = await this.repository.findClass(
      tenantId,
      schoolClassId,
    );
    if (schoolClass) return schoolClass;
    throw new NotFoundException({
      code: ERROR_CODES.SCHOOL_CLASS_NOT_FOUND,
      message: 'Turma não encontrada.',
    });
  }

  /**
   * Horas copiadas dos horários da escola da turma, dias normalizados na
   * semana e disciplinas existentes no tenant.
   */
  private async planWeek(
    tenantId: string,
    schoolId: string,
    period: DatePeriod,
    days: readonly DayInput[],
  ): Promise<PlannedDay[]> {
    const slotIds = [
      ...new Set(days.flatMap((d) => d.lessons.map((l) => l.lessonSlotId))),
    ];
    const slots = await this.repository.findLessonSlots(
      tenantId,
      schoolId,
      slotIds,
    );
    const planned = normalizePlannedDays(period, attachSlotTimes(days, slots));
    await this.assertSubjects(tenantId, planned);
    return planned;
  }

  private async assertSubjects(
    tenantId: string,
    days: readonly PlannedDay[],
  ): Promise<void> {
    const ids = [
      ...new Set(days.flatMap((d) => d.lessons.map((l) => l.subjectId))),
    ];
    const found = new Set(
      await this.repository.findExistingSubjectIds(tenantId, ids),
    );
    if (ids.every((subjectId) => found.has(subjectId))) return;
    throw new BadRequestException({
      code: ERROR_CODES.SCHEDULE_SUBJECTS_INVALID,
      message: 'Uma ou mais disciplinas não existem neste tenant.',
    });
  }

  /** Resolve o calendário da semana e aplica as regras de dia letivo. */
  private async validateAgainstCalendar(
    tenantId: string,
    schoolClass: ScheduleClassRecord,
    planned: readonly PlannedDay[],
  ): Promise<ResolvedCalendarDay[]> {
    const dates = planned.map((d) => d.date);
    const candidates = await this.repository.findCalendarCandidates(
      tenantId,
      schoolClass.schoolId,
      dates,
    );
    const calendar = resolveCalendarDays(dates, candidates);
    assertDaysMatchCalendar(planned, calendar);
    return calendar;
  }

  private async assertWeekFree(
    tenantId: string,
    schoolClassId: string,
    startDate: string,
  ): Promise<void> {
    const taken = await this.repository.findByWeeks(tenantId, schoolClassId, [
      startDate,
    ]);
    if (taken.length === 0) return;
    throw new ConflictException({
      code: ERROR_CODES.SCHEDULE_WEEK_TAKEN,
      message: `A turma já tem horário para a semana de ${startDate}.`,
    });
  }

  private targetWeek(
    startDate: string,
    source: WeeklyScheduleRecord,
    schoolYear: number,
  ): DatePeriod {
    const period = weekPeriod(startDate);
    assertScheduleWeek(period, schoolYear);
    if (startDate !== source.startDate) return period;
    throw invalidPeriod('A semana alvo não pode ser a semana de origem.');
  }
}
