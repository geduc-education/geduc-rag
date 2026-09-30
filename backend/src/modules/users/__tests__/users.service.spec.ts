import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
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
import type { IProfileRepository } from '../../profiles/application/interface/repository/profile.repository.interface';
import type { ITenantRepository } from '../../tenants/application/interface/repository/tenant.repository.interface';
import type {
  IUserRepository,
  UserAggregate,
} from '../application/interface/repository/user.repository.interface';
import { UsersService } from '../users.service';

jest.mock('argon2', () => ({ hash: jest.fn(() => Promise.resolve('hash')) }));

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';

function aggregate(overrides: Partial<UserAggregate> = {}): UserAggregate {
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
    tenants: [{ id: TENANT_A, name: 'A', slug: 'a' }],
    permissionKeys: [],
    ...overrides,
  };
}

function makeUsers() {
  return {
    list: jest.fn(),
    findInScope: jest.fn(),
    findActiveById: jest.fn(),
    findById: jest.fn(),
    findCredentialsByEmail: jest.fn(),
    findActiveCredentialsById: jest.fn(),
    findIdByEmail: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(),
    update: jest.fn(),
    replaceTenants: jest.fn(),
    updatePassword: jest.fn(),
    touchLastLogin: jest.fn(),
    softDelete: jest.fn(),
  } satisfies Record<keyof IUserRepository, jest.Mock>;
}

function makeProfiles() {
  return {
    listActive: jest.fn(),
    findActiveByIds: jest.fn(() => Promise.resolve([])),
  } satisfies Record<keyof IProfileRepository, jest.Mock>;
}

function makeTenants() {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    countExisting: jest.fn((ids: readonly string[]) =>
      Promise.resolve(ids.length),
    ),
  } satisfies Record<keyof ITenantRepository, jest.Mock>;
}

function codeOf(error: unknown): string | undefined {
  if (!(error instanceof HttpException)) return undefined;
  return (error.getResponse() as { code?: string }).code;
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('esperava rejeição');
}

describe('UsersService', () => {
  let users: ReturnType<typeof makeUsers>;
  let profiles: ReturnType<typeof makeProfiles>;
  let tenants: ReturnType<typeof makeTenants>;
  let reach: TenantReach;
  let permissionKeys: string[];
  let service: UsersService;

  beforeEach(() => {
    users = makeUsers();
    profiles = makeProfiles();
    tenants = makeTenants();
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
      users as unknown as IUserRepository,
      profiles as unknown as IProfileRepository,
      tenants as unknown as ITenantRepository,
      permissions,
      tenantAccess,
    );
  });

  const baseCreate = {
    name: 'Maria',
    email: 'Maria@Empresa.com',
    password: 'Senha!123',
  };

  describe('list', () => {
    it('passa o alcance do ator e a paginação padrão ao repositório', async () => {
      users.list.mockResolvedValue({ data: [aggregate()], total: 1 });

      const result = await service.list({}, 'actor');

      expect(users.list).toHaveBeenCalledWith(
        expect.objectContaining({ scope: [TENANT_A], page: 1, limit: 20 }),
      );
      expect(result.total).toBe(1);
      expect(result.data[0]).not.toHaveProperty('passwordHash');
    });

    it('SUPERADMIN lista com escopo "all" e repassa os filtros', async () => {
      reach = { superAdmin: true, tenantIds: null };
      users.list.mockResolvedValue({ data: [], total: 0 });

      await service.list(
        { active: true, tenantId: TENANT_B, search: 'ma', page: 2, limit: 5 },
        'actor',
      );

      expect(users.list).toHaveBeenCalledWith({
        scope: 'all',
        active: true,
        tenantId: TENANT_B,
        search: 'ma',
        page: 2,
        limit: 5,
      });
    });
  });

  describe('create', () => {
    it('exige tenant para quem não é SUPERADMIN', async () => {
      await expect(service.create(baseCreate, 'actor')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(users.create).not.toHaveBeenCalled();
    });

    it('nega tenant fora do alcance do ator (TENANT_NOT_GRANTABLE)', async () => {
      const error = await rejection(
        service.create({ ...baseCreate, tenantIds: [TENANT_B] }, 'actor'),
      );
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(codeOf(error)).toBe('TENANT_NOT_GRANTABLE');
      expect(users.create).not.toHaveBeenCalled();
    });

    it('400 TENANT_NOT_FOUND quando algum tenant não existe', async () => {
      tenants.countExisting.mockResolvedValue(0);
      const error = await rejection(
        service.create({ ...baseCreate, tenantIds: [TENANT_A] }, 'actor'),
      );
      expect(codeOf(error)).toBe('TENANT_NOT_FOUND');
      expect(tenants.countExisting).toHaveBeenCalledWith([TENANT_A]);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('nega perfil com permissão que o ator não tem, sem escrita', async () => {
      profiles.findActiveByIds.mockResolvedValue([
        {
          id: PROFILE,
          name: 'Gestor',
          description: null,
          system: false,
          permissionKeys: ['tenant:manage'],
        },
      ]);
      const error = await rejection(
        service.create(
          { ...baseCreate, tenantIds: [TENANT_A], profileIds: [PROFILE] },
          'actor',
        ),
      );
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(codeOf(error)).toBe('PERMISSION_NOT_GRANTABLE');
      expect(profiles.findActiveByIds).toHaveBeenCalledWith([PROFILE]);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('400 PROFILE_NOT_FOUND quando o perfil não existe ou está inativo', async () => {
      const error = await rejection(
        service.create(
          { ...baseCreate, tenantIds: [TENANT_A], profileIds: [PROFILE] },
          'actor',
        ),
      );
      expect(codeOf(error)).toBe('PROFILE_NOT_FOUND');
      expect(users.create).not.toHaveBeenCalled();
    });

    it('409 neutro quando o e-mail já existe', async () => {
      users.findIdByEmail.mockResolvedValue('outro' as never);
      const error = await rejection(
        service.create({ ...baseCreate, tenantIds: [TENANT_A] }, 'actor'),
      );
      expect(error).toBeInstanceOf(ConflictException);
      expect(codeOf(error)).toBe('EMAIL_UNAVAILABLE');
      expect(users.findIdByEmail).toHaveBeenCalledWith('maria@empresa.com');
      expect(users.create).not.toHaveBeenCalled();
    });

    it('409 EMAIL_UNAVAILABLE quando o unique do banco decide a corrida', async () => {
      users.create.mockRejectedValue({ code: 'ER_DUP_ENTRY', errno: 1062 });
      const error = await rejection(
        service.create({ ...baseCreate, tenantIds: [TENANT_A] }, 'actor'),
      );
      expect(error).toBeInstanceOf(ConflictException);
      expect(codeOf(error)).toBe('EMAIL_UNAVAILABLE');
    });

    it('propaga erro de banco que não é de duplicidade', async () => {
      const boom = new Error('boom');
      users.create.mockRejectedValue(boom);
      await expect(
        service.create({ ...baseCreate, tenantIds: [TENANT_A] }, 'actor'),
      ).rejects.toBe(boom);
    });

    it('cria com e-mail normalizado e vínculos, e devolve a projeção', async () => {
      users.create.mockResolvedValue('u2');
      users.findById.mockResolvedValue(aggregate());

      const result = await service.create(
        { ...baseCreate, tenantIds: [TENANT_A] },
        'actor',
      );

      expect(users.create).toHaveBeenCalledWith({
        name: 'Maria',
        email: 'maria@empresa.com',
        passwordHash: 'hash',
        active: true,
        createdById: 'actor',
        profileIds: [],
        tenantIds: [TENANT_A],
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.tenants).toEqual([{ id: TENANT_A, name: 'A', slug: 'a' }]);
    });
  });

  describe('alcance', () => {
    it('404 para usuário fora do alcance (sem tenant em comum)', async () => {
      users.findInScope.mockResolvedValue(null);
      const error = await rejection(service.findOne('u9', 'actor'));
      expect(error).toBeInstanceOf(NotFoundException);
      expect(codeOf(error)).toBe('USER_NOT_FOUND');
      expect(users.findInScope).toHaveBeenCalledWith('u9', [TENANT_A]);
    });
  });

  describe('update / remove', () => {
    it('administrador comum não altera o SUPERADMIN (USER_PROTECTED)', async () => {
      users.findInScope.mockResolvedValue(aggregate({ isSuperAdmin: true }));
      const error = await rejection(
        service.update('u2', { name: 'X' }, 'actor'),
      );
      expect(codeOf(error)).toBe('USER_PROTECTED');
      expect(users.update).not.toHaveBeenCalled();
    });

    it('troca perfis conferindo só os que entram ou saem', async () => {
      users.findInScope.mockResolvedValue(
        aggregate({ profiles: [{ id: 'p-old', name: 'Antigo' }] }),
      );
      profiles.findActiveByIds.mockResolvedValue([
        {
          id: PROFILE,
          name: 'Leitor',
          description: null,
          system: false,
          permissionKeys: ['user:read'],
        },
        {
          id: 'p-old',
          name: 'Antigo',
          description: null,
          system: false,
          permissionKeys: [],
        },
      ]);

      await service.update(
        'u2',
        { name: ' Maria ', profileIds: [PROFILE] },
        'actor',
      );

      expect(profiles.findActiveByIds).toHaveBeenCalledWith([PROFILE, 'p-old']);
      expect(users.update).toHaveBeenCalledWith('u2', {
        name: 'Maria',
        email: undefined,
        active: undefined,
        updatedById: 'actor',
        profileIds: [PROFILE],
      });
    });

    it('409 EMAIL_UNAVAILABLE na corrida do update', async () => {
      users.findInScope.mockResolvedValue(aggregate());
      users.update.mockRejectedValue({ code: 'ER_DUP_ENTRY', errno: 1062 });
      const error = await rejection(
        service.update('u2', { email: 'novo@empresa.com' }, 'actor'),
      );
      expect(codeOf(error)).toBe('EMAIL_UNAVAILABLE');
    });

    it('ninguém exclui a si mesmo', async () => {
      users.findInScope.mockResolvedValue(aggregate({ id: 'actor' }));
      const error = await rejection(service.remove('actor', 'actor'));
      expect(codeOf(error)).toBe('USER_SELF_ACTION');
      expect(users.softDelete).not.toHaveBeenCalled();
    });

    it('exclusão é lógica', async () => {
      users.findInScope.mockResolvedValue(aggregate());
      await service.remove('u2', 'actor');
      expect(users.softDelete).toHaveBeenCalledWith('u2', 'actor');
    });
  });

  describe('assignTenants', () => {
    it('preserva vínculos fora do alcance e grava o conjunto final', async () => {
      users.findInScope.mockResolvedValue(
        aggregate({
          tenants: [
            { id: TENANT_A, name: 'A', slug: 'a' },
            { id: TENANT_B, name: 'B', slug: 'b' },
          ],
        }),
      );

      await service.assignTenants('u2', { tenantIds: [TENANT_A] }, 'actor');

      expect(users.replaceTenants).toHaveBeenCalledWith(
        'u2',
        [TENANT_A, TENANT_B],
        'actor',
      );
    });
  });

  describe('resetPassword', () => {
    it('409 para usuário inativo', async () => {
      users.findInScope.mockResolvedValue(aggregate({ active: false }));
      const error = await rejection(
        service.resetPassword('u2', { password: 'Nova!1234' }, 'actor'),
      );
      expect(codeOf(error)).toBe('USER_INACTIVE');
      expect(users.updatePassword).not.toHaveBeenCalled();
    });

    it('grava a nova senha e religa a troca obrigatória', async () => {
      users.findInScope.mockResolvedValue(aggregate());
      await service.resetPassword('u2', { password: 'Nova!1234' }, 'actor');
      expect(users.updatePassword).toHaveBeenCalledWith('u2', {
        passwordHash: 'hash',
        mustChangePassword: true,
        updatedById: 'actor',
      });
    });
  });
});
