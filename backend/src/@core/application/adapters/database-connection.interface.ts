/** Token de injeção da conexão com o banco (provido pelo `DatabaseModule`). */
export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

/** Valores posicionais dos placeholders `?` — nunca interpole valor no SQL. */
export type SqlParams = readonly unknown[];

/** Resultado de INSERT/UPDATE/DELETE. */
export interface MutationResult {
  affectedRows: number;
  insertId: number;
}

/**
 * Operações de leitura e escrita sobre uma conexão. `update` e `delete`
 * passam pela guarda de mutação (`ensureSafeWhere`) antes de enviar o SQL.
 */
export interface ITransactionalConnection {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParams,
  ): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParams,
  ): Promise<T | null>;
  insert(sql: string, params?: SqlParams): Promise<MutationResult>;
  update(sql: string, params?: SqlParams): Promise<MutationResult>;
  delete(sql: string, params?: SqlParams): Promise<MutationResult>;
}

/**
 * Porta de acesso a dados. Transação só por `runInTransaction`: o `work`
 * recebe uma conexão dedicada; erro lançado faz ROLLBACK e é relançado.
 */
export interface IDatabaseConnection extends ITransactionalConnection {
  runInTransaction<T>(
    work: (tx: ITransactionalConnection) => Promise<T>,
  ): Promise<T>;
}
