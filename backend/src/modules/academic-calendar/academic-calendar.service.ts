import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  assertCalendarRange,
  assertDayTypeChangeAllowed,
  buildCalendarDays,
  countByType,
  resolvePeriod,
  totalsFromCounts,
  weekdayOf,
} from './academic-calendar.rules';
import {
  ACADEMIC_CALENDAR_REPOSITORY,
  type AcademicCalendarRecord,
  type CalendarDayRecord,
  type IAcademicCalendarRepository,
} from './application/interface/repository/academic-calendar.repository.interface';
import {
  AcademicCalendarDetailResponseDto,
  AcademicCalendarListResponseDto,
  CalendarDayResponseDto,
  CalendarDaysQueryDto,
  CalendarDaysResponseDto,
  CreateAcademicCalendarDto,
  ListAcademicCalendarsDto,
  UpdateAcademicCalendarDto,
  UpdateCalendarDayDto,
} from './dto/academic-calendar.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/** Escolas pedidas no DTO e o estado atual (`create` parte de vazio). */
interface SchoolsChange {
  allSchools?: boolean;
  schoolIds?: string[];
}

interface SchoolsState {
  allSchools: boolean;
  schoolIds: string[];
}

/** `undefined` mantém; vazio após `trim()` vira `null`. */
function normalizeDescription(
  description: string | null | undefined,
): string | null | undefined {
  if (description === undefined || description === null) return description;
  return description.trim() || null;
}

function toDayResponse(day: CalendarDayRecord): CalendarDayResponseDto {
  return { ...day, weekday: weekdayOf(day.date) };
}

function schoolsInvalid(message: string): BadRequestException {
  return new BadRequestException({
    code: ERROR_CODES.CALENDAR_SCHOOLS_INVALID,
    message,
  });
}

/**
 * Calendários acadêmicos (anos letivos) do tenant da requisição. Calendário
 * de outro tenant ou excluído responde 404 indistinto.
 */
@Injectable()
export class AcademicCalendarService {
  constructor(
    @Inject(ACADEMIC_CALENDAR_REPOSITORY)
    private readonly repository: IAcademicCalendarRepository,
  ) {}

  list(
    tenantId: string,
    query: ListAcademicCalendarsDto,
  ): Promise<AcademicCalendarListResponseDto> {
    return this.repository.list({
      tenantId,
      year: query.year,
      schoolId: query.schoolId,
      page: query.page ?? DEFAULT_PAGE,
      limit: query.limit ?? DEFAULT_LIMIT,
    });
  }

  async findOne(
    tenantId: string,
    id: string,
  ): Promise<AcademicCalendarDetailResponseDto> {
    const calendar = await this.findOrFail(tenantId, id);
    return this.withStoredTotals(calendar);
  }

  async create(
    tenantId: string,
    dto: CreateAcademicCalendarDto,
    actorId: string,
  ): Promise<AcademicCalendarDetailResponseDto> {
    assertCalendarRange(dto.year, dto.startDate, dto.endDate);
    const schools = await this.resolveSchools(tenantId, dto, {
      allSchools: dto.allSchools,
      schoolIds: [],
    });
    const days = buildCalendarDays(dto.startDate, dto.endDate);
    const calendar = await this.repository.create({
      tenantId,
      year: dto.year,
      name: dto.name.trim(),
      startDate: dto.startDate,
      endDate: dto.endDate,
      ...schools,
      days,
      createdById: actorId,
    });
    return { ...calendar, totals: countByType(days.map((d) => d.type)) };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateAcademicCalendarDto,
    actorId: string,
  ): Promise<AcademicCalendarDetailResponseDto> {
    const current = await this.findOrFail(tenantId, id);
    const touchesSchools =
      dto.allSchools !== undefined || dto.schoolIds !== undefined;
    const schools = touchesSchools
      ? await this.resolveSchools(tenantId, dto, current)
      : undefined;
    const calendar = await this.repository.update(tenantId, id, {
      name: dto.name?.trim(),
      allSchools: dto.allSchools,
      schoolIds: schools?.schoolIds,
      updatedById: actorId,
    });
    return this.withStoredTotals(calendar);
  }

  async remove(tenantId: string, id: string, actorId: string): Promise<void> {
    await this.findOrFail(tenantId, id);
    await this.repository.softDelete(tenantId, id, actorId);
  }

  async listDays(
    tenantId: string,
    id: string,
    query: CalendarDaysQueryDto,
  ): Promise<CalendarDaysResponseDto> {
    await this.findOrFail(tenantId, id);
    const period = resolvePeriod(query.view, query.date);
    const days = await this.repository.listDays(tenantId, id, period);
    return {
      calendarId: id,
      view: query.view,
      ...period,
      days: days.map(toDayResponse),
      totals: countByType(days.map((d) => d.type)),
    };
  }

  /** Regra do domingo antes de qualquer leitura ou escrita do dia. */
  async updateDay(
    tenantId: string,
    id: string,
    date: string,
    dto: UpdateCalendarDayDto,
    actorId: string,
  ): Promise<CalendarDayResponseDto> {
    assertDayTypeChangeAllowed(date, dto.type);
    await this.findOrFail(tenantId, id);
    const existing = await this.repository.findDay(tenantId, id, date);
    if (!existing) {
      throw new NotFoundException({
        code: ERROR_CODES.CALENDAR_DAY_NOT_FOUND,
        message: 'Dia fora do calendário.',
      });
    }
    const day = await this.repository.updateDay(tenantId, id, date, {
      type: dto.type,
      description: normalizeDescription(dto.description),
      updatedById: actorId,
    });
    return toDayResponse(day);
  }

  private async findOrFail(
    tenantId: string,
    id: string,
  ): Promise<AcademicCalendarRecord> {
    const calendar = await this.repository.findById(tenantId, id);
    if (calendar) return calendar;
    throw new NotFoundException({
      code: ERROR_CODES.CALENDAR_NOT_FOUND,
      message: 'Calendário não encontrado.',
    });
  }

  private async withStoredTotals(
    calendar: AcademicCalendarRecord,
  ): Promise<AcademicCalendarDetailResponseDto> {
    const counts = await this.repository.countDaysByType(
      calendar.tenantId,
      calendar.id,
    );
    return { ...calendar, totals: totalsFromCounts(counts) };
  }

  /**
   * Escolas efetivas: `allSchools` do DTO ou o atual; com `allSchools` a
   * lista é `[]` (limpa vínculos antigos), senão a do DTO ou a atual — que
   * precisa ser não vazia e só de escolas não excluídas do tenant.
   */
  private async resolveSchools(
    tenantId: string,
    change: SchoolsChange,
    current: SchoolsState,
  ): Promise<SchoolsState> {
    const allSchools = change.allSchools ?? current.allSchools;
    if (allSchools) {
      if (change.schoolIds?.length) {
        throw schoolsInvalid(
          'Calendário de todas as escolas não aceita escolas específicas.',
        );
      }
      return { allSchools, schoolIds: [] };
    }
    const schoolIds = change.schoolIds ?? current.schoolIds;
    await this.assertSchoolsExist(tenantId, schoolIds);
    return { allSchools, schoolIds };
  }

  private async assertSchoolsExist(
    tenantId: string,
    schoolIds: string[],
  ): Promise<void> {
    if (schoolIds.length === 0) {
      throw schoolsInvalid('Informe ao menos uma escola.');
    }
    const existing = await this.repository.findExistingSchoolIds(
      tenantId,
      schoolIds,
    );
    if (existing.length < schoolIds.length) {
      throw schoolsInvalid('Escola inexistente ou fora do tenant.');
    }
  }
}
