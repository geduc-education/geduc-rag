import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { Request } from 'express';
import { ERROR_CODES } from '../errors/error-codes';
import { TENANT_HEADER, TENANT_SCOPED_KEY } from './tenant-scoped.decorator';
import { TenantAccessService } from './tenant-access.service';

/**
 * Guard de tenancy. Roda depois do `JwtAuthGuard` e do `PermissionsGuard` e
 * só atua em rotas `@TenantScoped()`: exige `tenant-id` (UUID), confere o
 * vínculo `UserTenant` (SUPERADMIN passa) e popula `req.tenantId`.
 *
 * Tenant inexistente, inativo ou fora do alcance respondem o MESMO 403
 * `TENANT_OUT_OF_SCOPE` — não dá para enumerar tenants pelo header.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: TenantAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scoped = this.reflector.getAllAndOverride<boolean>(
      TENANT_SCOPED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!scoped) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException('Usuário não autenticado.');

    const tenantId = this.readHeader(request);
    if (!(await this.access.canAccess(userId, tenantId))) {
      throw new ForbiddenException({
        code: ERROR_CODES.TENANT_OUT_OF_SCOPE,
        message: 'Você não tem acesso a este tenant.',
      });
    }
    request.tenantId = tenantId;
    return true;
  }

  private readHeader(request: Request): string {
    const raw = request.headers[TENANT_HEADER];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (!value || !isUUID(value)) {
      throw new BadRequestException({
        code: ERROR_CODES.TENANT_REQUIRED,
        message: `Header ${TENANT_HEADER} é obrigatório (UUID do tenant).`,
      });
    }
    return value;
  }
}
