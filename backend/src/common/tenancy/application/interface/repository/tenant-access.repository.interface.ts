export const TENANT_ACCESS_REPOSITORY = 'ITenantAccessRepository';

/** Vínculos usuário ↔ tenant (só tenants não excluídos). */
export interface UserTenantLinks {
  isSuperAdmin: boolean;
  tenantIds: string[];
}

export interface ITenantAccessRepository {
  /** `null` quando o usuário não existe, está inativo ou excluído. */
  findActiveUserTenants(userId: string): Promise<UserTenantLinks | null>;
  /** `true` só para tenant ativo e não excluído. */
  isTenantActive(tenantId: string): Promise<boolean>;
}
