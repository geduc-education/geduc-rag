/**
 * CLI de migration: `npm run db:migrate`.
 *
 * Aplica `database/migrations/*.sql` pendentes (registro em
 * `schema_migrations`), com baseline das migrations do Prisma já aplicadas.
 * Imprime só o host do banco, nunca a `DATABASE_URL`.
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { buildPoolOptions } from '../src/@core/infra/adapters/mysql.adapter';
import {
  MigrationFile,
  runMigrations,
} from '../src/database/migrator/migration-runner';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

function readMigrationFiles(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      name: basename(file, '.sql'),
      sql: readFileSync(join(MIGRATIONS_DIR, file), 'utf8'),
    }));
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não definida.');
  const { host, port, user, password, database } = buildPoolOptions(
    databaseUrl,
    1,
  );
  console.log(`db:migrate em ${host}`);
  const conn = await createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    timezone: 'Z',
  });
  try {
    const report = await runMigrations(
      {
        query: async (sql, params) =>
          (await conn.query(sql, params as unknown[] | undefined))[0],
      },
      readMigrationFiles(),
    );
    console.log(`applied: ${report.applied.join(', ') || '(nenhuma)'}`);
    console.log(`baselined: ${report.baselined.join(', ') || '(nenhuma)'}`);
  } finally {
    await conn.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
