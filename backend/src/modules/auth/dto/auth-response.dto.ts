import { ApiProperty } from '@nestjs/swagger';
import { TenantSummaryDto } from '../../users/dto/user-response.dto';

/** Usuário da sessão (login, troca de senha e `/auth/me`). */
export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({
    type: [String],
    description: 'Nomes dos perfis atribuídos ao usuário.',
  })
  profiles!: string[];

  @ApiProperty({
    type: [String],
    description:
      'União das permissões dos perfis ativos (chaves). O SUPERADMIN tem ' +
      'bypass independentemente desta lista — use isSuperAdmin.',
  })
  permissions!: string[];

  @ApiProperty({
    type: [TenantSummaryDto],
    description:
      'Tenants vinculados — os únicos aceitos no header tenant-id (exceto ' +
      'SUPERADMIN, que acessa todos).',
  })
  tenants!: TenantSummaryDto[];

  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiProperty({
    description:
      'SUPERADMIN de bootstrap: bypass de permissões e de vínculo com tenant.',
  })
  isSuperAdmin!: boolean;
}

/** Resposta de login / troca de senha: token + flags + usuário. */
export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
