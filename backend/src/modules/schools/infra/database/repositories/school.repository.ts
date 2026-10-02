import { randomUUID } from 'node:crypto';
import type {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../../../../@core/application/adapters/database-connection.interface';
import type {
  CreateSchoolInput,
  ISchoolRepository,
  SchoolListFilter,
  SchoolRecord,
  UpdateSchoolInput,
} from '../../../application/interface/repository/school.repository.interface';
import {
  buildSchoolListQuery,
  SCHOOL_COLUMNS,
  SCHOOL_FROM,
} from '../queries/school-list.query';

const FIND_SQL = `
  SELECT ${SCHOOL_COLUMNS}
    FROM ${SCHOOL_FROM}
   WHERE s.tenant_id = ? AND s.id = ? AND s.deleted_at IS NULL
   LIMIT 1`;

const FIND_ID_BY_NAME_SQL = `SELECT id FROM school WHERE tenant_id = ? AND name = ? LIMIT 1`;

const INSERT_SQL = `
  INSERT INTO school
    (id, tenant_id, name, active, created_by_id, updated_at)
  VALUES (?, ?, ?, ?, ?, NOW(3))`;

const SOFT_DELETE_SQL = `
  UPDATE school
     SET active = 0, deleted_at = NOW(3), deleted_by_id = ?, updated_at = NOW(3)
   WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`;

/** Allow-list campo do input → coluna gravável no UPDATE. */
const UPDATABLE_COLUMNS = {
  name: 'name',
  active: 'active',
} as const satisfies Record<
  keyof Omit<UpdateSchoolInput, 'updatedById'>,
  string
>;

interface SchoolRow {
  id: string;
  tenant_id: string;
  name: string;
  active: number | boolean;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: SchoolRow): SchoolRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    active: Number(row.active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Monta o SET só com os campos definidos, mais a auditoria. */
function buildSet(input: UpdateSchoolInput): {
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

/** `ISchoolRepository` em SQL; todo acesso filtra por `tenant_id`. */
export class SchoolRepository implements ISchoolRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async list(
    filter: SchoolListFilter,
  ): Promise<{ data: SchoolRecord[]; total: number }> {
    const { page, count } = buildSchoolListQuery(filter);
    const [rows, counted] = await Promise.all([
      this.db.query<SchoolRow>(page.sql, page.params),
      this.db.queryOne<{ total: number | string }>(count.sql, count.params),
    ]);
    return { data: rows.map(toRecord), total: Number(counted?.total ?? 0) };
  }

  findById(tenantId: string, id: string): Promise<SchoolRecord | null> {
    return this.findWith(this.db, tenantId, id);
  }

  /** Não filtra exclusão: o unique do tenant também vale para excluídas. */
  async findIdByName(tenantId: string, name: string): Promise<string | null> {
    const row = await this.db.queryOne<{ id: string }>(FIND_ID_BY_NAME_SQL, [
      tenantId,
      name,
    ]);
    return row?.id ?? null;
  }

  create(input: CreateSchoolInput): Promise<SchoolRecord> {
    const id = randomUUID();
    return this.db.runInTransaction(async (tx) => {
      await tx.insert(INSERT_SQL, [
        id,
        input.tenantId,
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
    input: UpdateSchoolInput,
  ): Promise<SchoolRecord> {
    const set = buildSet(input);
    return this.db.runInTransaction(async (tx) => {
      await tx.update(
        `UPDATE school SET ${set.sql} WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`,
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
  ): Promise<SchoolRecord | null> {
    const row = await conn.queryOne<SchoolRow>(FIND_SQL, [tenantId, id]);
    return row ? toRecord(row) : null;
  }

  private async findOrThrow(
    conn: ITransactionalConnection,
    tenantId: string,
    id: string,
  ): Promise<SchoolRecord> {
    const school = await this.findWith(conn, tenantId, id);
    if (!school) {
      throw new Error(`Escola ${id} não encontrada após gravação.`);
    }
    return school;
  }
}
