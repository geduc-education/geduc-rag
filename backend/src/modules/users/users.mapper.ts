import { buildEffectivePermissions } from '../../common/rbac/effective-permissions.service';
import type { UserAggregate } from './application/interface/repository/user.repository.interface';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Projeção única de `UserAggregate` → resposta HTTP (NUNCA inclui
 * passwordHash). As chaves passam pelo `buildEffectivePermissions`: `/auth/me`,
 * respostas de usuário e o guard nunca divergem.
 */
export function toUserResponse(user: UserAggregate): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    isSuperAdmin: user.isSuperAdmin,
    profiles: user.profiles.map(({ id, name }) => ({ id, name })),
    tenants: user.tenants.map(({ id, name, slug }) => ({ id, name, slug })),
    permissions: buildEffectivePermissions({
      isSuperAdmin: user.isSuperAdmin,
      permissionKeys: user.permissionKeys,
    }).toSortedKeys(),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
