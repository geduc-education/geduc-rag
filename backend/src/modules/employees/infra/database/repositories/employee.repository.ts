import { randomUUID } from 'node:crypto';
import type {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../../../../@core/application/adapters/database-connection.interface';
import type {
  CreateEmployeeInput,
  EmployeeListFilter,
  EmployeeRecord,
  IEmployeeRepository,
  UpdateEmployeeInput,
} from '../../../application/interface/repository/employee.repository.interface';
import {
  buildEmployeeListQuery,
  EMPLOYEE_COLUMNS,
  EMPLOYEE_FROM,
} from '../queries/employee-list.query';

const FIND_SQL = `
  SELECT ${EMPLOYEE_COLUMNS}
    FROM ${EMPLOYEE_FROM}
   WHERE e.tenant_id = ? AND e.id = ? AND e.deleted_at IS NULL
   LIMIT 1`;

const INSERT_SQL = `
  INSERT INTO employee
    (id, tenant_id, user_id, name, email, document, position, active, created_by_id, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`;

const SOFT_DELETE_SQL = `
  UPDATE employee
     SET active = 0, deleted_at = NOW(3), deleted_by_id = ?, updated_at = NOW(3)
   WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`;

const HARD_DELETE_SQL = `
  DELETE FROM employee
   WHERE tenant_id = ? AND id = ?`;

/** Colunas dos lookups de unicidade (allow-list; nunca vêm de input). */
const UNIQUE_LOOKUP_COLUMNS = {
  email: 'email',
  document: 'document',
  userId: 'user_id',
} as const;

/** Allow-list campo do input → coluna gravável no UPDATE. */
const UPDATABLE_COLUMNS = {
  userId: 'user_id',
  name: 'name',
  email: 'email',
  document: 'document',
  position: 'position',
  active: 'active',
} as const satisfies Record<
  keyof Omit<UpdateEmployeeInput, 'updatedById'>,
  string
>;

interface EmployeeRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  email: string;
  document: string;
  position: string | null;
  active: number | boolean;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: EmployeeRow): EmployeeRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    document: row.document,
    position: row.position,
    active: Number(row.active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Monta o SET só com os campos definidos (`null` grava NULL), mais a
 * auditoria.
 */
function buildSet(input: UpdateEmployeeInput): {
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

/** `IEmployeeRepository` em SQL; todo acesso filtra por `tenant_id`. */
export class EmployeeRepository implements IEmployeeRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async list(
    filter: EmployeeListFilter,
  ): Promise<{ data: EmployeeRecord[]; total: number }> {
    const { page, count } = buildEmployeeListQuery(filter);
    const [rows, counted] = await Promise.all([
      this.db.query<EmployeeRow>(page.sql, page.params),
      this.db.queryOne<{ total: number | string }>(count.sql, count.params),
    ]);
    return { data: rows.map(toRecord), total: Number(counted?.total ?? 0) };
  }

  findById(tenantId: string, id: string): Promise<EmployeeRecord | null> {
    return this.findWith(this.db, tenantId, id);
  }

  findIdByEmail(tenantId: string, email: string): Promise<string | null> {
    return this.findIdBy('email', tenantId, email);
  }

  findIdByDocument(tenantId: string, document: string): Promise<string | null> {
    return this.findIdBy('document', tenantId, document);
  }

  findIdByUserId(tenantId: string, userId: string): Promise<string | null> {
    return this.findIdBy('userId', tenantId, userId);
  }

  create(input: CreateEmployeeInput): Promise<EmployeeRecord> {
    const id = randomUUID();
    return this.db.runInTransaction(async (tx) => {
      await tx.insert(INSERT_SQL, [
        id,
        input.tenantId,
        input.userId,
        input.name,
        input.email,
        input.document,
        input.position,
        input.active,
        input.createdById,
      ]);
      return this.findOrThrow(tx, input.tenantId, id);
    });
  }

  update(
    tenantId: string,
    id: string,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeRecord> {
    const set = buildSet(input);
    return this.db.runInTransaction(async (tx) => {
      await tx.update(
        `UPDATE employee SET ${set.sql} WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`,
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

  async hardDelete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.db.delete(HARD_DELETE_SQL, [tenantId, id]);
    return result.affectedRows > 0;
  }

  /** Não filtra exclusão: os uniques do tenant também valem para excluídos. */
  private async findIdBy(
    field: keyof typeof UNIQUE_LOOKUP_COLUMNS,
    tenantId: string,
    value: string,
  ): Promise<string | null> {
    const column = UNIQUE_LOOKUP_COLUMNS[field];
    const row = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM employee WHERE tenant_id = ? AND ${column} = ? LIMIT 1`,
      [tenantId, value],
    );
    return row?.id ?? null;
  }

  private async findWith(
    conn: ITransactionalConnection,
    tenantId: string,
    id: string,
  ): Promise<EmployeeRecord | null> {
    const row = await conn.queryOne<EmployeeRow>(FIND_SQL, [tenantId, id]);
    return row ? toRecord(row) : null;
  }

  private async findOrThrow(
    conn: ITransactionalConnection,
    tenantId: string,
    id: string,
  ): Promise<EmployeeRecord> {
    const employee = await this.findWith(conn, tenantId, id);
    if (!employee) {
      throw new Error(`Funcionário ${id} não encontrado após gravação.`);
    }
    return employee;
  }
}
