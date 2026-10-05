import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  DAY_TYPES,
  type DayType,
} from '../../academic-calendar/academic-calendar.rules';
import {
  DISCARD_REASONS,
  SCHEDULE_STATUSES,
  type DiscardReason,
  type ScheduleStatus,
} from '../weekly-schedule.rules';

/** `YYYY-MM-DD`; o `@IsDateString` estrito recusa datas inexistentes. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'deve ser uma data válida no formato YYYY-MM-DD.';

const MAX_DAYS = 7;
const MAX_LESSONS_PER_DAY = 20;
const MAX_TARGETS = 20;

/**
 * Cópia local do validador de `academic-calendar.dto.ts` (não exportado lá).
 * Com `each`, valida cada item de um array.
 */
function IsCalendarDate(each = false): PropertyDecorator {
  return (target, key) => {
    IsString({ each })(target, key);
    Matches(DATE_PATTERN, {
      each,
      message: `${String(key)} ${DATE_MESSAGE}`,
    })(target, key);
    IsDateString({ strict: true }, { each })(target, key);
  };
}

/**
 * Aula do dia: horário da escola da turma (as horas vêm dele) e disciplina.
 * `startTime`/`endTime` não são aceitos.
 */
export class ScheduleLessonDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Horário de aula da escola da turma.',
  })
  @IsUUID()
  lessonSlotId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;
}

/** Dia da semana com as aulas; dia omitido = sem aula. */
export class ScheduleDayDto {
  @ApiProperty({ example: '2026-09-28' })
  @IsCalendarDate()
  date!: string;

  @ApiProperty({ type: [ScheduleLessonDto], maxItems: MAX_LESSONS_PER_DAY })
  @IsArray()
  @ArrayMaxSize(MAX_LESSONS_PER_DAY)
  @ValidateNested({ each: true })
  @Type(() => ScheduleLessonDto)
  lessons!: ScheduleLessonDto[];
}

/**
 * Semana de segunda (`startDate`) a domingo (`endDate = startDate + 6`),
 * conferida no service (400 SCHEDULE_INVALID_PERIOD).
 */
export class CreateWeeklyScheduleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  schoolClassId!: string;

  @ApiProperty({ example: '2026-09-28', description: 'Segunda-feira.' })
  @IsCalendarDate()
  startDate!: string;

  @ApiProperty({ example: '2026-10-04', description: 'Domingo seguinte.' })
  @IsCalendarDate()
  endDate!: string;

  @ApiProperty({ type: [ScheduleDayDto], maxItems: MAX_DAYS })
  @IsArray()
  @ArrayMaxSize(MAX_DAYS)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  days!: ScheduleDayDto[];
}

/** PUT: substitui os dias; turma e semana são imutáveis. */
export class UpdateWeeklyScheduleDto {
  @ApiProperty({ type: [ScheduleDayDto], maxItems: MAX_DAYS })
  @IsArray()
  @ArrayMaxSize(MAX_DAYS)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  days!: ScheduleDayDto[];
}

/** Segundas das semanas alvo, diferentes da semana de origem. */
export class ReplicateWeeklyScheduleDto {
  @ApiProperty({
    type: [String],
    example: ['2026-10-05', '2026-10-12'],
    minItems: 1,
    maxItems: MAX_TARGETS,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TARGETS)
  @ArrayUnique()
  @IsCalendarDate(true)
  targetStartDates!: string[];
}

/** Registro de conteúdo/frequência da aula; `null` explícito é 400. */
export class UpdateLessonRecordDto {
  @ApiPropertyOptional()
  @IsOptionalNotNull()
  @IsBoolean()
  contentRecorded?: boolean;

  @ApiPropertyOptional()
  @IsOptionalNotNull()
  @IsBoolean()
  attendanceRecorded?: boolean;
}

/** Filtros e paginação; `from`/`to` pegam semanas que cruzam o intervalo. */
export class ListWeeklySchedulesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  schoolClassId?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsCalendarDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsCalendarDate()
  to?: string;
}

export class ScheduleRecordSummaryDto {
  @ApiProperty()
  lessons!: number;

  @ApiProperty()
  contentRecorded!: number;

  @ApiProperty()
  attendanceRecorded!: number;
}

export class WeeklyScheduleSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  schoolClassId!: string;

  @ApiProperty({ example: '2026-09-28' })
  startDate!: string;

  @ApiProperty({ example: '2026-10-04' })
  endDate!: string;

  @ApiProperty({
    enum: SCHEDULE_STATUSES,
    description: '`OUTDATED` quando o calendário mudou depois de salvar.',
  })
  status!: ScheduleStatus;

  @ApiProperty({ type: ScheduleRecordSummaryDto })
  record!: ScheduleRecordSummaryDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ScheduleLessonResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '`null` só em aula gravada antes dos horários da escola.',
  })
  lessonSlotId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '1ª aula' })
  slotName!: string | null;

  @ApiProperty()
  subjectId!: string;

  @ApiProperty()
  subjectName!: string;

  @ApiProperty({ example: '08:00' })
  startTime!: string;

  @ApiProperty({ example: '08:50' })
  endTime!: string;

  @ApiProperty()
  contentRecorded!: boolean;

  @ApiProperty()
  attendanceRecorded!: boolean;
}

export class ScheduleDayResponseDto {
  @ApiProperty({ example: '2026-09-28' })
  date!: string;

  @ApiProperty({ description: '0 = domingo … 6 = sábado.' })
  weekday!: number;

  @ApiProperty({
    enum: DAY_TYPES,
    nullable: true,
    description: '`null` = data fora do calendário.',
  })
  dayType!: DayType | null;

  @ApiProperty({ description: '`dayType === SCHOOL_DAY`.' })
  hasClass!: boolean;

  @ApiProperty({ type: [ScheduleLessonResponseDto] })
  lessons!: ScheduleLessonResponseDto[];
}

export class WeeklyScheduleResponseDto extends WeeklyScheduleSummaryResponseDto {
  @ApiProperty({ type: [ScheduleDayResponseDto] })
  days!: ScheduleDayResponseDto[];
}

export class WeeklyScheduleListResponseDto {
  @ApiProperty({ type: [WeeklyScheduleSummaryResponseDto] })
  data!: WeeklyScheduleSummaryResponseDto[];

  @ApiProperty()
  total!: number;
}

export class PreservedLessonDto {
  @ApiProperty()
  date!: string;

  @ApiProperty({ type: String, nullable: true })
  lessonSlotId!: string | null;

  @ApiProperty()
  subjectId!: string;

  @ApiProperty()
  startTime!: string;

  @ApiProperty()
  endTime!: string;

  @ApiProperty()
  contentRecorded!: boolean;

  @ApiProperty()
  attendanceRecorded!: boolean;
}

export class DiscardedLessonDto {
  @ApiProperty()
  date!: string;

  @ApiProperty({ type: String, nullable: true })
  lessonSlotId!: string | null;

  @ApiProperty()
  subjectId!: string;

  @ApiProperty()
  startTime!: string;

  @ApiProperty()
  endTime!: string;

  @ApiProperty({ enum: DISCARD_REASONS })
  reason!: DiscardReason;
}

export const REPLICATION_ACTIONS = ['CREATED', 'OVERWRITTEN'] as const;
export type ReplicationAction = (typeof REPLICATION_ACTIONS)[number];

export class ReplicationResultDto {
  @ApiProperty({ enum: REPLICATION_ACTIONS })
  action!: ReplicationAction;

  @ApiProperty({ type: WeeklyScheduleResponseDto })
  schedule!: WeeklyScheduleResponseDto;

  @ApiProperty({ type: [PreservedLessonDto] })
  preserved!: PreservedLessonDto[];

  @ApiProperty({ type: [DiscardedLessonDto] })
  discarded!: DiscardedLessonDto[];
}

/** Um resultado por semana alvo, na ordem de `targetStartDates`. */
export class ReplicationResponseDto {
  @ApiProperty({ type: [ReplicationResultDto] })
  data!: ReplicationResultDto[];
}
