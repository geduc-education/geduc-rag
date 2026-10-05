import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isMysqlDuplicateEntry } from '../../@core/shared/exceptions/400/duplicate-entry';
import { ERROR_CODES } from '../../common/errors/error-codes';
import {
  SCHOOL_LESSON_SLOT_REPOSITORY,
  type ISchoolLessonSlotRepository,
  type LessonSlotRecord,
} from './application/interface/repository/school-lesson-slot.repository.interface';
import {
  SCHOOL_REPOSITORY,
  type ISchoolRepository,
} from './application/interface/repository/school.repository.interface';
import {
  CreateLessonSlotDto,
  LessonSlotListResponseDto,
  LessonSlotResponseDto,
  UpdateLessonSlotDto,
} from './dto/school-lesson-slot.dto';
import {
  assertNoSlotOverlap,
  assertSlotRange,
  nextSlotPosition,
} from './school-lesson-slot.rules';

function toResponse(slot: LessonSlotRecord): LessonSlotResponseDto {
  return {
    id: slot.id,
    schoolId: slot.schoolId,
    name: slot.name,
    startTime: slot.startTime,
    endTime: slot.endTime,
    position: slot.position,
  };
}

/**
 * Horários de aula de uma escola do tenant da requisição. Escola de outro
 * tenant ou excluída responde 404 `SCHOOL_NOT_FOUND`; os horários da escola
 * não se cruzam e o nome é único entre os não excluídos.
 */
@Injectable()
export class SchoolLessonSlotsService {
  constructor(
    @Inject(SCHOOL_LESSON_SLOT_REPOSITORY)
    private readonly repository: ISchoolLessonSlotRepository,
    @Inject(SCHOOL_REPOSITORY)
    private readonly schools: ISchoolRepository,
  ) {}

  async list(
    tenantId: string,
    schoolId: string,
  ): Promise<LessonSlotListResponseDto> {
    await this.assertSchool(tenantId, schoolId);
    const slots = await this.repository.listBySchool(tenantId, schoolId);
    return { data: slots.map(toResponse) };
  }

  async create(
    tenantId: string,
    schoolId: string,
    dto: CreateLessonSlotDto,
    actorId: string,
  ): Promise<LessonSlotResponseDto> {
    await this.assertSchool(tenantId, schoolId);
    assertSlotRange(dto.startTime, dto.endTime);
    const slots = await this.repository.listBySchool(tenantId, schoolId);
    assertNoSlotOverlap(dto, slots);
    const name = dto.name.trim();
    await this.assertNameFree(tenantId, schoolId, name);
    const created = await this.withNameConflict(tenantId, schoolId, name, () =>
      this.repository.create({
        tenantId,
        schoolId,
        name,
        startTime: dto.startTime,
        endTime: dto.endTime,
        position: dto.position ?? nextSlotPosition(slots),
        createdById: actorId,
      }),
    );
    return toResponse(created);
  }

  async update(
    tenantId: string,
    schoolId: string,
    id: string,
    dto: UpdateLessonSlotDto,
    actorId: string,
  ): Promise<LessonSlotResponseDto> {
    const current = await this.findOrFail(tenantId, schoolId, id);
    const range = {
      startTime: dto.startTime ?? current.startTime,
      endTime: dto.endTime ?? current.endTime,
    };
    assertSlotRange(range.startTime, range.endTime);
    if (dto.startTime !== undefined || dto.endTime !== undefined) {
      const slots = await this.repository.listBySchool(tenantId, schoolId);
      assertNoSlotOverlap(range, slots, id);
    }
    const name = dto.name?.trim();
    await this.assertNameFree(tenantId, schoolId, name, id);
    const updated = await this.withNameConflict(
      tenantId,
      schoolId,
      name,
      () =>
        this.repository.update(tenantId, schoolId, id, {
          name,
          startTime: dto.startTime,
          endTime: dto.endTime,
          position: dto.position,
          updatedById: actorId,
        }),
      id,
    );
    return toResponse(updated);
  }

  /** Exclusão lógica; barrada enquanto alguma aula viva usar o horário. */
  async remove(
    tenantId: string,
    schoolId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    await this.findOrFail(tenantId, schoolId, id);
    if (await this.repository.isInUse(tenantId, id)) {
      throw new ConflictException({
        code: ERROR_CODES.LESSON_SLOT_IN_USE,
        message:
          'O horário é usado por aulas do horário semanal e não pode ser excluído.',
      });
    }
    await this.repository.softDelete(tenantId, schoolId, id, actorId);
  }

  private async assertSchool(tenantId: string, schoolId: string) {
    if (await this.schools.findById(tenantId, schoolId)) return;
    throw new NotFoundException({
      code: ERROR_CODES.SCHOOL_NOT_FOUND,
      message: 'Escola não encontrada.',
    });
  }

  private async findOrFail(
    tenantId: string,
    schoolId: string,
    id: string,
  ): Promise<LessonSlotRecord> {
    await this.assertSchool(tenantId, schoolId);
    const slot = await this.repository.findById(tenantId, schoolId, id);
    if (slot) return slot;
    throw new NotFoundException({
      code: ERROR_CODES.LESSON_SLOT_NOT_FOUND,
      message: 'Horário de aula não encontrado.',
    });
  }

  /** `name` indefinido (PATCH sem nome) não verifica. */
  private async assertNameFree(
    tenantId: string,
    schoolId: string,
    name: string | undefined,
    selfId?: string,
  ): Promise<void> {
    if (name === undefined) return;
    const ownerId = await this.repository.findIdByName(
      tenantId,
      schoolId,
      name,
    );
    if (ownerId === null || ownerId === selfId) return;
    throw new ConflictException({
      code: ERROR_CODES.LESSON_SLOT_NAME_TAKEN,
      message: 'Já existe um horário com este nome na escola.',
    });
  }

  /** Corrida com o unique `active_name`: a checagem refeita devolve o 409. */
  private async withNameConflict<T>(
    tenantId: string,
    schoolId: string,
    name: string | undefined,
    write: () => Promise<T>,
    selfId?: string,
  ): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isMysqlDuplicateEntry(error)) {
        await this.assertNameFree(tenantId, schoolId, name, selfId);
      }
      throw error;
    }
  }
}
