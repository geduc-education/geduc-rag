import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** Claims do JWT emitido pelo AuthModule. */
export interface JwtPayload {
  sub: string;
  email: string;
  /** Marcador de troca de senha obrigatória (MustChangePasswordGuard). */
  mustChangePassword?: boolean;
  /**
   * Reservado para tokens de escopo restrito assinados com o mesmo segredo.
   * Um token de usuário nunca carrega `type` — qualquer valor aqui é motivo de
   * rejeição.
   */
  type?: string;
}

/**
 * Usuário autenticado anexado a `req.user` pelo guard. Mantido enxuto (sem
 * tocar o banco) — permissões e tenants são resolvidos pelos guards seguintes.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  mustChangePassword: boolean;
}

/**
 * Guard de autenticação global. Verifica o Bearer token manualmente via
 * `@nestjs/jwt` (HS256, segredo `JWT_SECRET`) e popula `req.user`.
 *
 * Verificação manual (em vez de Passport strategy) de propósito: o guard não
 * depende do módulo de auth. A emissão do token é responsabilidade do
 * AuthService; aqui só validamos e projetamos as claims.
 *
 * `@Public()` libera a rota (ex.: /health, /auth/login).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token de autenticação ausente.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        // Fixa HS256 na verificação: rejeita tokens assinados com outro
        // algoritmo (anti algorithm-confusion, ex.: `none`/RS256).
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Token de autenticação inválido.');
    }
    // Tokens de escopo restrito (claim `type`) dividem o segredo, mas não são
    // credenciais de usuário — nunca acessam rota HTTP.
    if (payload.type !== undefined) {
      throw new UnauthorizedException('Token de autenticação inválido.');
    }
    request.user = {
      id: payload.sub,
      email: payload.email,
      mustChangePassword: payload.mustChangePassword ?? false,
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
  }
}
