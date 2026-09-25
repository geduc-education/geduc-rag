import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ERROR_CODES } from '../errors/error-codes';
import { ALLOW_PWD_CHANGE_PENDING_KEY } from '../decorators/allow-password-change-pending.decorator';

/**
 * Bloqueia todas as rotas autenticadas enquanto o usuário tiver
 * `mustChangePassword=true` (troca obrigatória no 1º acesso). Rotas públicas
 * (@Public) e as marcadas com @AllowPasswordChangePending (trocar senha,
 * logout, /auth/me) passam. A flag vem da claim do JWT (populada pelo
 * JwtAuthGuard) — barata, sem tocar o banco.
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PWD_CHANGE_PENDING_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (request.user?.mustChangePassword) {
      throw new ForbiddenException({
        code: ERROR_CODES.PASSWORD_CHANGE_REQUIRED,
        message: 'Troca de senha obrigatória antes de continuar.',
      });
    }
    return true;
  }
}
