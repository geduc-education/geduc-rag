import { ApiProperty } from '@nestjs/swagger';

/** Perfil resumido exposto na resposta de usuário. */
export class UserProfileSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

/** Tenant resumido exposto nas respostas de usuário e no `/auth/me`. */
export class TenantSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

/**
 * Resposta de usuário. NUNCA inclui passwordHash. Expõe perfis, tenants
 * vinculados e a união das permissões efetivas (gating de UI).
 */
export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiProperty()
  isSuperAdmin!: boolean;

  @ApiProperty({ type: [UserProfileSummaryDto] })
  profiles!: UserProfileSummaryDto[];

  @ApiProperty({
    type: [TenantSummaryDto],
    description: 'Tenants vinculados (liberam o header tenant-id).',
  })
  tenants!: TenantSummaryDto[];

  @ApiProperty({
    type: [String],
    description: 'União das permissões dos perfis ativos (chaves).',
  })
  permissions!: string[];

  @ApiProperty({ nullable: true, type: Date })
  lastLoginAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

/** Envelope paginado da listagem. */
export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data!: UserResponseDto[];

  @ApiProperty()
  total!: number;
}
