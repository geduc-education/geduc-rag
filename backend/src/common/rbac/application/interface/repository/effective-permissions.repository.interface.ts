export const EFFECTIVE_PERMISSIONS_REPOSITORY =
  'IEffectivePermissionsRepository';

/** Insumo da permissão efetiva: flag de SUPERADMIN + chaves dos perfis ativos. */
export interface UserGrants {
  isSuperAdmin: boolean;
  permissionKeys: readonly string[];
}

export interface IEffectivePermissionsRepository {
  /**
   * Grants do usuário ativo e não excluído; chaves só de perfis ativos e não
   * excluídos. `null` quando o usuário não existe, está inativo ou excluído.
   */
  findActiveUserGrants(userId: string): Promise<UserGrants | null>;
}
