import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { ALLOW_PWD_CHANGE_PENDING_KEY } from '../../decorators/allow-password-change-pending.decorator';
import { MustChangePasswordGuard } from '../must-change-password.guard';

function makeContext(mustChangePassword: boolean): ExecutionContext {
  const req = { user: { id: 'u1', mustChangePassword } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('MustChangePasswordGuard', () => {
  let reflector: Reflector;
  let guard: MustChangePasswordGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new MustChangePasswordGuard(reflector);
  });

  /** Simula as metadatas: mapeia a KEY consultada para o valor booleano. */
  function withMetadata(meta: Record<string, boolean>): void {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => meta[key]);
  }

  it('BLOQUEIA (403 PASSWORD_CHANGE_REQUIRED) rota comum quando pendente', () => {
    withMetadata({});
    try {
      guard.canActivate(makeContext(true));
      fail('esperava ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }
  });

  it('LIBERA rota comum quando não há troca pendente', () => {
    withMetadata({});
    expect(guard.canActivate(makeContext(false))).toBe(true);
  });

  it('LIBERA rota @AllowPasswordChangePending mesmo com troca pendente', () => {
    withMetadata({ [ALLOW_PWD_CHANGE_PENDING_KEY]: true });
    expect(guard.canActivate(makeContext(true))).toBe(true);
  });

  it('LIBERA rota @Public mesmo com troca pendente', () => {
    withMetadata({ [IS_PUBLIC_KEY]: true });
    expect(guard.canActivate(makeContext(true))).toBe(true);
  });
});
