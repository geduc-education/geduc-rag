import { randomUUID } from 'node:crypto';
import type {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../../../../@core/application/adapters/database-connection.interface';
import type {
  CreateLessonSlotInput,
  ISchoolLessonSlotRepository,
  LessonSlotRecord,
  UpdateLessonSlotInput,
} from '../../../application/interface/repository/school-lesson-slot.repository.interface';

const SLOT_SELECT = `
  SELECT ls.id, ls.tenant_id, ls.school_id, ls.name,
         TIME_FORMAT(ls.start_time, '%H:%i') AS start_time,
         TIME_FORMAT(ls.end_time, '%H:%i') AS end_time,
         ls.position
    FROM school_lesson_slot ls
   WHERE ls.tenant_id = ? AND ls.school_id = ? AND ls.deleted_at IS NULL`;

const LIST_SQL = `${SLOT_SELECT}
   ORDER BY ls.position ASC, ls.start_time ASC, ls.id ASC`;

const FIND_SQL = `${SLOT_SELECT} AND ls.id = ? LIMIT 1`;

const FIND_ID_BY_NAME_SQL = `
  SELECT id FROM school_lesson_slot
   WHERE tenant_id = ? AND school_id = ? AND name = ? AND deleted_at IS NULL
   LIMIT 1`;

const INSERT_SQL = `
  INSERT INTO school_lesson_slot
    (id, tenant_id, school_id, name, start_time, end_time, position,
     created_by_id, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`;

const SCOPE =
  'WHERE tenant_id = ? AND school_id = ? AND id = ? AND deleted_at IS NULL';

const SOFT_DELETE_SQL = `
  UPDATE school_lesson_slot
     SET deleted_at = NOW(3), deleted_by_id = ?, updated_at = NOW(3)
   ${SCOPE}`;

/** Aula de horário semanal não excluído que referencia o horário. */
const IN_USE_SQL = `
  SELECT 1 AS found
    FROM weekly_schedule_lesson l
    JOIN weekly_schedule_day wd ON wd.id = l.schedule_day_id
    JOIN weekly_schedule ws ON ws.id = wd.schedule_id
   WHERE l.tenant_id = ? AND l.lesson_slot_id = ? AND ws.deleted_at IS NULL
   LIMIT 1`;

/** Allow-list campo do input → coluna gravável no UPDATE. */
const UPDATABLE_COLUMNS = {
  name: 'name',
  startTime: 'start_time',
  endTime: 'end_time',
  position: 'position',
} as const satisfies Record<
  keyof Omit<UpdateLessonSlotInput, 'updatedById'>,
  string
>;

interface SlotRow {
  id: string;
  tenant_id: string;
  school_id: string;
  name: string;
  start_time: string;
  end_time: string;
  position: number | string;
}

function toRecord(row: SlotRow): LessonSlotRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    schoolId: row.school_id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    position: Number(row.position),
  };
}

/** Monta o SET só com os campos definidos, mais a auditoria. */
function buildSet(input: UpdateLessonSlotInput) {
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = input[field as keyof typeof UPDATABLE_COLUMNS];
    if (value === undefined) continue;
    assignments.push(`${column} = ?`);
    params.push(value);
  }
  assignments.push('updated_by_id = ?', 'updated_at = NOW(3)');
  params.push(input.updatedById);
  return { sql: assignments.join(', '), params };
}

/** `ISchoolLessonSlotRepository` em SQL; todo acesso filtra `tenant_id`. */
export class SchoolLessonSlotRepository implements ISchoolLessonSlotRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async listBySchool(
    tenantId: string,
    schoolId: string,
  ): Promise<LessonSlotRecord[]> {
    const rows = await this.db.query<SlotRow>(LIST_SQL, [tenantId, schoolId]);
    return rows.map(toRecord);
  }

  findById(
    tenantId: string,
    schoolId: string,
    id: string,
  ): Promise<LessonSlotRecord | null> {
    return this.findWith(this.db, tenantId, schoolId, id);
  }

  async findIdByName(
    tenantId: string,
    schoolId: string,
    name: string,
  ): Promise<string | null> {
    const row = await this.db.queryOne<{ id: string }>(FIND_ID_BY_NAME_SQL, [
      tenantId,
      schoolId,
      name,
    ]);
    return row?.id ?? null;
  }

  create(input: CreateLessonSlotInput): Promise<LessonSlotRecord> {
    const id = randomUUID();
    return this.db.runInTransaction(async (tx) => {
      await tx.insert(INSERT_SQL, [
        id,
        input.tenantId,
        input.schoolId,
        input.name,
        input.startTime,
        input.endTime,
        input.position,
        input.createdById,
      ]);
      return this.findOrThrow(tx, input.tenantId, input.schoolId, id);
    });
  }

  update(
    tenantId: string,
    schoolId: string,
    id: string,
    input: UpdateLessonSlotInput,
  ): Promise<LessonSlotRecord> {
    const set = buildSet(input);
    return this.db.runInTransaction(async (tx) => {
      await tx.update(`UPDATE school_lesson_slot SET ${set.sql} ${SCOPE}`, [
        ...set.params,
        tenantId,
        schoolId,
        id,
      ]);
      return this.findOrThrow(tx, tenantId, schoolId, id);
    });
  }

  async softDelete(
    tenantId: string,
    schoolId: string,
    id: string,
    deletedById: string,
  ): Promise<void> {
    await this.db.update(SOFT_DELETE_SQL, [
      deletedById,
      tenantId,
      schoolId,
      id,
    ]);
  }

  async isInUse(tenantId: string, id: string): Promise<boolean> {
    const row = await this.db.queryOne<{ found: number }>(IN_USE_SQL, [
      tenantId,
      id,
    ]);
    return Boolean(row);
  }

  private async findWith(
    conn: ITransactionalConnection,
    tenantId: string,
    schoolId: string,
    id: string,
  ): Promise<LessonSlotRecord | null> {
    const row = await conn.queryOne<SlotRow>(FIND_SQL, [
      tenantId,
      schoolId,
      id,
    ]);
    return row ? toRecord(row) : null;
  }

  private async findOrThrow(
    conn: ITransactionalConnection,
    tenantId: string,
    schoolId: string,
    id: string,
  ): Promise<LessonSlotRecord> {
    const slot = await this.findWith(conn, tenantId, schoolId, id);
    if (!slot) {
      throw new Error(`Horário de aula ${id} não encontrado após gravação.`);
    }
    return slot;
  }
}
