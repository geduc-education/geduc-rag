import { Prisma } from '@prisma/client';
import { buildEffectivePermissions } from '../../common/rbac/effective-permissions.service';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Seleção segura de User para respostas — NUNCA inclui passwordHash. É um
 * superset do `EFFECTIVE_PERMISSIONS_SELECT` (mesmo filtro de perfil ativo),
 * então o payload alimenta direto o `buildEffectivePermissions`: `/auth/me`,
 * respostas de usuário e o guard nunca divergem.
 */
export const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  active: true,
  mustChangePassword: true,
  isSuperAdmin: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  profiles: {
    where: { profile: { active: true, deletedAt: null } },
    orderBy: { profile: { name: 'asc' as const } },
    select: {
      profile: {
        select: {
          id: true,
          name: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  },
  // Tenant excluído sai da projeção (o vínculo órfão não concede nada).
  tenants: {
    where: { tenant: { deletedAt: null } },
    orderBy: { tenant: { name: 'asc' as const } },
    select: { tenant: { select: { id: true, name: true, slug: true } } },
  },
} satisfies Prisma.UserSelect;

export type UserWithRelations = Prisma.UserGetPayload<{
  select: typeof USER_SELECT;
}>;

/** Projeção única de User → resposta HTTP. */
export function toUserResponse(user: UserWithRelations): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    isSuperAdmin: user.isSuperAdmin,
    profiles: user.profiles.map(({ profile }) => ({
      id: profile.id,
      name: profile.name,
    })),
    tenants: user.tenants.map(({ tenant }) => tenant),
    permissions: buildEffectivePermissions(user).toSortedKeys(),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
