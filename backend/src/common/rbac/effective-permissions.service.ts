import { Inject, Injectable } from '@nestjs/common';
import {
  EFFECTIVE_PERMISSIONS_REPOSITORY,
  type IEffectivePermissionsRepository,
  type UserGrants,
} from './application/interface/repository/effective-permissions.repository.interface';

/**
 * Permissão efetiva do usuário = união das permissões dos perfis ativos.
 * SUPERADMIN tem bypass (`has` sempre verdadeiro) sem materializar chave.
 */
export class EffectivePermissions {
  constructor(
    readonly superAdmin: boolean,
    readonly keys: ReadonlySet<string>,
  ) {}

  has(permission: string): boolean {
    return this.superAdmin || this.keys.has(permission);
  }

  /** União ordenada (saída estável para `/auth/me` e respostas de usuário). */
  toSortedKeys(): string[] {
    return [...this.keys].sort();
  }
}

/**
 * Uma implementação só da união: guard, services e `/auth/me` passam por aqui
 * — a query vive em `IEffectivePermissionsRepository`, nunca reescrita em
 * outro lugar. Perfil inativo ou excluído já chega fora de `permissionKeys`.
 */
export function buildEffectivePermissions(
  grants: UserGrants,
): EffectivePermissions {
  return new EffectivePermissions(
    grants.isSuperAdmin,
    new Set(grants.permissionKeys),
  );
}

@Injectable()
export class EffectivePermissionsService {
  constructor(
    @Inject(EFFECTIVE_PERMISSIONS_REPOSITORY)
    private readonly repository: IEffectivePermissionsRepository,
  ) {}

  /**
   * Resolve a permissão efetiva a partir do banco (o JWT não carrega
   * permissões). `null` quando o usuário não existe, foi excluído ou está
   * inativo — o chamador trata como sessão inválida.
   */
  async load(userId: string): Promise<EffectivePermissions | null> {
    const grants = await this.repository.findActiveUserGrants(userId);
    return grants ? buildEffectivePermissions(grants) : null;
  }
}
