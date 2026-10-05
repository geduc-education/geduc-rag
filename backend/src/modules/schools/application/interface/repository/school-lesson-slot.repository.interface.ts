export const SCHOOL_LESSON_SLOT_REPOSITORY = 'ISchoolLessonSlotRepository';

/** Horário de aula da escola; horas em `HH:mm`. */
export interface LessonSlotRecord {
  id: string;
  tenantId: string;
  schoolId: string;
  name: string;
  startTime: string;
  endTime: string;
  position: number;
}

export interface CreateLessonSlotInput {
  tenantId: string;
  schoolId: string;
  name: string;
  startTime: string;
  endTime: string;
  position: number;
  createdById: string;
}

/** `undefined` = não altera. */
export interface UpdateLessonSlotInput {
  name?: string;
  startTime?: string;
  endTime?: string;
  position?: number;
  updatedById: string;
}

/**
 * Horários de aula de uma escola. Todo método recebe `tenantId` (e a escola,
 * quando o horário é endereçado por ela); leituras ignoram horário excluído.
 */
export interface ISchoolLessonSlotRepository {
  /** Ordenado por posição, início e id. */
  listBySchool(tenantId: string, schoolId: string): Promise<LessonSlotRecord[]>;
  findById(
    tenantId: string,
    schoolId: string,
    id: string,
  ): Promise<LessonSlotRecord | null>;
  /** Só entre horários não excluídos, como o unique `active_name`. */
  findIdByName(
    tenantId: string,
    schoolId: string,
    name: string,
  ): Promise<string | null>;
  create(input: CreateLessonSlotInput): Promise<LessonSlotRecord>;
  /** Grava só os campos definidos. */
  update(
    tenantId: string,
    schoolId: string,
    id: string,
    input: UpdateLessonSlotInput,
  ): Promise<LessonSlotRecord>;
  softDelete(
    tenantId: string,
    schoolId: string,
    id: string,
    deletedById: string,
  ): Promise<void>;
  /** Alguma aula de horário semanal não excluído referencia o horário. */
  isInUse(tenantId: string, id: string): Promise<boolean>;
}
