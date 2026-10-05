import { randomUUID } from 'node:crypto';
import type {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../../../../@core/application/adapters/database-connection.interface';
import type {
  CreateSchoolClassInput,
  ISchoolClassRepository,
  SchoolClassListFilter,
  SchoolClassRecord,
  UpdateSchoolClassInput,
} from '../../../application/interface/repository/school-class.repository.interface';
import {
  buildSchoolClassListQuery,
  SCHOOL_CLASS_COLUMNS,
  SCHOOL_CLASS_FROM,
} from '../queries/school-class-list.query';

const FIND_SQL = `
  SELECT ${SCHOOL_CLASS_COLUMNS}
    FROM ${SCHOOL_CLASS_FROM}
   WHERE sc.tenant_id = ? AND sc.id = ? AND sc.deleted_at IS NULL
   LIMIT 1`;

const FIND_ID_BY_NAME_SQL = `
  SELECT id FROM school_class
   WHERE tenant_id = ? AND school_id = ? AND school_year = ? AND name = ?
   LIMIT 1`;

const SCHOOL_EXISTS_SQL = `
  SELECT id FROM school
   WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL
   LIMIT 1`;

const INSERT_SQL = `
  INSERT INTO school_class
    (id, tenant_id, school_id, school_year, name, active, created_by_id, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`;

const SOFT_DELETE_SQL = `
  UPDATE school_class
     SET active = 0, deleted_at = NOW(3), deleted_by_id = ?, updated_at = NOW(3)
   WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`;

/** Allow-list campo do input → coluna gravável no UPDATE. */
const UPDATABLE_COLUMNS = {
  name: 'name',
  active: 'active',
} as const satisfies Record<
  keyof Omit<UpdateSchoolClassInput, 'updatedById'>,
  string
>;

interface SchoolClassRow {
  id: string;
  tenant_id: string;
  school_id: string;
  school_name: string;
  school_year: number | string;
  name: string;
  active: number | boolean;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: SchoolClassRow): SchoolClassRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    schoolId: row.school_id,
    schoolName: row.school_name,
    schoolYear: Number(row.school_year),
    name: row.name,
    active: Number(row.active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Monta o SET só com os campos definidos, mais a auditoria. */
function buildSet(input: UpdateSchoolClassInput): {
  sql: string;
  params: unknown[];
} {
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

/** `ISchoolClassRepository` em SQL; todo acesso filtra por `tenant_id`. */
export class SchoolClassRepository implements ISchoolClassRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async list(
    filter: SchoolClassListFilter,
  ): Promise<{ data: SchoolClassRecord[]; total: number }> {
    const { page, count } = buildSchoolClassListQuery(filter);
    const [rows, counted] = await Promise.all([
      this.db.query<SchoolClassRow>(page.sql, page.params),
      this.db.queryOne<{ total: number | string }>(count.sql, count.params),
    ]);
    return { data: rows.map(toRecord), total: Number(counted?.total ?? 0) };
  }

  findById(tenantId: string, id: string): Promise<SchoolClassRecord | null> {
    return this.findWith(this.db, tenantId, id);
  }

  /** Não filtra exclusão: o unique da turma também vale para excluídas. */
  async findIdByName(
    tenantId: string,
    schoolId: string,
    schoolYear: number,
    name: string,
  ): Promise<string | null> {
    const row = await this.db.queryOne<{ id: string }>(FIND_ID_BY_NAME_SQL, [
      tenantId,
      schoolId,
      schoolYear,
      name,
    ]);
    return row?.id ?? null;
  }

  async schoolExists(tenantId: string, schoolId: string): Promise<boolean> {
    const row = await this.db.queryOne<{ id: string }>(SCHOOL_EXISTS_SQL, [
      tenantId,
      schoolId,
    ]);
    return row !== null && row !== undefined;
  }

  create(input: CreateSchoolClassInput): Promise<SchoolClassRecord> {
    const id = randomUUID();
    return this.db.runInTransaction(async (tx) => {
      await tx.insert(INSERT_SQL, [
        id,
        input.tenantId,
        input.schoolId,
        input.schoolYear,
        input.name,
        input.active,
        input.createdById,
      ]);
      return this.findOrThrow(tx, input.tenantId, id);
    });
  }

  update(
    tenantId: string,
    id: string,
    input: UpdateSchoolClassInput,
  ): Promise<SchoolClassRecord> {
    const set = buildSet(input);
    return this.db.runInTransaction(async (tx) => {
      await tx.update(
        `UPDATE school_class SET ${set.sql} WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`,
        [...set.params, tenantId, id],
      );
      return this.findOrThrow(tx, tenantId, id);
    });
  }

  async softDelete(
    tenantId: string,
    id: string,
    deletedById: string,
  ): Promise<void> {
    await this.db.update(SOFT_DELETE_SQL, [deletedById, tenantId, id]);
  }

  private async findWith(
    conn: ITransactionalConnection,
    tenantId: string,
    id: string,
  ): Promise<SchoolClassRecord | null> {
    const row = await conn.queryOne<SchoolClassRow>(FIND_SQL, [tenantId, id]);
    return row ? toRecord(row) : null;
  }

  private async findOrThrow(
    conn: ITransactionalConnection,
    tenantId: string,
    id: string,
  ): Promise<SchoolClassRecord> {
    const schoolClass = await this.findWith(conn, tenantId, id);
    if (!schoolClass) {
      throw new Error(`Turma ${id} não encontrada após gravação.`);
    }
    return schoolClass;
  }
}
