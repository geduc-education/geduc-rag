import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../database/prisma.service';
import { REQUIRE_ANY_PERMISSION_KEY } from '../../decorators/require-any-permission.decorator';
import { REQUIRE_PERMISSIONS_KEY } from '../../decorators/require-permissions.decorator';
import {
  EFFECTIVE_PERMISSIONS_SELECT,
  EffectivePermissionsService,
} from '../../rbac/effective-permissions.service';
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

/** User no formato do `EFFECTIVE_PERMISSIONS_SELECT` (um perfil por lista). */
function prismaUser(opts: {
  isSuperAdmin?: boolean;
  profiles?: string[][];
}): unknown {
  return {
    isSuperAdmin: opts.isSuperAdmin ?? false,
    profiles: (opts.profiles ?? []).map((keys) => ({
      profile: { permissions: keys.map((key) => ({ permission: { key } })) },
    })),
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
  let prisma: { user: { findFirst: jest.Mock } };
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    prisma = { user: { findFirst: jest.fn() } };
    guard = new PermissionsGuard(
      reflector,
      new EffectivePermissionsService(prisma as unknown as PrismaService),
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
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('401 sem usuário autenticado', async () => {
    mockMetadata({ all: [PERMISSIONS.USER_READ] });
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('401 quando o usuário não existe/está inativo (sessão inválida)', async () => {
    mockMetadata({ all: [PERMISSIONS.USER_READ] });
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(guard.canActivate(makeContext('u1'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('libera com a permissão vinda da UNIÃO dos perfis', async () => {
    mockMetadata({ all: [PERMISSIONS.USER_READ, PERMISSIONS.CHAT_QUERY] });
    prisma.user.findFirst.mockResolvedValue(
      prismaUser({
        profiles: [[PERMISSIONS.USER_READ], [PERMISSIONS.CHAT_QUERY]],
      }),
    );
    await expect(guard.canActivate(makeContext('u1'))).resolves.toBe(true);
  });

  it('exige TODAS as permissões listadas (AND) e lista as ausentes', async () => {
    mockMetadata({ all: [PERMISSIONS.USER_READ, PERMISSIONS.USER_MANAGE] });
    prisma.user.findFirst.mockResolvedValue(
      prismaUser({ profiles: [[PERMISSIONS.USER_READ]] }),
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
    prisma.user.findFirst.mockResolvedValue(
      prismaUser({ profiles: [[PERMISSIONS.USER_MANAGE]] }),
    );
    await expect(guard.canActivate(makeContext('u1'))).resolves.toBe(true);
  });

  it('@RequireAnyPermission nega sem nenhuma das chaves', async () => {
    mockMetadata({ anyOf: [PERMISSIONS.PROFILE_READ] });
    prisma.user.findFirst.mockResolvedValue(prismaUser({ profiles: [[]] }));
    await expect(guard.canActivate(makeContext('u1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('SUPERADMIN passa sem nenhuma permissão materializada', async () => {
    mockMetadata({ all: [PERMISSIONS.TENANT_MANAGE] });
    prisma.user.findFirst.mockResolvedValue(prismaUser({ isSuperAdmin: true }));
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

  it('usa o select único do EffectivePermissionsService, só usuário ativo', async () => {
    mockMetadata({ all: [PERMISSIONS.USER_READ] });
    prisma.user.findFirst.mockResolvedValue(
      prismaUser({ profiles: [[PERMISSIONS.USER_READ]] }),
    );
    await guard.canActivate(makeContext('u1'));
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'u1', active: true, deletedAt: null },
      select: EFFECTIVE_PERMISSIONS_SELECT,
    });
  });
});
