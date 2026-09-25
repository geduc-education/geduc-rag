import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';

export const TENANT_SCOPED_KEY = 'tenantScoped';

/** Header que carrega o tenant da requisição (mesmo nome do rag-api/front). */
export const TENANT_HEADER = 'tenant-id';

/**
 * Marca o controller/handler como escopado por tenant: o `TenantGuard` exige o
 * header `tenant-id`, valida o vínculo do usuário e popula `req.tenantId`.
 * Toda rota que lê/grava dado do RAG (documento, chunk, conversa) é escopada.
 */
export const TenantScoped = () => SetMetadata(TENANT_SCOPED_KEY, true);

/**
 * Injeta o `tenantId` já validado pelo `TenantGuard`. Só existe em rota
 * `@TenantScoped()` — usá-lo fora é erro de configuração (500), nunca um
 * tenant vindo direto do header sem checagem de vínculo.
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.tenantId) {
      throw new InternalServerErrorException(
        '@TenantId() usado em rota sem @TenantScoped().',
      );
    }
    return request.tenantId;
  },
);
