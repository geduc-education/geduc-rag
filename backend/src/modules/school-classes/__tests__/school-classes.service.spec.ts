import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type {
  ISchoolClassRepository,
  SchoolClassRecord,
} from '../application/interface/repository/school-class.repository.interface';
import { SchoolClassesService } from '../school-classes.service';

const SCHOOL_CLASS: SchoolClassRecord = {
  id: 'c1',
  tenantId: 't1',
  schoolId: 's1',
  schoolName: 'Escola A',
  schoolYear: 2026,
  name: '8º A',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function makeRepository(): jest.Mocked<ISchoolClassRepository> {
  return {
    list: jest.fn().mockResolvedValue({ data: [SCHOOL_CLASS], total: 1 }),
    findById: jest.fn().mockResolvedValue(SCHOOL_CLASS),
    findIdByName: jest.fn().mockResolvedValue(null),
    schoolExists: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue(SCHOOL_CLASS),
    update: jest.fn().mockResolvedValue(SCHOOL_CLASS),
    softDelete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeService() {
  const repository = makeRepository();
  const service = new SchoolClassesService(repository);
  return { service, repository };
}

const DUPLICATE = { code: 'ER_DUP_ENTRY', errno: 1062 };

const CREATE = { schoolId: 's1', schoolYear: 2026, name: '  8º A  ' };

async function expectCode(
  promise: Promise<unknown>,
  type: unknown,
  code: string,
) {
  await expect(promise).rejects.toBeInstanceOf(type);
  await expect(promise).rejects.toMatchObject({ response: { code } });
}

describe('SchoolClassesService', () => {
  describe('list', () => {
    it('aplica o tenant, os filtros e a paginação default', async () => {
      const { service, repository } = makeService();

      await expect(
        service.list('t1', { schoolId: 's1', schoolYear: 2026 }),
      ).resolves.toEqual({ data: [SCHOOL_CLASS], total: 1 });
      expect(repository.list).toHaveBeenCalledWith({
        tenantId: 't1',
        schoolId: 's1',
        schoolYear: 2026,
        active: undefined,
        search: undefined,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findOne', () => {
    it('turma inexistente, excluída ou de outro tenant responde 404', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expectCode(
        service.findOne('t1', 'c1'),
        NotFoundException,
        'SCHOOL_CLASS_NOT_FOUND',
      );
      expect(repository.findById).toHaveBeenCalledWith('t1', 'c1');
    });
  });

  describe('create', () => {
    it('apara o nome e ativa por padrão', async () => {
      const { service, repository } = makeService();

      await service.create('t1', CREATE, 'u1');
      expect(repository.schoolExists).toHaveBeenCalledWith('t1', 's1');
      expect(repository.findIdByName).toHaveBeenCalledWith(
        't1',
        's1',
        2026,
        '8º A',
      );
      expect(repository.create).toHaveBeenCalledWith({
        tenantId: 't1',
        schoolId: 's1',
        schoolYear: 2026,
        name: '8º A',
        active: true,
        createdById: 'u1',
      });
    });

    it('escola inexistente, excluída ou de outro tenant responde 400 SCHOOL_CLASS_SCHOOL_INVALID', async () => {
      const { service, repository } = makeService();
      repository.schoolExists.mockResolvedValue(false);

      await expectCode(
        service.create('t1', CREATE, 'u1'),
        BadRequestException,
        'SCHOOL_CLASS_SCHOOL_INVALID',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('nome em uso responde 409 SCHOOL_CLASS_NAME_TAKEN', async () => {
      const { service, repository } = makeService();
      repository.findIdByName.mockResolvedValue('c2');

      await expectCode(
        service.create('t1', CREATE, 'u1'),
        ConflictException,
        'SCHOOL_CLASS_NAME_TAKEN',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('corrida no unique do banco responde 409 SCHOOL_CLASS_NAME_TAKEN', async () => {
      const { service, repository } = makeService();
      repository.findIdByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('c2');
      repository.create.mockRejectedValue(DUPLICATE);

      await expectCode(
        service.create('t1', CREATE, 'u1'),
        ConflictException,
        'SCHOOL_CLASS_NAME_TAKEN',
      );
    });
  });

  describe('update', () => {
    it('verifica o nome na escola e no ano da própria turma', async () => {
      const { service, repository } = makeService();
      repository.findIdByName.mockResolvedValue('c1');

      await expect(
        service.update('t1', 'c1', { name: ' 8º A ' }, 'u1'),
      ).resolves.toEqual(SCHOOL_CLASS);
      expect(repository.findIdByName).toHaveBeenCalledWith(
        't1',
        's1',
        2026,
        '8º A',
      );
      expect(repository.update).toHaveBeenCalledWith('t1', 'c1', {
        name: '8º A',
        active: undefined,
        updatedById: 'u1',
      });
    });

    it('nome de outra turma responde 409 SCHOOL_CLASS_NAME_TAKEN', async () => {
      const { service, repository } = makeService();
      repository.findIdByName.mockResolvedValue('c3');

      await expectCode(
        service.update('t1', 'c1', { name: '8º A' }, 'u1'),
        ConflictException,
        'SCHOOL_CLASS_NAME_TAKEN',
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('turma inexistente responde 404 sem gravar', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expectCode(
        service.update('t1', 'c1', { active: false }, 'u1'),
        NotFoundException,
        'SCHOOL_CLASS_NOT_FOUND',
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('exclui logicamente com o ator', async () => {
      const { service, repository } = makeService();

      await service.remove('t1', 'c1', 'u1');
      expect(repository.softDelete).toHaveBeenCalledWith('t1', 'c1', 'u1');
    });

    it('turma inexistente responde 404', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expectCode(
        service.remove('t1', 'c1', 'u1'),
        NotFoundException,
        'SCHOOL_CLASS_NOT_FOUND',
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});
