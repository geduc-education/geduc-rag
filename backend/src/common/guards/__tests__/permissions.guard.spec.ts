import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ANY_PERMISSION_KEY } from '../../decorators/require-any-permission.decorator';
import { REQUIRE_PERMISSIONS_KEY } from '../../decorators/require-permissions.decorator';
import { EffectivePermissionsService } from '../../rbac/effective-permissions.service';
import { PERMISSIONS } from '../../rbac/permissions';
import { PermissionsGuard } from '../permissions.guard';

/** Mocka um ExecutionContext HTTP com um req.user opcional. */
function makeContext(userId?: string): ExecutionContext {
  const req = { user: userId ? { id: userId } : undefined };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

/** Grants como o repositório devolve (um perfil por lista; chaves unidas). */
function grantsOf(opts: {
  isSuperAdmin?: boolean;
  profiles?: string[][];
}): unknown {
  return {
    isSuperAdmin: opts.isSuperAdmin ?? false,
    permissionKeys: (opts.profiles ?? []).flat(),
  };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('esperava rejeição');
}

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let repository: { findActiveUserGrants: jest.Mock };
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    repository = { findActiveUserGrants: jest.fn() };
    guard = new PermissionsGuard(
      reflector,
      new EffectivePermissionsService(repository),
    );
  });

  /** O guard lê duas metadatas distintas (AND e OR); o mock resolve por chave. */
  function mockMetadata(opts: { all?: string[]; anyOf?: string[] }): void {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: unknown) => {
        if (key === REQUIRE_PERMISSIONS_KEY) return opts.all;
        if (key === REQUIRE_ANY_PERMISSION_KEY) return opts.anyOf;
        return undefined;
      });
  }

  it('libera rota sem metadata de permissão (no-op, sem tocar o banco)', async () => {
    mockMetadata({});
    await expect(guard.canActivate(makeContext('u1'))).resolves.toBe(true);
    expect(repository.findActiveUserGrants).not.toHaveBeenCalled();
  });

  it('401 sem usuário autenticado', async () => {
    mockMetadata({ all: [PERMISSIONS.USER_READ] });
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('401 quando o usuário não existe/está inativo (sessão inválida)', async () => {
    mockMetadata({ all: [PERMISSIONS.USER_READ] });
    repository.findActiveUserGrants.mockResolvedValue(null);
    await expect(guard.canActivate(makeContext('u1'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('libera com a permissão vinda da UNIÃO dos perfis', async () => {
    mockMetadata({ all: [PERMISSIONS.USER_READ, PERMISSIONS.CHAT_QUERY] });
    repository.findActiveUserGrants.mockResolvedValue(
      grantsOf({
        profiles: [[PERMISSIONS.USER_READ], [PERMISSIONS.CHAT_QUERY]],
      }),
    );
    await expect(guard.canActivate(makeContext('u1'))).resolves.toBe(true);
  });

  it('exige TODAS as permissões listadas (AND) e lista as ausentes', async () => {
    mockMetadata({ all: [PERMISSIONS.USER_READ, PERMISSIONS.USER_MANAGE] });
    repository.findActiveUserGrants.mockResolvedValue(
      grantsOf({ profiles: [[PERMISSIONS.USER_READ]] }),
    );
    const error = await rejection(guard.canActivate(makeContext('u1')));
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'FORBIDDEN_PERMISSION',
      details: { missing: [PERMISSIONS.USER_MANAGE] },
    });
  });

  it('@RequireAnyPermission libera com UMA das chaves', async () => {
    mockMetadata({
      anyOf: [PERMISSIONS.PROFILE_READ, PERMISSIONS.USER_MANAGE],
    });
    repository.findActiveUserGrants.mockResolvedValue(
      grantsOf({ profiles: [[PERMISSIONS.USER_MANAGE]] }),
    );
    await expect(guard.canActivate(makeContext('u1'))).resolves.toBe(true);
  });

  it('@RequireAnyPermission nega sem nenhuma das chaves', async () => {
    mockMetadata({ anyOf: [PERMISSIONS.PROFILE_READ] });
    repository.findActiveUserGrants.mockResolvedValue(
      grantsOf({ profiles: [[]] }),
    );
    await expect(guard.canActivate(makeContext('u1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('SUPERADMIN passa sem nenhuma permissão materializada', async () => {
    mockMetadata({ all: [PERMISSIONS.TENANT_MANAGE] });
    repository.findActiveUserGrants.mockResolvedValue(
      grantsOf({ isSuperAdmin: true }),
    );
    await expect(guard.canActivate(makeContext('u1'))).resolves.toBe(true);
  });

  it('combinar AND e OR no mesmo handler é erro de configuração', async () => {
    mockMetadata({
      all: [PERMISSIONS.USER_READ],
      anyOf: [PERMISSIONS.USER_MANAGE],
    });
    await expect(guard.canActivate(makeContext('u1'))).rejects.toThrow(
      /não podem ser combinados/,
    );
  });

  it('consulta o repositório único de permissão efetiva pelo id do usuário', async () => {
    mockMetadata({ all: [PERMISSIONS.USER_READ] });
    repository.findActiveUserGrants.mockResolvedValue(
      grantsOf({ profiles: [[PERMISSIONS.USER_READ]] }),
    );
    await guard.canActivate(makeContext('u1'));
    expect(repository.findActiveUserGrants).toHaveBeenCalledWith('u1');
  });
});
