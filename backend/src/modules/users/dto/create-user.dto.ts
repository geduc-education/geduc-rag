import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsOptionalNotNull } from '../../../common/decorators';

/**
 * Payload de criação de usuário. A senha inicial é informada pelo
 * administrador e é TEMPORÁRIA: o usuário nasce com `mustChangePassword` e
 * troca no 1º acesso. (O geduc-suporte gera e envia por e-mail; aqui ainda não
 * há módulo de e-mail — ver .docs/prd/modulo-users.md.)
 *
 * Nenhum campo aceita `null`: são colunas NOT NULL ou conjuntos N:N
 * substituídos por inteiro — daí `@IsOptionalNotNull()` nos opcionais.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'Maria Curadora' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'maria@empresa.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    minLength: 8,
    description: 'Senha temporária — o usuário troca no 1º acesso.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptionalNotNull()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'Perfis (N:N). Só é possível atribuir perfil cujas permissões o próprio ' +
      'ator possui (403 PERMISSION_NOT_GRANTABLE).',
  })
  @IsOptionalNotNull()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  profileIds?: string[];

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'Tenants (N:N). Obrigatório (≥ 1) para quem não é SUPERADMIN, e só ' +
      'tenants do alcance do ator (403 TENANT_NOT_GRANTABLE).',
  })
  @IsOptionalNotNull()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  tenantIds?: string[];
}
