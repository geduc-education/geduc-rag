import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { UPDATE_DTO_PARTIAL_OPTS } from '../../../common/dto/partial-type.options';

/** CPF gravado só com dígitos. */
const CPF_PATTERN = /^\d{11}$/;

/** Aceita `123.456.789-09` e grava `12345678909`; não-string segue intacto. */
function onlyDigits({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.replace(/\D/g, '') : value;
}

/**
 * Payload de criação de funcionário. O tenant vem do header `tenant-id`,
 * nunca do corpo. `userId` e `position` são colunas NULLABLE: aceitam `null`
 * (no PATCH, `null` limpa o campo); os demais opcionais são NOT NULL.
 */
export class CreateEmployeeDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'joao@escola.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example: '12345678909',
    description: 'CPF; pontuação é removida antes de validar.',
  })
  @Transform(onlyDigits)
  @IsString()
  @Matches(CPF_PATTERN, { message: 'document deve ter 11 dígitos.' })
  document!: string;

  @ApiProperty({ required: false, nullable: true, example: 'Professor' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  position?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Usuário da plataforma vinculado. Precisa ter vínculo com o tenant ' +
      '(400 EMPLOYEE_USER_NOT_LINKABLE).',
  })
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiProperty({ required: false, default: true })
  @IsOptionalNotNull()
  @IsBoolean()
  active?: boolean;
}

export class UpdateEmployeeDto extends PartialType(
  CreateEmployeeDto,
  UPDATE_DTO_PARTIAL_OPTS,
) {}

/** Filtros e paginação da listagem de funcionários do tenant. */
export class ListEmployeesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome, e-mail ou CPF.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  active?: boolean;
}

export class EmployeeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ nullable: true, type: String })
  userId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  document!: string;

  @ApiProperty({ nullable: true, type: String })
  position!: string | null;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

/** Envelope paginado da listagem. */
export class EmployeeListResponseDto {
  @ApiProperty({ type: [EmployeeResponseDto] })
  data!: EmployeeResponseDto[];

  @ApiProperty()
  total!: number;
}
