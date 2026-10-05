import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const MIN_SCHOOL_YEAR = 2000;
const MAX_SCHOOL_YEAR = 2100;

/**
 * Payload de criação de turma. O tenant vem do header `tenant-id`; escola e
 * ano letivo são imutáveis depois de criados.
 */
export class CreateSchoolClassDto {
  @ApiProperty({ format: 'uuid', description: 'Escola ativa do tenant.' })
  @IsUUID('all')
  schoolId!: string;

  @ApiProperty({
    example: 2026,
    minimum: MIN_SCHOOL_YEAR,
    maximum: MAX_SCHOOL_YEAR,
  })
  @IsInt()
  @Min(MIN_SCHOOL_YEAR)
  @Max(MAX_SCHOOL_YEAR)
  schoolYear!: number;

  @ApiProperty({
    example: '8º A',
    description:
      'Único por escola e ano letivo, inclusive entre turmas excluídas.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  name!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptionalNotNull()
  @IsBoolean()
  active?: boolean;
}

/** Só nome e situação são editáveis. */
export class UpdateSchoolClassDto {
  @ApiPropertyOptional({ example: '8º B' })
  @IsOptionalNotNull()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  name?: string;

  @ApiPropertyOptional()
  @IsOptionalNotNull()
  @IsBoolean()
  active?: boolean;
}

/** Filtros e paginação da listagem de turmas do tenant. */
export class ListSchoolClassesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  schoolId?: string;

  @ApiPropertyOptional({
    example: 2026,
    minimum: MIN_SCHOOL_YEAR,
    maximum: MAX_SCHOOL_YEAR,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_SCHOOL_YEAR)
  @Max(MAX_SCHOOL_YEAR)
  schoolYear?: number;

  @ApiPropertyOptional({ description: 'Busca parcial no nome.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  active?: boolean;
}

export class SchoolClassResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  schoolId!: string;

  @ApiProperty()
  schoolName!: string;

  @ApiProperty()
  schoolYear!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class SchoolClassListResponseDto {
  @ApiProperty({ type: [SchoolClassResponseDto] })
  data!: SchoolClassResponseDto[];

  @ApiProperty()
  total!: number;
}
