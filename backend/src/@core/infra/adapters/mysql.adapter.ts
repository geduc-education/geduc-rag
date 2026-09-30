import { Logger, OnModuleDestroy } from '@nestjs/common';
import type { PoolConnection as CorePoolConnection } from 'mysql2';
import type {
  Pool,
  PoolConnection,
  PoolOptions,
  ResultSetHeader,
} from 'mysql2/promise';
import type {
  IDatabaseConnection,
  ITransactionalConnection,
  MutationResult,
  SqlParams,
} from '../../application/adapters/database-connection.interface';
import { ensureSafeWhere } from '../database/query-builder/mutation-guard';

const SESSION_TIMEZONE_SQL = "SET time_zone = '+00:00'";

/**
 * Converte a `DATABASE_URL` em opções do pool do mysql2. Os query params da
 * URL são descartados (`allowPublicKeyRetrieval` é do driver `mariadb`).
 * Datas em UTC e como `Date`, como o Prisma fazia.
 */
export function buildPoolOptions(
  databaseUrl: string,
  poolMax: number,
): PoolOptions {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    connectionLimit: poolMax,
    timezone: 'Z',
    dateStrings: false,
    waitForConnections: true,
  };
}

type RunSql = (sql: string, params?: SqlParams) => Promise<unknown>;
type QueryValues = Parameters<PoolConnection['query']>[1];

/** `SqlParams` é readonly na porta; o driver só lê os valores. */
function toValues(params?: SqlParams): QueryValues {
  return params as QueryValues;
}

function toMutationResult(result: unknown): MutationResult {
  const header = result as ResultSetHeader;
  return { affectedRows: header.affectedRows, insertId: header.insertId };
}

/** Implementa as operações sobre um executor (pool ou conexão dedicada). */
class MysqlRunner implements ITransactionalConnection {
  constructor(private readonly run: RunSql) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParams,
  ): Promise<T[]> {
    return (await this.run(sql, params)) as T[];
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParams,
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async insert(sql: string, params?: SqlParams): Promise<MutationResult> {
    return toMutationResult(await this.run(sql, params));
  }

  async update(sql: string, params?: SqlParams): Promise<MutationResult> {
    ensureSafeWhere(sql);
    return toMutationResult(await this.run(sql, params));
  }

  async delete(sql: string, params?: SqlParams): Promise<MutationResult> {
    ensureSafeWhere(sql);
    return toMutationResult(await this.run(sql, params));
  }
}

/**
 * Adapter mysql2 da porta `IDatabaseConnection`. Usa `query` (protocolo
 * texto, escape no cliente) para suportar `IN (?)` com array e `VALUES ?` em
 * lote. O pool é preguiçoso: nada conecta no boot.
 */
export class MysqlAdapter
  extends MysqlRunner
  implements IDatabaseConnection, OnModuleDestroy
{
  private readonly logger = new Logger(MysqlAdapter.name);

  constructor(private readonly pool: Pool) {
    super(async (sql, params) => (await pool.query(sql, toValues(params)))[0]);
    // O evento repassa a conexão de callback do mysql2 (não a de Promise).
    pool.on('connection', (conn) =>
      this.applySessionTimezone(conn as unknown as CorePoolConnection),
    );
  }

  async runInTransaction<T>(
    work: (tx: ITransactionalConnection) => Promise<T>,
  ): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      return await this.inTransaction(conn, work);
    } finally {
      conn.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private async inTransaction<T>(
    conn: PoolConnection,
    work: (tx: ITransactionalConnection) => Promise<T>,
  ): Promise<T> {
    await conn.query('START TRANSACTION');
    try {
      const tx = new MysqlRunner(
        async (sql, params) => (await conn.query(sql, toValues(params)))[0],
      );
      const result = await work(tx);
      await conn.query('COMMIT');
      return result;
    } catch (error) {
      await conn.query('ROLLBACK');
      throw error;
    }
  }

  private applySessionTimezone(conn: CorePoolConnection): void {
    conn.query(SESSION_TIMEZONE_SQL, (error: Error | null) => {
      if (error)
        this.logger.error(`Falha ao fixar time_zone: ${error.message}`);
    });
  }
}
