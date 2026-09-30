/**
 * CLI do seed: `npm run db:seed`.
 *
 * RBAC (catálogo de permissões + perfis default), tenant default e usuário
 * bootstrap SUPERADMIN (protegido) vinculado ao perfil Administrador e ao
 * tenant default. Idempotente. Guard NODE_ENV=production: nunca semeia em
 * produção (checado antes de abrir conexão).
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { createPool } from 'mysql2/promise';
import {
  buildPoolOptions,
  MysqlAdapter,
} from '../src/@core/infra/adapters/mysql.adapter';
import { runSeed, SeedEnv } from '../src/database/seed/run-seed';

function readSeedEnv(): SeedEnv {
  return {
    nodeEnv: process.env.NODE_ENV,
    adminEmail: (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@rag.local')
      .trim()
      .toLowerCase(),
    adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    adminName: process.env.BOOTSTRAP_ADMIN_NAME ?? 'Super Admin',
  };
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.log('[seed] NODE_ENV=production — seed abortado (guard).');
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não definida.');
  const adapter = new MysqlAdapter(
    createPool(buildPoolOptions(databaseUrl, 1)),
  );
  try {
    const report = await runSeed(adapter, readSeedEnv(), (password) =>
      argon2.hash(password),
    );
    console.log('[seed] concluído:', report);
  } finally {
    await adapter.onModuleDestroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
