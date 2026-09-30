import { randomUUID } from 'node:crypto';
import type {
  IDatabaseConnection,
  ITransactionalConnection,
} from '../../../../../@core/application/adapters/database-connection.interface';
import type { TenantScope } from '../../../../../common/tenancy/tenant-access.service';
import type {
  CreateTenantInput,
  ITenantRepository,
  TenantRecord,
  UpdateTenantInput,
} from '../../../application/interface/repository/tenant.repository.interface';

const COLUMNS = 'id, name, slug, active, created_at, updated_at';

const LIST_ALL_SQL = `
  SELECT ${COLUMNS}
    FROM tenant
   WHERE deleted_at IS NULL
   ORDER BY name ASC`;

const LIST_IN_SQL = `
  SELECT ${COLUMNS}
    FROM tenant
   WHERE id IN (?) AND deleted_at IS NULL
   ORDER BY name ASC`;

const FIND_SQL = `
  SELECT ${COLUMNS}
    FROM tenant
   WHERE id = ? AND deleted_at IS NULL
   LIMIT 1`;

const INSERT_TENANT_SQL = `
  INSERT INTO tenant (id, name, slug, active, created_by_id, updated_at)
  VALUES (?, ?, ?, ?, ?, NOW(3))`;

const INSERT_LINK_SQL = `
  INSERT INTO user_tenant (id, user_id, tenant_id)
  VALUES (?, ?, ?)`;

const COUNT_SQL = `
  SELECT COUNT(*) AS total
    FROM tenant
   WHERE id IN (?) AND deleted_at IS NULL`;

/** Allow-list campo do input → coluna gravável no UPDATE. */
const UPDATABLE_COLUMNS = {
  name: 'name',
  slug: 'slug',
  active: 'active',
} as const satisfies Record<
  keyof Omit<UpdateTenantInput, 'updatedById'>,
  string
>;

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  active: number | boolean;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: TenantRow): TenantRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: Number(row.active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Monta o SET só com os campos definidos, mais a auditoria. */
function buildSet(input: UpdateTenantInput): {
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

export class TenantRepository implements ITenantRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async list(scope: TenantScope): Promise<TenantRecord[]> {
    if (scope !== 'all' && scope.length === 0) return [];
    const rows =
      scope === 'all'
        ? await this.db.query<TenantRow>(LIST_ALL_SQL, [])
        : await this.db.query<TenantRow>(LIST_IN_SQL, [scope]);
    return rows.map(toRecord);
  }

  findById(id: string): Promise<TenantRecord | null> {
    return this.findWith(this.db, id);
  }

  create(input: CreateTenantInput): Promise<TenantRecord> {
    const id = randomUUID();
    return this.db.runInTransaction(async (tx) => {
      await tx.insert(INSERT_TENANT_SQL, [
        id,
        input.name,
        input.slug,
        input.active,
        input.createdById,
      ]);
      if (input.linkUserId) {
        await tx.insert(INSERT_LINK_SQL, [randomUUID(), input.linkUserId, id]);
      }
      return this.findOrThrow(tx, id);
    });
  }

  update(id: string, input: UpdateTenantInput): Promise<TenantRecord> {
    const set = buildSet(input);
    return this.db.runInTransaction(async (tx) => {
      await tx.update(`UPDATE tenant SET ${set.sql} WHERE id = ?`, [
        ...set.params,
        id,
      ]);
      return this.findOrThrow(tx, id);
    });
  }

  async countExisting(ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const row = await this.db.queryOne<{ total: number | string }>(COUNT_SQL, [
      ids,
    ]);
    return Number(row?.total ?? 0);
  }

  private async findWith(
    conn: ITransactionalConnection,
    id: string,
  ): Promise<TenantRecord | null> {
    const row = await conn.queryOne<TenantRow>(FIND_SQL, [id]);
    return row ? toRecord(row) : null;
  }

  private async findOrThrow(
    conn: ITransactionalConnection,
    id: string,
  ): Promise<TenantRecord> {
    const tenant = await this.findWith(conn, id);
    if (!tenant) throw new Error(`Tenant ${id} não encontrado após gravação.`);
    return tenant;
  }
}
