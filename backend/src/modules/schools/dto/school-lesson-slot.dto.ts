import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators';
import { UPDATE_DTO_PARTIAL_OPTS } from '../../../common/dto/partial-type.options';

/** `HH:mm` com zero à esquerda, 00:00 a 23:59. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MESSAGE = 'deve ser uma hora no formato HH:mm.';
const MAX_POSITION = 999;

function IsSlotTime(): PropertyDecorator {
  return (target, key) => {
    IsString()(target, key);
    Matches(TIME_PATTERN, { message: `${String(key)} ${TIME_MESSAGE}` })(
      target,
      key,
    );
  };
}

/**
 * Horário de aula da escola, válido para todos os dias da semana. Fim depois
 * do início e sem cruzar outro horário da escola (conferidos no service).
 */
export class CreateLessonSlotDto {
  @ApiProperty({
    example: '1ª aula',
    description: 'Único entre os horários não excluídos da escola.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @ApiProperty({ example: '07:00' })
  @IsSlotTime()
  startTime!: string;

  @ApiProperty({ example: '07:50' })
  @IsSlotTime()
  endTime!: string;

  @ApiProperty({
    required: false,
    description: 'Ordem de exibição; padrão = maior posição da escola + 1.',
  })
  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(MAX_POSITION)
  position?: number;
}

export class UpdateLessonSlotDto extends PartialType(
  CreateLessonSlotDto,
  UPDATE_DTO_PARTIAL_OPTS,
) {}

export class LessonSlotResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  schoolId!: string;

  @ApiProperty({ example: '1ª aula' })
  name!: string;

  @ApiProperty({ example: '07:00' })
  startTime!: string;

  @ApiProperty({ example: '07:50' })
  endTime!: string;

  @ApiProperty()
  position!: number;
}

/** Ordenado por posição e depois início. */
export class LessonSlotListResponseDto {
  @ApiProperty({ type: [LessonSlotResponseDto] })
  data!: LessonSlotResponseDto[];
}
