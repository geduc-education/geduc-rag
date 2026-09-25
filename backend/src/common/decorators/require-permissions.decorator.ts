import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../rbac/permissions';

export const REQUIRE_PERMISSIONS_KEY = 'requirePermissions';

/**
 * Exige que o usuário autenticado possua TODAS as permissões listadas na sua
 * permissão efetiva (união dos perfis). Aplicado pelo `PermissionsGuard`.
 *
 *   @RequirePermissions('user:manage')
 *   @RequirePermissions('ticket:assign', 'ticket:update')
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
