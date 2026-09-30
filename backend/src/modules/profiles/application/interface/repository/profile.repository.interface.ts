export const PROFILE_REPOSITORY = 'IProfileRepository';

/** Perfil com as chaves de permissão (ordenadas). */
export interface ProfileWithPermissions {
  id: string;
  name: string;
  description: string | null;
  system: boolean;
  permissionKeys: string[];
}

export interface IProfileRepository {
  /** Perfis ativos e não excluídos, por nome. */
  listActive(): Promise<ProfileWithPermissions[]>;
  /** Perfis ativos e não excluídos entre `ids`; `[]` não consulta o banco. */
  findActiveByIds(ids: readonly string[]): Promise<ProfileWithPermissions[]>;
}
