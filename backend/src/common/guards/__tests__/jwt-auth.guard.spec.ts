import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { JwtAuthGuard } from '../jwt-auth.guard';

const SECRET = 'test-secret';

interface RequestLike {
  headers: { authorization?: string };
  user?: unknown;
}

function makeContext(authorization?: string): {
  context: ExecutionContext;
  req: RequestLike;
} {
  const req: RequestLike = { headers: { authorization } };
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, req };
}

describe('JwtAuthGuard', () => {
  let reflector: Reflector;
  let jwtService: JwtService;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = new JwtService({ secret: SECRET });
    const config = {
      getOrThrow: () => SECRET,
    } as unknown as ConfigService;
    guard = new JwtAuthGuard(reflector, jwtService, config);
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) =>
        key === IS_PUBLIC_KEY ? undefined : undefined,
      );
  });

  it('LIBERA rota @Public sem token', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => key === IS_PUBLIC_KEY);
    const { context } = makeContext();
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('LIBERA token de usuário da plataforma e popula req.user', async () => {
    const token = await jwtService.signAsync(
      { sub: 'u1', email: 'a@b.com' },
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    const { context, req } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: 'u1', email: 'a@b.com' });
  });

  it('BLOQUEIA (401) chatSessionToken mesmo com assinatura válida', async () => {
    // Mesmo segredo da plataforma, mas claim `type: chat-session` — token de
    // escopo restrito ao socket do chat, nunca credencial de rota HTTP.
    const token = await jwtService.signAsync(
      {
        sub: 'conv1',
        type: 'chat-session',
        conversationId: 'conv1',
        clientId: 'c1',
        systemId: 's1',
        requesterName: 'Visitante',
      },
      { algorithm: 'HS256', expiresIn: '2h' },
    );
    const { context } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('BLOQUEIA (401) qualquer token com claim `type` (escopo restrito)', async () => {
    const token = await jwtService.signAsync(
      { sub: 'x', email: 'a@b.com', type: 'password-reset' },
      { algorithm: 'HS256', expiresIn: '15m' },
    );
    const { context } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('BLOQUEIA (401) requisição sem token', async () => {
    const { context } = makeContext();
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('BLOQUEIA (401) token com assinatura inválida', async () => {
    const other = new JwtService({ secret: 'outro-segredo' });
    const token = await other.signAsync(
      { sub: 'u1', email: 'a@b.com' },
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    const { context } = makeContext(`Bearer ${token}`);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
