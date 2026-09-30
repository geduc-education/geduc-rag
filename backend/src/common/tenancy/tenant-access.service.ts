import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type ITenantAccessRepository,
  TENANT_ACCESS_REPOSITORY,
} from './application/interface/repository/tenant-access.repository.interface';

/**
 * Alcance de tenant do ator: SUPERADMIN enxerga todos (`tenantIds = null`);
 * os demais, só os tenants a que estão vinculados (`UserTenant`).
 */
export interface TenantReach {
  superAdmin: boolean;
  /** `null` = todos os tenants (SUPERADMIN). */
  tenantIds: string[] | null;
}

/**
 * Alcance passado aos repositórios: `'all'` = sem filtro (SUPERADMIN); lista
 * vazia = nada visível.
 */
export type TenantScope = readonly string[] | 'all';

export function scopeOf(reach: TenantReach): TenantScope {
  return reach.tenantIds === null ? 'all' : reach.tenantIds;
}

/**
 * Fonte única do vínculo usuário ↔ tenant. O `TenantGuard` usa para liberar o
 * header `tenant-id`; os services de cadastro (users, tenants) usam para
 * restringir listagens e mutações ao alcance do ator.
 */
@Injectable()
export class TenantAccessService {
  constructor(
    @Inject(TENANT_ACCESS_REPOSITORY)
    private readonly repository: ITenantAccessRepository,
  ) {}

  /** Alcance do ator; `null` quando o usuário não existe/está inativo. */
  async reachOf(userId: string): Promise<TenantReach | null> {
    const links = await this.repository.findActiveUserTenants(userId);
    if (!links) return null;
    if (links.isSuperAdmin) return { superAdmin: true, tenantIds: null };
    return { superAdmin: false, tenantIds: links.tenantIds };
  }

  /**
   * `true` quando o usuário pode operar no tenant: tenant ativo e não excluído
   * **e** (SUPERADMIN ou vínculo `UserTenant`). Tenant inexistente e tenant
   * fora do alcance respondem igual — o chamador não distingue os dois.
   */
  async canAccess(userId: string, tenantId: string): Promise<boolean> {
    if (!(await this.repository.isTenantActive(tenantId))) return false;
    const reach = await this.reachOf(userId);
    if (!reach) return false;
    return reach.tenantIds === null || reach.tenantIds.includes(tenantId);
  }

  /**
   * Filtro de tenant para listagens escopadas (`undefined` = sem filtro).
   * Transitório: some quando os cadastros passarem a usar `scopeOf`.
   */
  tenantWhere(reach: TenantReach): Prisma.TenantWhereInput | undefined {
    if (reach.tenantIds === null) return undefined;
    return { id: { in: reach.tenantIds } };
  }
}
