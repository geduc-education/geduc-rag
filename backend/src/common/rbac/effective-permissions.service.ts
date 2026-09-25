import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * Projeção mínima de User para calcular a permissão efetiva. Uma implementação
 * só da união: guard, services e `/auth/me` passam por
 * `buildEffectivePermissions` — nunca reescreva essa query em outro lugar.
 * Perfil inativo ou excluído não concede nada.
 */
export const EFFECTIVE_PERMISSIONS_SELECT = {
  isSuperAdmin: true,
  profiles: {
    where: { profile: { active: true, deletedAt: null } },
    select: {
      profile: {
        select: {
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

export type UserWithEffectivePermissions = Prisma.UserGetPayload<{
  select: typeof EFFECTIVE_PERMISSIONS_SELECT;
}>;

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

export function buildEffectivePermissions(
  user: UserWithEffectivePermissions,
): EffectivePermissions {
  const keys = new Set<string>();
  for (const link of user.profiles) {
    for (const grant of link.profile.permissions) {
      keys.add(grant.permission.key);
    }
  }
  return new EffectivePermissions(user.isSuperAdmin, keys);
}

@Injectable()
export class EffectivePermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a permissão efetiva a partir do banco (o JWT não carrega
   * permissões). `null` quando o usuário não existe, foi excluído ou está
   * inativo — o chamador trata como sessão inválida.
   */
  async load(userId: string): Promise<EffectivePermissions | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, active: true, deletedAt: null },
      select: EFFECTIVE_PERMISSIONS_SELECT,
    });
    return user ? buildEffectivePermissions(user) : null;
  }
}
