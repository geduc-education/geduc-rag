import { createHash } from 'node:crypto';

/**
 * Conexão mínima usada pelo runner. `query` devolve as linhas do SELECT
 * (a CLI desembrulha o `[rows, fields]` do mysql2).
 */
export interface MigrationConnection {
  query(sql: string, params?: readonly unknown[]): Promise<unknown>;
}

export interface MigrationFile {
  name: string;
  sql: string;
}

export interface MigrationReport {
  applied: string[];
  baselined: string[];
}

/** Migration do runner → migration Prisma equivalente (baseline). */
export const PRISMA_BASELINE: Readonly<Record<string, string>> = {
  '0001_init': '20260924000000_init',
  '0002_rag_persistence': '20260925000000_rag_persistence',
};

export class MigrationChecksumError extends Error {
  constructor(name: string) {
    super(
      `Migration ${name} já aplicada com checksum diferente do arquivo atual.`,
    );
    this.name = 'MigrationChecksumError';
  }
}

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(191) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
)`;
const SELECT_REGISTERED_SQL = 'SELECT name, checksum FROM schema_migrations';
const INSERT_SQL =
  'INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)';
const PRISMA_TABLE_EXISTS_SQL = `SELECT COUNT(*) AS total FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = '_prisma_migrations'`;
const PRISMA_FINISHED_SQL = `SELECT migration_name FROM \`_prisma_migrations\`
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;

export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

async function rows<T>(conn: MigrationConnection, sql: string): Promise<T[]> {
  return (await conn.query(sql)) as T[];
}

async function loadRegistered(
  conn: MigrationConnection,
): Promise<Map<string, string>> {
  const registered = await rows<{ name: string; checksum: string }>(
    conn,
    SELECT_REGISTERED_SQL,
  );
  return new Map(registered.map((row) => [row.name, row.checksum]));
}

async function finishedPrismaMigrations(
  conn: MigrationConnection,
): Promise<Set<string>> {
  const [exists] = await rows<{ total: number | string }>(
    conn,
    PRISMA_TABLE_EXISTS_SQL,
  );
  if (!exists || Number(exists.total) === 0) return new Set();
  const finished = await rows<{ migration_name: string }>(
    conn,
    PRISMA_FINISHED_SQL,
  );
  return new Set(finished.map((row) => row.migration_name));
}

async function register(
  conn: MigrationConnection,
  file: MigrationFile,
  registered: Map<string, string>,
): Promise<void> {
  const checksum = checksumOf(file.sql);
  await conn.query(INSERT_SQL, [file.name, checksum]);
  registered.set(file.name, checksum);
}

/** Com `schema_migrations` vazia, registra sem executar o que o Prisma já aplicou. */
async function baseline(
  conn: MigrationConnection,
  files: MigrationFile[],
  registered: Map<string, string>,
): Promise<string[]> {
  if (registered.size > 0) return [];
  const finished = await finishedPrismaMigrations(conn);
  const baselined: string[] = [];
  for (const file of files) {
    const prismaName = PRISMA_BASELINE[file.name];
    if (prismaName && finished.has(prismaName)) {
      await register(conn, file, registered);
      baselined.push(file.name);
    }
  }
  return baselined;
}

function assertChecksums(
  files: MigrationFile[],
  registered: Map<string, string>,
): void {
  for (const file of files) {
    const stored = registered.get(file.name);
    if (stored !== undefined && stored !== checksumOf(file.sql)) {
      throw new MigrationChecksumError(file.name);
    }
  }
}

/**
 * Aplica as migrations pendentes em ordem de nome, uma por arquivo. Sem
 * `down`, sem `DROP`; `_prisma_migrations` só é lida para o baseline.
 */
export async function runMigrations(
  conn: MigrationConnection,
  files: MigrationFile[],
): Promise<MigrationReport> {
  const ordered = [...files].sort((a, b) => a.name.localeCompare(b.name));
  await conn.query(CREATE_TABLE_SQL);
  const registered = await loadRegistered(conn);
  assertChecksums(ordered, registered);
  const baselined = await baseline(conn, ordered, registered);
  const applied: string[] = [];
  for (const file of ordered) {
    if (registered.has(file.name)) continue;
    await conn.query(file.sql);
    await register(conn, file, registered);
    applied.push(file.name);
  }
  return { applied, baselined };
}
