import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators';
import { UPDATE_DTO_PARTIAL_OPTS } from '../../../common/dto/partial-type.options';

/** Slug: minúsculas, dígitos e hífen, sem hífen nas pontas. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateTenantDto {
  @ApiProperty({ example: 'Secretaria de Educação' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'sec-educacao' })
  @IsString()
  @MaxLength(60)
  @Matches(SLUG_PATTERN, {
    message: 'slug deve ter só minúsculas, dígitos e hífen.',
  })
  slug!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptionalNotNull()
  @IsBoolean()
  active?: boolean;
}

export class UpdateTenantDto extends PartialType(
  CreateTenantDto,
  UPDATE_DTO_PARTIAL_OPTS,
) {}

export class TenantResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
