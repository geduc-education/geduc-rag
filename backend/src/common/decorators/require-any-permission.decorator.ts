import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../rbac/permissions';

export const REQUIRE_ANY_PERMISSION_KEY = 'requireAnyPermission';

/**
 * Exige que o usuário autenticado possua AO MENOS UMA das permissões listadas
 * na sua permissão efetiva (união dos perfis) — semântica OR. Aplicado pelo
 * `PermissionsGuard`.
 *
 * Não combine com `@RequirePermissions` (AND) no mesmo handler: o guard trata
 * a combinação como erro de configuração e rejeita a request. Endpoints que
 * exigem uma combinação de permissões continuam com `@RequirePermissions`.
 *
 *   @RequireAnyPermission('ticket:read:all', 'ticket:assign')
 */
export const RequireAnyPermission = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSION_KEY, permissions);
