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

/** Payload de criação de escola. O tenant vem do header `tenant-id`. */
export class CreateSchoolDto {
  @ApiProperty({
    example: 'EMEF Monteiro Lobato',
    description: 'Único por tenant, inclusive entre escolas excluídas.',
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

export class UpdateSchoolDto extends PartialType(
  CreateSchoolDto,
  UPDATE_DTO_PARTIAL_OPTS,
) {}

/** Filtros e paginação da listagem de escolas do tenant. */
export class ListSchoolsDto extends PaginationQueryDto {
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

export class SchoolResponseDto {
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

export class SchoolListResponseDto {
  @ApiProperty({ type: [SchoolResponseDto] })
  data!: SchoolResponseDto[];

  @ApiProperty()
  total!: number;
}
