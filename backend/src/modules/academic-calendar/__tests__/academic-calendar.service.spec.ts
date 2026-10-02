import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AcademicCalendarService } from '../academic-calendar.service';
import type {
  AcademicCalendarRecord,
  CalendarDayRecord,
  IAcademicCalendarRepository,
} from '../application/interface/repository/academic-calendar.repository.interface';

const UPDATED_AT = new Date('2026-01-01T00:00:00.000Z');

const CALENDAR: AcademicCalendarRecord = {
  id: 'c1',
  tenantId: 't1',
  year: 2026,
  name: 'Calendário 2026',
  startDate: '2026-02-01',
  endDate: '2026-02-07',
  allSchools: true,
  schoolIds: [],
  createdAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
};

const WITH_SCHOOLS: AcademicCalendarRecord = {
  ...CALENDAR,
  allSchools: false,
  schoolIds: ['s1'],
};

const SUNDAY: CalendarDayRecord = {
  date: '2026-02-01',
  type: 'NON_SCHOOL_DAY',
  description: null,
  updatedAt: UPDATED_AT,
};

const SATURDAY: CalendarDayRecord = { ...SUNDAY, date: '2026-02-07' };

function makeRepository(): jest.Mocked<IAcademicCalendarRepository> {
  return {
    list: jest.fn().mockResolvedValue({ data: [CALENDAR], total: 1 }),
    findById: jest.fn().mockResolvedValue(CALENDAR),
    findExistingSchoolIds: jest
      .fn()
      .mockImplementation((_t: string, ids: readonly string[]) =>
        Promise.resolve([...ids]),
      ),
    create: jest.fn().mockResolvedValue(CALENDAR),
    update: jest.fn().mockResolvedValue(CALENDAR),
    softDelete: jest.fn().mockResolvedValue(undefined),
    listDays: jest.fn().mockResolvedValue([SUNDAY, SATURDAY]),
    findDay: jest.fn().mockResolvedValue(SATURDAY),
    updateDay: jest.fn().mockResolvedValue(SATURDAY),
    countDaysByType: jest.fn().mockResolvedValue([
      { type: 'SCHOOL_DAY', total: 5 },
      { type: 'NON_SCHOOL_DAY', total: 2 },
    ]),
  };
}

function makeService() {
  const repository = makeRepository();
  const service = new AcademicCalendarService(repository);
  return { service, repository };
}

async function expectCode(
  promise: Promise<unknown>,
  type: unknown,
  code: string,
) {
  await expect(promise).rejects.toBeInstanceOf(type);
  await expect(promise).rejects.toMatchObject({ response: { code } });
}

const CREATE_DTO = {
  year: 2026,
  name: 'Calendário 2026',
  startDate: '2026-02-01',
  endDate: '2026-02-07',
  allSchools: true,
};

const WEEK_TOTALS = {
  SCHOOL_DAY: 5,
  NON_SCHOOL_DAY: 2,
  OPTIONAL_DAY: 0,
  LESSON_PLANNING: 0,
  TEACHER_TRAINING: 0,
  total: 7,
};

describe('AcademicCalendarService', () => {
  describe('list', () => {
    it('aplica o tenant, os filtros e a paginação default', async () => {
      const { service, repository } = makeService();

      await expect(service.list('t1', { year: 2026 })).resolves.toEqual({
        data: [CALENDAR],
        total: 1,
      });
      expect(repository.list).toHaveBeenCalledWith({
        tenantId: 't1',
        year: 2026,
        schoolId: undefined,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('findOne', () => {
    it('devolve o calendário com os quantitativos do ano inteiro', async () => {
      const { service, repository } = makeService();

      await expect(service.findOne('t1', 'c1')).resolves.toEqual({
        ...CALENDAR,
        totals: WEEK_TOTALS,
      });
      expect(repository.countDaysByType).toHaveBeenCalledWith('t1', 'c1');
    });

    it('calendário inexistente ou de outro tenant responde 404', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expectCode(
        service.findOne('t1', 'c9'),
        NotFoundException,
        'CALENDAR_NOT_FOUND',
      );
    });
  });

  describe('create', () => {
    it('gera os dias do período e devolve os quantitativos', async () => {
      const { service, repository } = makeService();

      const result = await service.create('t1', CREATE_DTO, 'u1');

      const input = repository.create.mock.calls[0][0];
      expect(input).toMatchObject({
        tenantId: 't1',
        year: 2026,
        name: 'Calendário 2026',
        startDate: '2026-02-01',
        endDate: '2026-02-07',
        allSchools: true,
        schoolIds: [],
        createdById: 'u1',
      });
      expect(input.days).toHaveLength(7);
      expect(input.days[0]).toEqual({
        date: '2026-02-01',
        type: 'NON_SCHOOL_DAY',
      });
      expect(result.totals).toEqual(WEEK_TOTALS);
    });

    it('rejeita escola inexistente sem gravar', async () => {
      const { service, repository } = makeService();
      repository.findExistingSchoolIds.mockResolvedValue(['s1']);

      await expectCode(
        service.create(
          't1',
          { ...CREATE_DTO, allSchools: false, schoolIds: ['s1', 's2'] },
          'u1',
        ),
        BadRequestException,
        'CALENDAR_SCHOOLS_INVALID',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita escola de outro tenant ou excluída', async () => {
      const { service, repository } = makeService();
      repository.findExistingSchoolIds.mockResolvedValue([]);

      await expectCode(
        service.create(
          't1',
          { ...CREATE_DTO, allSchools: false, schoolIds: ['s9'] },
          'u1',
        ),
        BadRequestException,
        'CALENDAR_SCHOOLS_INVALID',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita allSchools com schoolIds e lista vazia sem allSchools', async () => {
      const { service, repository } = makeService();

      await expectCode(
        service.create('t1', { ...CREATE_DTO, schoolIds: ['s1'] }, 'u1'),
        BadRequestException,
        'CALENDAR_SCHOOLS_INVALID',
      );
      await expectCode(
        service.create('t1', { ...CREATE_DTO, allSchools: false }, 'u1'),
        BadRequestException,
        'CALENDAR_SCHOOLS_INVALID',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita período fora do ano', async () => {
      const { service, repository } = makeService();

      await expectCode(
        service.create('t1', { ...CREATE_DTO, endDate: '2027-01-01' }, 'u1'),
        BadRequestException,
        'CALENDAR_INVALID_RANGE',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('ao virar allSchools limpa os vínculos antigos', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(WITH_SCHOOLS);

      await service.update('t1', 'c1', { allSchools: true }, 'u1');

      expect(repository.update).toHaveBeenCalledWith('t1', 'c1', {
        name: undefined,
        allSchools: true,
        schoolIds: [],
        updatedById: 'u1',
      });
    });

    it('só nome não mexe nos vínculos', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(WITH_SCHOOLS);

      await service.update('t1', 'c1', { name: '  Novo  ' }, 'u1');

      expect(repository.update).toHaveBeenCalledWith('t1', 'c1', {
        name: 'Novo',
        allSchools: undefined,
        schoolIds: undefined,
        updatedById: 'u1',
      });
      expect(repository.findExistingSchoolIds).not.toHaveBeenCalled();
    });

    it('allSchools false sem schoolIds num calendário de todas rejeita', async () => {
      const { service, repository } = makeService();

      await expectCode(
        service.update('t1', 'c1', { allSchools: false }, 'u1'),
        BadRequestException,
        'CALENDAR_SCHOOLS_INVALID',
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('calendário inexistente responde 404 sem gravar', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expectCode(
        service.update('t1', 'c9', { name: 'X' }, 'u1'),
        NotFoundException,
        'CALENDAR_NOT_FOUND',
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('exclui logicamente o calendário existente', async () => {
      const { service, repository } = makeService();

      await service.remove('t1', 'c1', 'u1');

      expect(repository.softDelete).toHaveBeenCalledWith('t1', 'c1', 'u1');
    });
  });

  describe('listDays', () => {
    it('resolve a semana de domingo a sábado e soma os dias devolvidos', async () => {
      const { service, repository } = makeService();

      const result = await service.listDays('t1', 'c1', {
        view: 'week',
        date: '2026-02-04',
      });

      expect(repository.listDays).toHaveBeenCalledWith('t1', 'c1', {
        startDate: '2026-02-01',
        endDate: '2026-02-07',
      });
      expect(result).toMatchObject({
        calendarId: 'c1',
        view: 'week',
        startDate: '2026-02-01',
        endDate: '2026-02-07',
      });
      expect(result.days[0]).toEqual({ ...SUNDAY, weekday: 0 });
      expect(result.totals).toMatchObject({ NON_SCHOOL_DAY: 2, total: 2 });
    });
  });

  describe('updateDay', () => {
    it('domingo não vira dia letivo e nada é gravado', async () => {
      const { service, repository } = makeService();

      await expectCode(
        service.updateDay(
          't1',
          'c1',
          '2026-02-01',
          { type: 'SCHOOL_DAY' },
          'u1',
        ),
        BadRequestException,
        'CALENDAR_SUNDAY_IMMUTABLE',
      );
      expect(repository.updateDay).not.toHaveBeenCalled();
    });

    it('sábado aceita a troca de tipo', async () => {
      const { service, repository } = makeService();

      const result = await service.updateDay(
        't1',
        'c1',
        '2026-02-07',
        { type: 'SCHOOL_DAY' },
        'u1',
      );

      expect(repository.updateDay).toHaveBeenCalledWith(
        't1',
        'c1',
        '2026-02-07',
        { type: 'SCHOOL_DAY', description: undefined, updatedById: 'u1' },
      );
      expect(result.weekday).toBe(6);
    });

    it('domingo aceita só descrição', async () => {
      const { service, repository } = makeService();
      repository.findDay.mockResolvedValue(SUNDAY);
      repository.updateDay.mockResolvedValue(SUNDAY);

      await service.updateDay(
        't1',
        'c1',
        '2026-02-01',
        { description: 'Feriado' },
        'u1',
      );

      expect(repository.updateDay).toHaveBeenCalledWith(
        't1',
        'c1',
        '2026-02-01',
        { type: undefined, description: 'Feriado', updatedById: 'u1' },
      );
    });

    it('descrição vazia vira null', async () => {
      const { service, repository } = makeService();

      await service.updateDay(
        't1',
        'c1',
        '2026-02-07',
        { description: '   ' },
        'u1',
      );

      expect(repository.updateDay.mock.calls[0][3].description).toBeNull();
    });

    it('dia fora do calendário responde 404', async () => {
      const { service, repository } = makeService();
      repository.findDay.mockResolvedValue(null);

      await expectCode(
        service.updateDay('t1', 'c1', '2026-03-01', { description: 'x' }, 'u1'),
        NotFoundException,
        'CALENDAR_DAY_NOT_FOUND',
      );
      expect(repository.updateDay).not.toHaveBeenCalled();
    });

    it('calendário excluído responde 404 antes de gravar', async () => {
      const { service, repository } = makeService();
      repository.findById.mockResolvedValue(null);

      await expectCode(
        service.updateDay('t1', 'c1', '2026-02-07', { description: 'x' }, 'u1'),
        NotFoundException,
        'CALENDAR_NOT_FOUND',
      );
      expect(repository.updateDay).not.toHaveBeenCalled();
    });
  });
});
