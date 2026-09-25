import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

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
 * Fonte única do vínculo usuário ↔ tenant. O `TenantGuard` usa para liberar o
 * header `tenant-id`; os services de cadastro (users, tenants) usam para
 * restringir listagens e mutações ao alcance do ator.
 */
@Injectable()
export class TenantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Alcance do ator; `null` quando o usuário não existe/está inativo. */
  async reachOf(userId: string): Promise<TenantReach | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, active: true, deletedAt: null },
      select: {
        isSuperAdmin: true,
        tenants: {
          where: { tenant: { deletedAt: null } },
          select: { tenantId: true },
        },
      },
    });
    if (!user) return null;
    if (user.isSuperAdmin) return { superAdmin: true, tenantIds: null };
    return {
      superAdmin: false,
      tenantIds: user.tenants.map((link) => link.tenantId),
    };
  }

  /**
   * `true` quando o usuário pode operar no tenant: tenant ativo e não excluído
   * **e** (SUPERADMIN ou vínculo `UserTenant`). Tenant inexistente e tenant
   * fora do alcance respondem igual — o chamador não distingue os dois.
   */
  async canAccess(userId: string, tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, active: true, deletedAt: null },
      select: { id: true },
    });
    if (!tenant) return false;
    const reach = await this.reachOf(userId);
    if (!reach) return false;
    return reach.tenantIds === null || reach.tenantIds.includes(tenantId);
  }

  /** Filtro de tenant para listagens escopadas (`undefined` = sem filtro). */
  tenantWhere(reach: TenantReach): Prisma.TenantWhereInput | undefined {
    if (reach.tenantIds === null) return undefined;
    return { id: { in: reach.tenantIds } };
  }
}
