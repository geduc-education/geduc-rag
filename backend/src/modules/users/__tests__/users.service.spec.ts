import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  EffectivePermissions,
  EffectivePermissionsService,
} from '../../../common/rbac/effective-permissions.service';
import {
  TenantAccessService,
  TenantReach,
} from '../../../common/tenancy/tenant-access.service';
import { PrismaService } from '../../../database/prisma.service';
import { UsersService } from '../users.service';

jest.mock('argon2', () => ({ hash: jest.fn(() => Promise.resolve('hash')) }));

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';

/** Linha no formato do USER_SELECT. */
function userRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u2',
    name: 'Maria',
    email: 'maria@empresa.com',
    active: true,
    mustChangePassword: true,
    isSuperAdmin: false,
    lastLoginAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    profiles: [],
    tenants: [{ tenant: { id: TENANT_A, name: 'A', slug: 'a' } }],
    ...overrides,
  };
}

function makePrisma() {
  return {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    profile: { findMany: jest.fn() },
    tenant: { count: jest.fn() },
    userTenant: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let reach: TenantReach;
  let permissionKeys: string[];
  let service: UsersService;

  beforeEach(() => {
    prisma = makePrisma();
    reach = { superAdmin: false, tenantIds: [TENANT_A] };
    permissionKeys = ['user:read', 'user:manage'];
    const tenantAccess = {
      reachOf: jest.fn(() => Promise.resolve(reach)),
    } as unknown as TenantAccessService;
    const permissions = {
      load: jest.fn(() =>
        Promise.resolve(
          new EffectivePermissions(reach.superAdmin, new Set(permissionKeys)),
        ),
      ),
    } as unknown as EffectivePermissionsService;
    service = new UsersService(
      prisma as unknown as PrismaService,
      permissions,
      tenantAccess,
    );
  });

  const baseCreate = {
    name: 'Maria',
    email: 'Maria@Empresa.com',
    password: 'Senha!123',
  };

  describe('create', () => {
    it('exige tenant para quem não é SUPERADMIN', async () => {
      await expect(service.create(baseCreate, 'actor')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('nega tenant fora do alcance do ator', async () => {
      await expect(
        service.create({ ...baseCreate, tenantIds: [TENANT_B] }, 'actor'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('nega perfil com permissão que o ator não tem', async () => {
      prisma.tenant.count.mockResolvedValue(1);
      prisma.profile.findMany.mockResolvedValue([
        { permissions: [{ permission: { key: 'tenant:manage' } }] },
      ]);
      await expect(
        service.create(
          { ...baseCreate, tenantIds: [TENANT_A], profileIds: [PROFILE] },
          'actor',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('409 neutro quando o e-mail já existe', async () => {
      prisma.tenant.count.mockResolvedValue(1);
      prisma.user.findUnique.mockResolvedValue({ id: 'outro' });
      await expect(
        service.create({ ...baseCreate, tenantIds: [TENANT_A] }, 'actor'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('cria com e-mail normalizado, troca de senha obrigatória e vínculos', async () => {
      prisma.tenant.count.mockResolvedValue(1);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(userRow());

      const result = await service.create(
        { ...baseCreate, tenantIds: [TENANT_A] },
        'actor',
      );

      const [[args]] = prisma.user.create.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(args.data).toMatchObject({
        email: 'maria@empresa.com',
        passwordHash: 'hash',
        mustChangePassword: true,
        tenants: { create: [{ tenantId: TENANT_A }] },
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.tenants).toEqual([{ id: TENANT_A, name: 'A', slug: 'a' }]);
    });
  });

  describe('alcance', () => {
    it('404 para usuário fora do alcance (sem tenant em comum)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.findOne('u9', 'actor')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { id: 'u9', deletedAt: null },
              { tenants: { some: { tenantId: { in: [TENANT_A] } } } },
            ],
          },
        }),
      );
    });
  });

  describe('update / remove', () => {
    it('administrador comum não altera o SUPERADMIN', async () => {
      prisma.user.findFirst.mockResolvedValue(userRow({ isSuperAdmin: true }));
      await expect(
        service.update('u2', { name: 'X' }, 'actor'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('ninguém exclui a si mesmo', async () => {
      prisma.user.findFirst.mockResolvedValue(userRow({ id: 'actor' }));
      await expect(service.remove('actor', 'actor')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('exclusão é lógica (deletedAt + inativa)', async () => {
      prisma.user.findFirst.mockResolvedValue(userRow());
      await service.remove('u2', 'actor');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: expect.objectContaining({
          active: false,
          deletedById: 'actor',
          deletedAt: expect.any(Date) as Date,
        }) as object,
      });
    });
  });

  describe('resetPassword', () => {
    it('409 para usuário inativo', async () => {
      prisma.user.findFirst.mockResolvedValue(userRow({ active: false }));
      await expect(
        service.resetPassword('u2', { password: 'Nova!1234' }, 'actor'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('grava a nova senha e religa a troca obrigatória', async () => {
      prisma.user.findFirst.mockResolvedValue(userRow());
      await service.resetPassword('u2', { password: 'Nova!1234' }, 'actor');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: {
          passwordHash: 'hash',
          mustChangePassword: true,
          updatedById: 'actor',
        },
      });
    });
  });
});
