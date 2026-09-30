import { IDatabaseConnection } from '../../../../../@core/application/adapters/database-connection.interface';
import {
  ITenantAccessRepository,
  UserTenantLinks,
} from '../../../application/interface/repository/tenant-access.repository.interface';

const ACTIVE = 1;

const USER_SQL = `
  SELECT u.is_super_admin
    FROM \`user\` u
   WHERE u.id = ? AND u.active = ? AND u.deleted_at IS NULL
   LIMIT 1`;

// Vínculo com tenant excluído é órfão e não concede nada.
const LINKS_SQL = `
  SELECT ut.tenant_id
    FROM user_tenant ut
    JOIN tenant t ON t.id = ut.tenant_id
   WHERE ut.user_id = ? AND t.deleted_at IS NULL`;

const TENANT_SQL = `
  SELECT id
    FROM tenant
   WHERE id = ? AND active = ? AND deleted_at IS NULL
   LIMIT 1`;

interface UserRow {
  is_super_admin: number | boolean;
}

interface LinkRow {
  tenant_id: string;
}

export class TenantAccessRepository implements ITenantAccessRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async findActiveUserTenants(userId: string): Promise<UserTenantLinks | null> {
    const user = await this.db.queryOne<UserRow>(USER_SQL, [userId, ACTIVE]);
    if (!user) return null;
    const rows = await this.db.query<LinkRow>(LINKS_SQL, [userId]);
    return {
      isSuperAdmin: Number(user.is_super_admin) === 1,
      tenantIds: rows.map((row) => row.tenant_id),
    };
  }

  async isTenantActive(tenantId: string): Promise<boolean> {
    const row = await this.db.queryOne(TENANT_SQL, [tenantId, ACTIVE]);
    return row !== null;
  }
}
