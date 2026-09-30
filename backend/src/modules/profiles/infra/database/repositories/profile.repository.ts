import { IDatabaseConnection } from '../../../../../@core/application/adapters/database-connection.interface';
import {
  IProfileRepository,
  ProfileWithPermissions,
} from '../../../application/interface/repository/profile.repository.interface';

const ACTIVE = 1;

// `system` e `key` são palavras reservadas do MySQL 8: sempre com crase.
const PROFILE_COLUMNS = `
  SELECT p.id, p.name, p.description, p.\`system\` AS \`system\`
    FROM profile p
   WHERE p.active = ? AND p.deleted_at IS NULL`;

const ORDER_BY = ' ORDER BY p.name ASC';

const LIST_ACTIVE_SQL = `${PROFILE_COLUMNS}${ORDER_BY}`;

const FIND_BY_IDS_SQL = `${PROFILE_COLUMNS} AND p.id IN (?)${ORDER_BY}`;

const KEYS_SQL = `
  SELECT pp.profile_id, pe.\`key\` AS \`key\`
    FROM profile_permission pp
    JOIN permission pe ON pe.id = pp.permission_id
   WHERE pp.profile_id IN (?)`;

interface ProfileRow {
  id: string;
  name: string;
  description: string | null;
  system: number | boolean;
}

interface KeyRow {
  profile_id: string;
  key: string;
}

/** Cadastro de perfis: perfis numa query, chaves em lote na segunda. */
export class ProfileRepository implements IProfileRepository {
  constructor(private readonly db: IDatabaseConnection) {}

  async listActive(): Promise<ProfileWithPermissions[]> {
    const rows = await this.db.query<ProfileRow>(LIST_ACTIVE_SQL, [ACTIVE]);
    return this.withPermissions(rows);
  }

  async findActiveByIds(
    ids: readonly string[],
  ): Promise<ProfileWithPermissions[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.query<ProfileRow>(FIND_BY_IDS_SQL, [
      ACTIVE,
      [...ids],
    ]);
    return this.withPermissions(rows);
  }

  private async withPermissions(
    rows: ProfileRow[],
  ): Promise<ProfileWithPermissions[]> {
    if (rows.length === 0) return [];
    const keyRows = await this.db.query<KeyRow>(KEYS_SQL, [
      rows.map((row) => row.id),
    ]);
    const keysByProfile = groupKeys(keyRows);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      system: Number(row.system) === 1,
      permissionKeys: (keysByProfile.get(row.id) ?? []).sort(),
    }));
  }
}

function groupKeys(rows: KeyRow[]): Map<string, string[]> {
  const byProfile = new Map<string, string[]>();
  for (const row of rows) {
    const keys = byProfile.get(row.profile_id) ?? [];
    keys.push(row.key);
    byProfile.set(row.profile_id, keys);
  }
  return byProfile;
}
