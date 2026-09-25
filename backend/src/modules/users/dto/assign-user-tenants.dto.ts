import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

/**
 * Payload de `PUT /users/:id/tenants`: substitui o conjunto de vínculos
 * usuário ↔ tenant. Vínculos fora do alcance do ator são preservados; incluir
 * ou remover um deles é 403 `TENANT_NOT_GRANTABLE`.
 */
export class AssignUserTenantsDto {
  @ApiProperty({
    type: [String],
    description: 'IDs dos tenants a vincular (conjunto substitutivo).',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  tenantIds!: string[];
}
