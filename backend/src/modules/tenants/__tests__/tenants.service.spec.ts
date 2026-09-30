import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  TenantAccessService,
  TenantReach,
} from '../../../common/tenancy/tenant-access.service';
import type {
  ITenantRepository,
  TenantRecord,
} from '../application/interface/repository/tenant.repository.interface';
import { TenantsService } from '../tenants.service';

const TENANT: TenantRecord = {
  id: 't1',
  name: 'Secretaria',
  slug: 'secretaria',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const MEMBER: TenantReach = { superAdmin: false, tenantIds: ['t1'] };
const SUPER: TenantReach = { superAdmin: true, tenantIds: null };

function makeRepository(): jest.Mocked<ITenantRepository> {
  return {
    list: jest.fn().mockResolvedValue([TENANT]),
    findById: jest.fn().mockResolvedValue(TENANT),
    create: jest.fn().mockResolvedValue(TENANT),
    update: jest.fn().mockResolvedValue(TENANT),
    countExisting: jest.fn().mockResolvedValue(0),
  };
}

function makeService(reach: TenantReach | null = MEMBER) {
  const repository = makeRepository();
  const tenantAccess = {
    reachOf: jest.fn().mockResolvedValue(reach),
  } as unknown as TenantAccessService;
  const service = new TenantsService(repository, tenantAccess);
  return { service, repository };
}

const DUPLICATE = { code: 'ER_DUP_ENTRY', errno: 1062 };

describe('TenantsService', () => {
  describe('list', () => {
    it('ator não-SUPERADMIN lista só o próprio alcance', async () => {
      const { service, repository } = makeService(MEMBER);

      await expect(service.list('u1')).resolves.toEqual([TENANT]);
      expect(repository.list).toHaveBeenCalledWith(['t1']);
    });

    it('SUPERADMIN lista todos', async () => {
      const { service, repository } = makeService(SUPER);

      await service.list('u1');
      expect(repository.list).toHaveBeenCalledWith('all');
    });

    it('sessão inválida lança UnauthorizedException', async () => {
      const { service } = makeService(null);

      await expect(service.list('u1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('findOne', () => {
    it('tenant fora do alcance lança NotFoundException sem consultar', async () => {
      const { service, repository } = makeService(MEMBER);

      await expect(service.findOne('t9', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('tenant no alcance mas ausente lança NotFoundException', async () => {
      const { service, repository } = makeService(MEMBER);
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('t1', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('tenant no alcance é devolvido', async () => {
      const { service, repository } = makeService(MEMBER);

      await expect(service.findOne('t1', 'u1')).resolves.toEqual(TENANT);
      expect(repository.findById).toHaveBeenCalledWith('t1');
    });
  });

  describe('create', () => {
    it('slug duplicado vira 409 TENANT_SLUG_TAKEN', async () => {
      const { service, repository } = makeService(MEMBER);
      repository.create.mockRejectedValue(DUPLICATE);

      const error: unknown = await service
        .create({ name: 'X', slug: 'x' }, 'u1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'TENANT_SLUG_TAKEN',
      });
    });

    it('outro erro é relançado sem conversão', async () => {
      const { service, repository } = makeService(MEMBER);
      const failure = new Error('falhou');
      repository.create.mockRejectedValue(failure);

      await expect(service.create({ name: 'X', slug: 'x' }, 'u1')).rejects.toBe(
        failure,
      );
    });

    it('ator comum nasce vinculado ao tenant criado', async () => {
      const { service, repository } = makeService(MEMBER);

      await service.create({ name: '  Nova  ', slug: 'nova' }, 'u1');
      expect(repository.create).toHaveBeenCalledWith({
        name: 'Nova',
        slug: 'nova',
        active: true,
        createdById: 'u1',
        linkUserId: 'u1',
      });
    });

    it('SUPERADMIN cria sem vínculo', async () => {
      const { service, repository } = makeService(SUPER);

      await service.create({ name: 'Nova', slug: 'nova', active: false }, 'u1');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ active: false, linkUserId: null }),
      );
    });
  });

  describe('update', () => {
    it('confere o alcance antes de gravar', async () => {
      const { service, repository } = makeService(MEMBER);

      await expect(
        service.update('t9', { name: 'Y' }, 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('grava só os campos informados', async () => {
      const { service, repository } = makeService(MEMBER);

      await service.update('t1', { name: ' Y ' }, 'u1');
      expect(repository.update).toHaveBeenCalledWith('t1', {
        name: 'Y',
        slug: undefined,
        active: undefined,
        updatedById: 'u1',
      });
    });

    it('slug duplicado vira 409 TENANT_SLUG_TAKEN', async () => {
      const { service, repository } = makeService(MEMBER);
      repository.update.mockRejectedValue(DUPLICATE);

      await expect(
        service.update('t1', { slug: 'x' }, 'u1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
