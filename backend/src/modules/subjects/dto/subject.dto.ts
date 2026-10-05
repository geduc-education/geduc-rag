import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { UPDATE_DTO_PARTIAL_OPTS } from '../../../common/dto/partial-type.options';

/** Payload de criação de disciplina. O tenant vem do header `tenant-id`. */
export class CreateSubjectDto {
  @ApiProperty({
    example: 'Matemática',
    description: 'Único por tenant, inclusive entre disciplinas excluídas.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  name!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptionalNotNull()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSubjectDto extends PartialType(
  CreateSubjectDto,
  UPDATE_DTO_PARTIAL_OPTS,
) {}

/** Filtros e paginação da listagem de disciplinas do tenant. */
export class ListSubjectsDto extends PaginationQueryDto {
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

export class SubjectResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class SubjectListResponseDto {
  @ApiProperty({ type: [SubjectResponseDto] })
  data!: SubjectResponseDto[];

  @ApiProperty()
  total!: number;
}
