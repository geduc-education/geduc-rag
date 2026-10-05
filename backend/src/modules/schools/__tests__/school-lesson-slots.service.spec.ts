import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type {
  ISchoolLessonSlotRepository,
  LessonSlotRecord,
} from '../application/interface/repository/school-lesson-slot.repository.interface';
import type {
  ISchoolRepository,
  SchoolRecord,
} from '../application/interface/repository/school.repository.interface';
import { SchoolLessonSlotsService } from '../school-lesson-slots.service';

const SCHOOL: SchoolRecord = {
  id: 's1',
  tenantId: 't1',
  name: 'Escola A',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const FIRST: LessonSlotRecord = {
  id: 'ls1',
  tenantId: 't1',
  schoolId: 's1',
  name: '1ª aula',
  startTime: '07:00',
  endTime: '07:50',
  position: 1,
};

const SECOND: LessonSlotRecord = {
  ...FIRST,
  id: 'ls2',
  name: '2ª aula',
  startTime: '07:50',
  endTime: '08:40',
  position: 2,
};

const RESPONSE = {
  id: 'ls1',
  schoolId: 's1',
  name: '1ª aula',
  startTime: '07:00',
  endTime: '07:50',
  position: 1,
};

function makeService() {
  const slots: jest.Mocked<ISchoolLessonSlotRepository> = {
    listBySchool: jest.fn().mockResolvedValue([FIRST, SECOND]),
    findById: jest.fn().mockResolvedValue(FIRST),
    findIdByName: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(FIRST),
    update: jest.fn().mockResolvedValue(FIRST),
    softDelete: jest.fn().mockResolvedValue(undefined),
    isInUse: jest.fn().mockResolvedValue(false),
  };
  const schools = {
    findById: jest.fn().mockResolvedValue(SCHOOL),
  } as unknown as jest.Mocked<ISchoolRepository>;
  const service = new SchoolLessonSlotsService(slots, schools);
  return { service, slots, schools };
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

describe('SchoolLessonSlotsService', () => {
  describe('list', () => {
    it('lista os horários da escola sem tenantId', async () => {
      const { service, slots, schools } = makeService();

      const result = await service.list('t1', 's1');
      expect(schools.findById).toHaveBeenCalledWith('t1', 's1');
      expect(slots.listBySchool).toHaveBeenCalledWith('t1', 's1');
      expect(result.data[0]).toEqual(RESPONSE);
      expect(result.data[0]).not.toHaveProperty('tenantId');
    });

    it('escola inexistente ou de outro tenant → 404 SCHOOL_NOT_FOUND', async () => {
      const { service, slots, schools } = makeService();
      schools.findById.mockResolvedValue(null);

      await expectCode(
        service.list('t1', 's1'),
        NotFoundException,
        'SCHOOL_NOT_FOUND',
      );
      expect(slots.listBySchool).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('apara o nome e usa a próxima posição por padrão', async () => {
      const { service, slots } = makeService();

      await expect(
        service.create(
          't1',
          's1',
          { name: '  3ª aula ', startTime: '08:40', endTime: '09:30' },
          'u1',
        ),
      ).resolves.toEqual(RESPONSE);
      expect(slots.findIdByName).toHaveBeenCalledWith('t1', 's1', '3ª aula');
      expect(slots.create).toHaveBeenCalledWith({
        tenantId: 't1',
        schoolId: 's1',
        name: '3ª aula',
        startTime: '08:40',
        endTime: '09:30',
        position: 3,
        createdById: 'u1',
      });
    });

    it('respeita a posição informada', async () => {
      const { service, slots } = makeService();

      await service.create(
        't1',
        's1',
        {
          name: 'Intervalo',
          startTime: '09:30',
          endTime: '09:50',
          position: 0,
        },
        'u1',
      );
      expect(slots.create).toHaveBeenCalledWith(
        expect.objectContaining({ position: 0 }),
      );
    });

    it('fim antes do início → 400 LESSON_SLOT_INVALID_RANGE', async () => {
      const { service, slots } = makeService();

      await expectCode(
        service.create(
          't1',
          's1',
          { name: 'X', startTime: '10:00', endTime: '09:00' },
          'u1',
        ),
        BadRequestException,
        'LESSON_SLOT_INVALID_RANGE',
      );
      expect(slots.create).not.toHaveBeenCalled();
    });

    it('sobreposição com outro horário → 409 LESSON_SLOT_OVERLAP', async () => {
      const { service, slots } = makeService();

      await expectCode(
        service.create(
          't1',
          's1',
          { name: 'X', startTime: '07:30', endTime: '08:00' },
          'u1',
        ),
        ConflictException,
        'LESSON_SLOT_OVERLAP',
      );
      expect(slots.create).not.toHaveBeenCalled();
    });

    it('nome em uso na escola → 409 LESSON_SLOT_NAME_TAKEN', async () => {
      const { service, slots } = makeService();
      slots.findIdByName.mockResolvedValue('ls9');

      await expectCode(
        service.create(
          't1',
          's1',
          { name: '1ª aula', startTime: '10:00', endTime: '10:50' },
          'u1',
        ),
        ConflictException,
        'LESSON_SLOT_NAME_TAKEN',
      );
      expect(slots.create).not.toHaveBeenCalled();
    });

    it('corrida no unique do banco → 409 LESSON_SLOT_NAME_TAKEN', async () => {
      const { service, slots } = makeService();
      slots.findIdByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('ls9');
      slots.create.mockRejectedValue(DUPLICATE);

      await expectCode(
        service.create(
          't1',
          's1',
          { name: '3ª aula', startTime: '10:00', endTime: '10:50' },
          'u1',
        ),
        ConflictException,
        'LESSON_SLOT_NAME_TAKEN',
      );
    });

    it('escola inexistente → 404 SCHOOL_NOT_FOUND sem gravar', async () => {
      const { service, slots, schools } = makeService();
      schools.findById.mockResolvedValue(null);

      await expectCode(
        service.create(
          't1',
          's1',
          { name: 'X', startTime: '10:00', endTime: '10:50' },
          'u1',
        ),
        NotFoundException,
        'SCHOOL_NOT_FOUND',
      );
      expect(slots.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('valida o intervalo mesclado com o atual e ignora o próprio horário', async () => {
      const { service, slots } = makeService();

      await service.update('t1', 's1', 'ls1', { endTime: '07:45' }, 'u1');
      expect(slots.findById).toHaveBeenCalledWith('t1', 's1', 'ls1');
      expect(slots.update).toHaveBeenCalledWith('t1', 's1', 'ls1', {
        name: undefined,
        startTime: undefined,
        endTime: '07:45',
        position: undefined,
        updatedById: 'u1',
      });
    });

    it('novo fim antes do início atual → 400 LESSON_SLOT_INVALID_RANGE', async () => {
      const { service, slots } = makeService();

      await expectCode(
        service.update('t1', 's1', 'ls1', { endTime: '06:59' }, 'u1'),
        BadRequestException,
        'LESSON_SLOT_INVALID_RANGE',
      );
      expect(slots.update).not.toHaveBeenCalled();
    });

    it('nova hora cruzando outro horário → 409 LESSON_SLOT_OVERLAP', async () => {
      const { service, slots } = makeService();

      await expectCode(
        service.update('t1', 's1', 'ls1', { endTime: '08:00' }, 'u1'),
        ConflictException,
        'LESSON_SLOT_OVERLAP',
      );
      expect(slots.update).not.toHaveBeenCalled();
    });

    it('manter o próprio nome não conflita; nome de outro → 409', async () => {
      const { service, slots } = makeService();
      slots.findIdByName.mockResolvedValue('ls1');
      await expect(
        service.update('t1', 's1', 'ls1', { name: '1ª aula' }, 'u1'),
      ).resolves.toEqual(RESPONSE);

      slots.findIdByName.mockResolvedValue('ls2');
      await expectCode(
        service.update('t1', 's1', 'ls1', { name: '2ª aula' }, 'u1'),
        ConflictException,
        'LESSON_SLOT_NAME_TAKEN',
      );
    });

    it('horário inexistente → 404 LESSON_SLOT_NOT_FOUND', async () => {
      const { service, slots } = makeService();
      slots.findById.mockResolvedValue(null);

      await expectCode(
        service.update('t1', 's1', 'ls1', { name: 'X' }, 'u1'),
        NotFoundException,
        'LESSON_SLOT_NOT_FOUND',
      );
      expect(slots.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('exclui logicamente horário sem uso', async () => {
      const { service, slots } = makeService();

      await service.remove('t1', 's1', 'ls1', 'u1');
      expect(slots.isInUse).toHaveBeenCalledWith('t1', 'ls1');
      expect(slots.softDelete).toHaveBeenCalledWith('t1', 's1', 'ls1', 'u1');
    });

    it('horário usado por aula → 409 LESSON_SLOT_IN_USE', async () => {
      const { service, slots } = makeService();
      slots.isInUse.mockResolvedValue(true);

      await expectCode(
        service.remove('t1', 's1', 'ls1', 'u1'),
        ConflictException,
        'LESSON_SLOT_IN_USE',
      );
      expect(slots.softDelete).not.toHaveBeenCalled();
    });

    it('horário inexistente → 404 LESSON_SLOT_NOT_FOUND', async () => {
      const { service, slots } = makeService();
      slots.findById.mockResolvedValue(null);

      await expectCode(
        service.remove('t1', 's1', 'ls1', 'u1'),
        NotFoundException,
        'LESSON_SLOT_NOT_FOUND',
      );
      expect(slots.softDelete).not.toHaveBeenCalled();
    });
  });
});
