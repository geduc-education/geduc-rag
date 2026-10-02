import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  CALENDAR_VIEWS,
  type CalendarView,
  DAY_TYPES,
  type DayType,
} from '../academic-calendar.rules';

/** `YYYY-MM-DD`; o `@IsDateString` estrito recusa datas inexistentes. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'deve ser uma data válida no formato YYYY-MM-DD.';

function IsCalendarDate(): PropertyDecorator {
  return (target, key) => {
    IsString()(target, key);
    Matches(DATE_PATTERN, { message: `${String(key)} ${DATE_MESSAGE}` })(
      target,
      key,
    );
    IsDateString({ strict: true })(target, key);
  };
}

/** Descrição vazia após `trim()` vira `null`; não-string segue intacta. */
function trimToNull({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() || null : value;
}

/**
 * Payload de criação do calendário (ano letivo). O tenant vem do header
 * `tenant-id`. `year` e o período são imutáveis depois de criados; os dias
 * nascem com fim de semana não letivo e segunda a sexta letivo.
 */
export class CreateAcademicCalendarDto {
  @ApiProperty({ example: 2026, minimum: 2000, maximum: 2100 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 'Calendário 2026' })
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  name!: string;

  @ApiProperty({ example: '2026-02-02', description: 'Dentro de `year`.' })
  @IsCalendarDate()
  startDate!: string;

  @ApiProperty({ example: '2026-12-18', description: 'Dentro de `year`.' })
  @IsCalendarDate()
  endDate!: string;

  @ApiProperty({
    description:
      'Vale para todas as escolas do tenant. Com `true`, `schoolIds` deve ' +
      'ser omitido ou vazio; com `false`, precisa de ao menos uma escola ' +
      '(400 CALENDAR_SCHOOLS_INVALID).',
  })
  @IsBoolean()
  allSchools!: boolean;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayUnique()
  schoolIds?: string[];
}

/** Só nome e escolas mudam; `null` explícito é 400. */
export class UpdateAcademicCalendarDto {
  @ApiPropertyOptional({ example: 'Calendário 2026' })
  @IsOptionalNotNull()
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  name?: string;

  @ApiPropertyOptional()
  @IsOptionalNotNull()
  @IsBoolean()
  allSchools?: boolean;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptionalNotNull()
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayUnique()
  schoolIds?: string[];
}

/** Filtros e paginação da listagem de calendários do tenant. */
export class ListAcademicCalendarsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Calendários de todas as escolas ou vinculados a esta.',
  })
  @IsOptional()
  @IsUUID()
  schoolId?: string;
}

/** Visão (dia, semana domingo–sábado, mês ou ano) que contém `date`. */
export class CalendarDaysQueryDto {
  @ApiProperty({ enum: CALENDAR_VIEWS })
  @IsIn(CALENDAR_VIEWS)
  view!: CalendarView;

  @ApiProperty({ example: '2026-02-04' })
  @IsCalendarDate()
  date!: string;
}

/** Parâmetros de `PATCH /academic-calendars/:id/days/:date`. */
export class CalendarDayParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ example: '2026-02-04' })
  @IsCalendarDate()
  date!: string;
}

/** Domingo só aceita `NON_SCHOOL_DAY` (400 CALENDAR_SUNDAY_IMMUTABLE). */
export class UpdateCalendarDayDto {
  @ApiPropertyOptional({ enum: DAY_TYPES })
  @IsOptionalNotNull()
  @IsIn(DAY_TYPES)
  type?: DayType;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: '`null` ou vazio limpa a descrição.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class DayTypeTotalsDto {
  @ApiProperty()
  SCHOOL_DAY!: number;

  @ApiProperty()
  NON_SCHOOL_DAY!: number;

  @ApiProperty()
  OPTIONAL_DAY!: number;

  @ApiProperty()
  LESSON_PLANNING!: number;

  @ApiProperty()
  TEACHER_TRAINING!: number;

  @ApiProperty()
  total!: number;
}

export class AcademicCalendarResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  year!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ example: '2026-02-02' })
  startDate!: string;

  @ApiProperty({ example: '2026-12-18' })
  endDate!: string;

  @ApiProperty()
  allSchools!: boolean;

  @ApiProperty({ type: [String], description: '`[]` quando `allSchools`.' })
  schoolIds!: string[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AcademicCalendarDetailResponseDto extends AcademicCalendarResponseDto {
  @ApiProperty({ type: DayTypeTotalsDto })
  totals!: DayTypeTotalsDto;
}

/** Envelope paginado da listagem. */
export class AcademicCalendarListResponseDto {
  @ApiProperty({ type: [AcademicCalendarResponseDto] })
  data!: AcademicCalendarResponseDto[];

  @ApiProperty()
  total!: number;
}

export class CalendarDayResponseDto {
  @ApiProperty({ example: '2026-02-04' })
  date!: string;

  @ApiProperty({ description: '0 = domingo … 6 = sábado.' })
  weekday!: number;

  @ApiProperty({ enum: DAY_TYPES })
  type!: DayType;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  updatedAt!: Date;
}

export class CalendarDaysResponseDto {
  @ApiProperty()
  calendarId!: string;

  @ApiProperty({ enum: CALENDAR_VIEWS })
  view!: CalendarView;

  @ApiProperty()
  startDate!: string;

  @ApiProperty()
  endDate!: string;

  @ApiProperty({ type: [CalendarDayResponseDto] })
  days!: CalendarDayResponseDto[];

  @ApiProperty({ type: DayTypeTotalsDto })
  totals!: DayTypeTotalsDto;
}
