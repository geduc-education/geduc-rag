import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  EffectivePermissions,
  EffectivePermissionsService,
} from '../rbac/effective-permissions.service';
import { PermissionKey } from '../rbac/permissions';
import { ERROR_CODES } from '../errors/error-codes';
import { REQUIRE_ANY_PERMISSION_KEY } from '../decorators/require-any-permission.decorator';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

/**
 * Guard de autorização granular. Roda depois do JwtAuthGuard (que popula
 * req.user). Só atua em rotas anotadas com `@RequirePermissions(...)` (AND —
 * todas as chaves) ou `@RequireAnyPermission(...)` (OR — ao menos uma); nas
 * demais é no-op (a autenticação já foi garantida pelo guard global). Os dois
 * decorators NÃO se combinam no mesmo handler — a combinação é erro de
 * configuração e derruba a request (500), nunca libera acesso.
 *
 * A permissão efetiva (união dos perfis) é global; o escopo de DADO vem do
 * vínculo com o tenant, aplicado depois pelo `TenantGuard` nas rotas
 * `@TenantScoped()` e pelos services de cadastro via `TenantAccessService`.
 *
 * A permissão efetiva vem do `EffectivePermissionsService` (fonte única do
 * RBAC): o guard NÃO refaz a query. O SUPERADMIN de bootstrap tem bypass. As
 * permissões vêm do banco (o JWT não as carrega) — resolvidas por request.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: EffectivePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.metadata(context, REQUIRE_PERMISSIONS_KEY);
    const anyOf = this.metadata(context, REQUIRE_ANY_PERMISSION_KEY);
    if (required.length > 0 && anyOf.length > 0) {
      throw new Error(
        '@RequirePermissions e @RequireAnyPermission não podem ser ' +
          'combinados no mesmo handler.',
      );
    }
    if (required.length === 0 && anyOf.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }

    const effective = await this.permissions.load(userId);
    if (!effective) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    if (required.length > 0) this.assertHasAll(required, effective);
    if (anyOf.length > 0) this.assertHasAny(anyOf, effective);
    return true;
  }

  /** Lê a metadata de permissões (handler sobrepõe classe); ausente = []. */
  private metadata(context: ExecutionContext, key: string): PermissionKey[] {
    return (
      this.reflector.getAllAndOverride<PermissionKey[]>(key, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []
    );
  }

  /** AND (`@RequirePermissions`): exige TODAS as chaves na permissão efetiva. */
  private assertHasAll(
    required: PermissionKey[],
    effective: EffectivePermissions,
  ): void {
    const missing = required.filter((p) => !effective.has(p));
    if (missing.length === 0) return;
    throw new ForbiddenException({
      code: ERROR_CODES.FORBIDDEN_PERMISSION,
      message: 'Você não tem permissão para esta ação.',
      details: { missing },
    });
  }

  /** OR (`@RequireAnyPermission`): exige AO MENOS UMA chave na efetiva. */
  private assertHasAny(
    anyOf: PermissionKey[],
    effective: EffectivePermissions,
  ): void {
    if (anyOf.some((p) => effective.has(p))) return;
    throw new ForbiddenException({
      code: ERROR_CODES.FORBIDDEN_PERMISSION,
      message: 'Você não tem permissão para esta ação.',
      details: { anyOf },
    });
  }
}
