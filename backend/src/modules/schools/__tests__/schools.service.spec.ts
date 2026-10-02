import { ConflictException, NotFoundException } from '@nestjs/common';
import type {
  ISchoolRepository,
  SchoolRecord,
} from '../application/interface/repository/school.repository.interface';
import { SchoolsService } from '../schools.service';

const SCHOOL: SchoolRecord = {
  id: 's1',
  tenantId: 't1',
  name: 'Escola A',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeRepository(): jest.Mocked<ISchoolRepository> {
  return {
    list: jest.fn().mockResolvedValue({ data: [SCHOOL], total: 1 }),
    findById: jest.fn().mockResolvedValue(SCHOOL),
    findIdByName: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(SCHOOL),
    update: jest.fn().mockResolvedValue(SCHOOL),
    softDelete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeService() {
  const repository = makeRepository();
  const service = new SchoolsService(repository);
  return { service, repository };
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

describe('SchoolsService', () => {
  describe('list', () => {
    it('aplica o tenant e a paginação default', async () => {
      const { service, repository } = makeService();

      await expect(service.list('t1', { search: 'esc' })).resolves.toEqual({
        data: [SCHOOL],
        total: 1,
      });
      expect(repository.list).toHaveBeenCalledWith({
        tenantId: 't1',
        active: undefined,
        search: 'esc',
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findOne', () => {
    it('escola inexistente, excluída ou de outro tenant responde 404', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expectCode(
        service.findOne('t1', 's1'),
        NotFoundException,
        'SCHOOL_NOT_FOUND',
      );
      expect(repository.findById).toHaveBeenCalledWith('t1', 's1');
    });
  });

  describe('create', () => {
    it('apara o nome e ativa por padrão', async () => {
      const { service, repository } = makeService();

      await service.create('t1', { name: '  Escola A  ' }, 'u1');
      expect(repository.findIdByName).toHaveBeenCalledWith('t1', 'Escola A');
      expect(repository.create).toHaveBeenCalledWith({
        tenantId: 't1',
        name: 'Escola A',
        active: true,
        createdById: 'u1',
      });
    });

    it('nome em uso responde 409 SCHOOL_NAME_TAKEN', async () => {
      const { service, repository } = makeService();
      repository.findIdByName.mockResolvedValue('s2');

      await expectCode(
        service.create('t1', { name: 'Escola A' }, 'u1'),
        ConflictException,
        'SCHOOL_NAME_TAKEN',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('corrida no unique do banco responde 409 SCHOOL_NAME_TAKEN', async () => {
      const { service, repository } = makeService();
      repository.findIdByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('s2');
      repository.create.mockRejectedValue(DUPLICATE);

      await expectCode(
        service.create('t1', { name: 'Escola A' }, 'u1'),
        ConflictException,
        'SCHOOL_NAME_TAKEN',
      );
    });
  });

  describe('update', () => {
    it('manter o próprio nome não conflita', async () => {
      const { service, repository } = makeService();
      repository.findIdByName.mockResolvedValue('s2');

      await expect(
        service.update('t1', 's2', { name: 'Escola A' }, 'u1'),
      ).resolves.toEqual(SCHOOL);
      expect(repository.update).toHaveBeenCalledWith('t1', 's2', {
        name: 'Escola A',
        active: undefined,
        updatedById: 'u1',
      });
    });

    it('nome de outra escola responde 409 SCHOOL_NAME_TAKEN', async () => {
      const { service, repository } = makeService();
      repository.findIdByName.mockResolvedValue('s3');

      await expectCode(
        service.update('t1', 's2', { name: 'Escola A' }, 'u1'),
        ConflictException,
        'SCHOOL_NAME_TAKEN',
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('escola inexistente responde 404 sem gravar', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expectCode(
        service.update('t1', 's2', { active: false }, 'u1'),
        NotFoundException,
        'SCHOOL_NOT_FOUND',
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('exclui logicamente com o ator', async () => {
      const { service, repository } = makeService();

      await service.remove('t1', 's1', 'u1');
      expect(repository.softDelete).toHaveBeenCalledWith('t1', 's1', 'u1');
    });

    it('escola inexistente responde 404', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expectCode(
        service.remove('t1', 's1', 'u1'),
        NotFoundException,
        'SCHOOL_NOT_FOUND',
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});
