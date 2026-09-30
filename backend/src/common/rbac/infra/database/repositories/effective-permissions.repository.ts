import { IDatabaseConnection } from '../../../../../@core/application/adapters/database-connection.interface';
import {
  IEffectivePermissionsRepository,
  UserGrants,
} from '../../../application/interface/repository/effective-permissions.repository.interface';

const ACTIVE = 1;

const USER_SQL = `
  SELECT u.is_super_admin
    FROM \`user\` u
   WHERE u.id = ? AND u.active = ? AND u.deleted_at IS NULL
   LIMIT 1`;

// `key` é palavra reservada do MySQL 8: sempre com crase.
const KEYS_SQL = `
  SELECT DISTINCT pe.\`key\` AS \`key\`
    FROM user_profile up
    JOIN profile p ON p.id = up.profile_id
    JOIN profile_permission pp ON pp.profile_id = p.id
    JOIN permission pe ON pe.id = pp.permission_id
   WHERE up.user_id = ? AND p.active = ? AND p.deleted_at IS NULL`;

interface UserRow {
  is_super_admin: number | boolean;
}

interface KeyRow {
  key: string;
}

/** Fonte única da query de permissão efetiva (união dos perfis ativos). */
export class EffectivePermissionsRepository implements IEffectivePermissionsRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async findActiveUserGrants(userId: string): Promise<UserGrants | null> {
    const user = await this.db.queryOne<UserRow>(USER_SQL, [userId, ACTIVE]);
    if (!user) return null;
    const rows = await this.db.query<KeyRow>(KEYS_SQL, [userId, ACTIVE]);
    return {
      isSuperAdmin: Number(user.is_super_admin) === 1,
      permissionKeys: rows.map((row) => row.key),
    };
  }
}
