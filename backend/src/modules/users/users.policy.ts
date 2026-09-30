import { ForbiddenException } from '@nestjs/common';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { EffectivePermissions } from '../../common/rbac/effective-permissions.service';
import { TenantReach } from '../../common/tenancy/tenant-access.service';

/**
 * Regras de autorização do cadastro de usuários — funções puras, sem I/O,
 * para o service compor e os testes exercitarem isoladamente.
 *
 * Três barreiras, todas no service (o `@RequirePermissions` do controller é só
 * o gate de "pode gerenciar usuários"):
 * 1. **Alcance**: o ator só enxerga/opera usuários que compartilham ao menos
 *    um tenant com ele (SUPERADMIN enxerga todos).
 * 2. **Tenants**: só se vincula/desvincula tenant do alcance do ator.
 * 3. **Perfis**: ninguém concede (nem retira) permissão que não tem.
 */

/** Ator autenticado com permissão efetiva e alcance de tenant resolvidos. */
export interface UserActor {
  id: string;
  reach: TenantReach;
  permissions: EffectivePermissions;
}

/** Elementos que entram OU saem ao trocar `current` por `next`. */
export function changedIds(current: string[], next: string[]): string[] {
  const before = new Set(current);
  const after = new Set(next);
  return [
    ...next.filter((id) => !before.has(id)),
    ...current.filter((id) => !after.has(id)),
  ];
}

/**
 * Todo tenant vinculado ou desvinculado precisa estar no alcance do ator.
 * Sem isto um administrador do tenant A se vincularia ao B e leria os
 * documentos dele.
 */
export function assertTenantsGrantable(
  reach: TenantReach,
  current: string[],
  next: string[],
): void {
  if (reach.tenantIds === null) return;
  const own = new Set(reach.tenantIds);
  const outside = changedIds(current, next).filter((id) => !own.has(id));
  if (outside.length === 0) return;
  throw new ForbiddenException({
    code: ERROR_CODES.TENANT_NOT_GRANTABLE,
    message:
      'Você não pode vincular ou desvincular tenants fora do seu acesso.',
    details: { tenantIds: outside },
  });
}

/**
 * Conjunto final de tenants num `PUT /users/:id/tenants`: o pedido do ator
 * mais os vínculos do usuário que o ator não enxerga (preservados).
 */
export function mergeTenantAssignment(
  reach: TenantReach,
  current: string[],
  requested: string[],
): string[] {
  if (reach.tenantIds === null) return requested;
  const own = new Set(reach.tenantIds);
  const preserved = current.filter((id) => !own.has(id));
  return [...new Set([...requested, ...preserved])];
}

/**
 * "Ninguém concede o que não tem": toda permissão dos perfis que entram ou
 * saem precisa estar na permissão efetiva do ator (SUPERADMIN passa).
 */
export function assertPermissionsGrantable(
  actor: EffectivePermissions,
  keys: Iterable<string>,
): void {
  const missing = [...new Set(keys)].filter((key) => !actor.has(key)).sort();
  if (missing.length === 0) return;
  throw new ForbiddenException({
    code: ERROR_CODES.PERMISSION_NOT_GRANTABLE,
    message: 'Você não pode atribuir perfis com permissões que não possui.',
    details: { missing },
  });
}

/** Alvo mínimo para as regras de proteção. */
export interface ProtectionTarget {
  id: string;
  isSuperAdmin: boolean;
}

/** O SUPERADMIN de bootstrap só é alterado por outro SUPERADMIN. */
export function assertCanModify(
  actor: UserActor,
  target: ProtectionTarget,
): void {
  if (!target.isSuperAdmin || actor.reach.superAdmin) return;
  throw new ForbiddenException({
    code: ERROR_CODES.USER_PROTECTED,
    message: 'Este usuário é protegido e não pode ser alterado.',
  });
}

/**
 * Inativar/excluir: nunca o SUPERADMIN de bootstrap e nunca a si mesmo (o
 * ator perderia o acesso no meio da operação).
 */
export function assertCanDisable(
  actor: UserActor,
  target: ProtectionTarget,
): void {
  if (target.isSuperAdmin) {
    throw new ForbiddenException({
      code: ERROR_CODES.USER_PROTECTED,
      message: 'O super administrador não pode ser inativado nem excluído.',
    });
  }
  if (target.id === actor.id) {
    throw new ForbiddenException({
      code: ERROR_CODES.USER_SELF_ACTION,
      message: 'Você não pode inativar nem excluir o próprio usuário.',
    });
  }
}

/** Normaliza o e-mail (identidade única, comparação case-insensitive). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
