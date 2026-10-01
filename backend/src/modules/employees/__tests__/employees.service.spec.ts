import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { TenantAccessService } from '../../../common/tenancy/tenant-access.service';
import type {
  EmployeeRecord,
  IEmployeeRepository,
} from '../application/interface/repository/employee.repository.interface';
import { EmployeesService } from '../employees.service';

const EMPLOYEE: EmployeeRecord = {
  id: 'e1',
  tenantId: 't1',
  userId: null,
  name: 'João',
  email: 'joao@escola.com',
  document: '12345678909',
  position: 'Professor',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const CREATE_DTO = {
  name: '  João  ',
  email: ' JOAO@Escola.com ',
  document: '12345678909',
  position: '  ',
};

function makeRepository(): jest.Mocked<IEmployeeRepository> {
  return {
    list: jest.fn().mockResolvedValue({ data: [EMPLOYEE], total: 1 }),
    findById: jest.fn().mockResolvedValue(EMPLOYEE),
    findIdByEmail: jest.fn().mockResolvedValue(null),
    findIdByDocument: jest.fn().mockResolvedValue(null),
    findIdByUserId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(EMPLOYEE),
    update: jest.fn().mockResolvedValue(EMPLOYEE),
    softDelete: jest.fn().mockResolvedValue(undefined),
    hardDelete: jest.fn().mockResolvedValue(true),
  };
}

function makeService(canAccess = true) {
  const repository = makeRepository();
  const tenantAccess = {
    canAccess: jest.fn().mockResolvedValue(canAccess),
  } as unknown as jest.Mocked<TenantAccessService>;
  const service = new EmployeesService(repository, tenantAccess);
  return { service, repository, tenantAccess };
}

const DUPLICATE = { code: 'ER_DUP_ENTRY', errno: 1062 };

async function expectCode(
  promise: Promise<unknown>,
  type: unknown,
  code: string,
) {
  await expect(promise).rejects.toBeInstanceOf(type);
  await expect(promise).rejects.toMatchObject({ response: { code } });
}

describe('EmployeesService', () => {
  describe('list', () => {
    it('aplica o tenant e a paginação default', async () => {
      const { service, repository } = makeService();

      await expect(service.list('t1', { search: 'jo' })).resolves.toEqual({
        data: [EMPLOYEE],
        total: 1,
      });
      expect(repository.list).toHaveBeenCalledWith({
        tenantId: 't1',
        active: undefined,
        search: 'jo',
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findOne', () => {
    it('funcionário fora do tenant responde 404', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expectCode(
        service.findOne('t1', 'e1'),
        NotFoundException,
        'EMPLOYEE_NOT_FOUND',
      );
      expect(repository.findById).toHaveBeenCalledWith('t1', 'e1');
    });
  });

  describe('create', () => {
    it('normaliza e-mail, nome e cargo vazio', async () => {
      const { service, repository } = makeService();

      await service.create('t1', CREATE_DTO, 'u1');
      expect(repository.create).toHaveBeenCalledWith({
        tenantId: 't1',
        email: 'joao@escola.com',
        document: '12345678909',
        userId: null,
        name: 'João',
        position: null,
        active: true,
        createdById: 'u1',
      });
    });

    it('e-mail em uso responde 409 EMPLOYEE_EMAIL_TAKEN', async () => {
      const { service, repository } = makeService();
      repository.findIdByEmail.mockResolvedValue('e2');

      await expectCode(
        service.create('t1', CREATE_DTO, 'u1'),
        ConflictException,
        'EMPLOYEE_EMAIL_TAKEN',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('CPF em uso responde 409 EMPLOYEE_DOCUMENT_TAKEN', async () => {
      const { service, repository } = makeService();
      repository.findIdByDocument.mockResolvedValue('e2');

      await expectCode(
        service.create('t1', CREATE_DTO, 'u1'),
        ConflictException,
        'EMPLOYEE_DOCUMENT_TAKEN',
      );
    });

    it('usuário sem acesso ao tenant responde 400', async () => {
      const { service, tenantAccess } = makeService(false);

      await expectCode(
        service.create('t1', { ...CREATE_DTO, userId: 'u9' }, 'u1'),
        BadRequestException,
        'EMPLOYEE_USER_NOT_LINKABLE',
      );
      expect(tenantAccess.canAccess).toHaveBeenCalledWith('u9', 't1');
    });

    it('usuário já vinculado responde 409', async () => {
      const { service, repository } = makeService();
      repository.findIdByUserId.mockResolvedValue('e2');

      await expectCode(
        service.create('t1', { ...CREATE_DTO, userId: 'u9' }, 'u1'),
        ConflictException,
        'EMPLOYEE_USER_ALREADY_LINKED',
      );
    });

    it('corrida no unique vira 409 com o campo que colidiu', async () => {
      const { service, repository } = makeService();
      repository.create.mockRejectedValue(DUPLICATE);
      repository.findIdByEmail
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('e2');

      await expect(
        service.create('t1', CREATE_DTO, 'u1'),
      ).rejects.toMatchObject({ response: { code: 'EMPLOYEE_EMAIL_TAKEN' } });
    });
  });

  describe('update', () => {
    it('o próprio e-mail não conta como conflito', async () => {
      const { service, repository } = makeService();
      repository.findIdByEmail.mockResolvedValue('e1');

      await service.update('t1', 'e1', { email: 'joao@escola.com' }, 'u1');
      expect(repository.update).toHaveBeenCalledWith('t1', 'e1', {
        email: 'joao@escola.com',
        document: undefined,
        userId: undefined,
        name: undefined,
        position: undefined,
        active: undefined,
        updatedById: 'u1',
      });
    });

    it('null em userId e position limpa os campos', async () => {
      const { service, repository, tenantAccess } = makeService();

      await service.update('t1', 'e1', { userId: null, position: null }, 'u1');
      expect(tenantAccess.canAccess).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(
        't1',
        'e1',
        expect.objectContaining({ userId: null, position: null }),
      );
    });

    it('funcionário inexistente responde 404 sem gravar', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('t1', 'e1', { name: 'X' }, 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('exclui logicamente com auditoria', async () => {
      const { service, repository } = makeService();

      await service.remove('t1', 'e1', 'u1');
      expect(repository.softDelete).toHaveBeenCalledWith('t1', 'e1', 'u1');
    });

    it('funcionário inexistente responde 404', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('t1', 'e1', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('purge', () => {
    it('remove definitivamente', async () => {
      const { service, repository } = makeService();

      await service.purge('t1', 'e1');
      expect(repository.hardDelete).toHaveBeenCalledWith('t1', 'e1');
    });

    it('nada removido responde 404', async () => {
      const { service, repository } = makeService();
      repository.hardDelete.mockResolvedValue(false);

      await expectCode(
        service.purge('t1', 'e1'),
        NotFoundException,
        'EMPLOYEE_NOT_FOUND',
      );
    });
  });
});
