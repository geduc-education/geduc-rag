import type { Pool } from 'mysql2/promise';
import {
  ensureSafeWhere,
  UnsafeMutationError,
} from '../../database/query-builder/mutation-guard';
import { buildPoolOptions, MysqlAdapter } from '../mysql.adapter';

type ConnectionListener = (conn: { query: jest.Mock }) => void;

function makeConnection() {
  return {
    query: jest.fn().mockResolvedValue([[], []]),
    release: jest.fn(),
  };
}

interface FakePool {
  query: jest.Mock;
  getConnection: jest.Mock;
  end: jest.Mock;
  on: jest.Mock;
}

function makePool(conn = makeConnection()) {
  const listeners: ConnectionListener[] = [];
  const pool: FakePool = {
    query: jest.fn().mockResolvedValue([[{ id: 1 }], []]),
    getConnection: jest.fn().mockResolvedValue(conn),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
  pool.on.mockImplementation((event: string, listener: ConnectionListener) => {
    if (event === 'connection') listeners.push(listener);
    return pool;
  });
  return { pool, conn, listeners };
}

function adapterOf(pool: FakePool) {
  return new MysqlAdapter(pool as unknown as Pool);
}

function sqlCalls(mock: jest.Mock): unknown[] {
  return mock.mock.calls.map((call: unknown[]) => call[0]);
}

describe('buildPoolOptions', () => {
  const url =
    'mysql://u:p%40x@localhost:3307/geduc_rag?allowPublicKeyRetrieval=true';

  it('faz o parse da URL e decodifica a senha', () => {
    const options = buildPoolOptions(url, 7);
    expect(options).toMatchObject({
      host: 'localhost',
      port: 3307,
      user: 'u',
      password: 'p@x',
      database: 'geduc_rag',
      connectionLimit: 7,
    });
  });

  it('fixa UTC, Date nativo e espera por conexão', () => {
    const options = buildPoolOptions(url, 7);
    expect(options.timezone).toBe('Z');
    expect(options.dateStrings).toBe(false);
    expect(options.waitForConnections).toBe(true);
  });

  it('descarta os query params da URL', () => {
    const options = buildPoolOptions(url, 7);
    expect(options).not.toHaveProperty('allowPublicKeyRetrieval');
  });
});

describe('MysqlAdapter', () => {
  it("roda SET time_zone = '+00:00' em toda conexão nova do pool", () => {
    const { pool, listeners } = makePool();
    adapterOf(pool);
    expect(listeners).toHaveLength(1);
    const newConn = { query: jest.fn() };
    listeners[0](newConn);
    expect(sqlCalls(newConn.query)[0]).toBe("SET time_zone = '+00:00'");
  });

  it('não abre conexão no construtor', () => {
    const { pool } = makePool();
    adapterOf(pool);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  it('query devolve as rows e queryOne a primeira ou null', async () => {
    const { pool } = makePool();
    const adapter = adapterOf(pool);
    await expect(adapter.query('SELECT 1', [])).resolves.toEqual([{ id: 1 }]);
    await expect(adapter.queryOne('SELECT 1')).resolves.toEqual({ id: 1 });
    pool.query.mockResolvedValueOnce([[], []]);
    await expect(adapter.queryOne('SELECT 1')).resolves.toBeNull();
    expect(pool.query).toHaveBeenCalledWith('SELECT 1', []);
  });

  it('insert devolve affectedRows e insertId', async () => {
    const { pool } = makePool();
    pool.query.mockResolvedValueOnce([
      { affectedRows: 2, insertId: 5, warningStatus: 0 },
      undefined,
    ]);
    const adapter = adapterOf(pool);
    await expect(
      adapter.insert('INSERT INTO t (a) VALUES ?', [[[1], [2]]]),
    ).resolves.toEqual({ affectedRows: 2, insertId: 5 });
  });

  it('update sem WHERE rejeita com UnsafeMutationError e não chega ao pool', async () => {
    const { pool } = makePool();
    const adapter = adapterOf(pool);
    await expect(
      adapter.update('UPDATE user SET name = ?', ['x']),
    ).rejects.toBeInstanceOf(UnsafeMutationError);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('delete com WHERE trivial rejeita com UnsafeMutationError', async () => {
    const { pool } = makePool();
    const adapter = adapterOf(pool);
    await expect(
      adapter.delete('DELETE FROM user WHERE 1=1', []),
    ).rejects.toBeInstanceOf(UnsafeMutationError);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('runInTransaction emite START TRANSACTION/COMMIT e libera a conexão', async () => {
    const { pool, conn } = makePool();
    conn.query.mockResolvedValue([{ affectedRows: 1, insertId: 0 }, undefined]);
    const adapter = adapterOf(pool);
    const result = await adapter.runInTransaction(async (tx) => {
      await tx.update('UPDATE user SET name = ? WHERE id = ?', ['x', 'u1']);
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(sqlCalls(conn.query)).toEqual([
      'START TRANSACTION',
      'UPDATE user SET name = ? WHERE id = ?',
      'COMMIT',
    ]);
    expect(pool.query).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('runInTransaction faz ROLLBACK, relança e libera a conexão quando o work falha', async () => {
    const { pool, conn } = makePool();
    const adapter = adapterOf(pool);
    const failure = new Error('boom');
    await expect(
      adapter.runInTransaction(() => Promise.reject(failure)),
    ).rejects.toBe(failure);
    expect(sqlCalls(conn.query)).toEqual(['START TRANSACTION', 'ROLLBACK']);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('tx.delete sem WHERE rejeita antes de enviar o SQL e faz ROLLBACK', async () => {
    const { pool, conn } = makePool();
    const adapter = adapterOf(pool);
    await expect(
      adapter.runInTransaction((tx) => tx.delete('DELETE FROM user')),
    ).rejects.toBeInstanceOf(UnsafeMutationError);
    expect(sqlCalls(conn.query)).toEqual(['START TRANSACTION', 'ROLLBACK']);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy encerra o pool', async () => {
    const { pool } = makePool();
    await adapterOf(pool).onModuleDestroy();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});

describe('ensureSafeWhere', () => {
  it.each([
    'UPDATE user SET a = ?',
    'DELETE FROM user WHERE TRUE',
    "DELETE FROM user WHERE '1'='1'",
    'DELETE FROM user WHERE id = ? -- x',
    'DELETE FROM user WHERE id = ? # x',
    'DELETE FROM user WHERE id',
  ])('rejeita %s', (sql) => {
    expect(() => ensureSafeWhere(sql)).toThrow(UnsafeMutationError);
  });

  it.each([
    'UPDATE user SET a = ? WHERE id = ?',
    'DELETE FROM user_profile WHERE user_id = ? AND profile_id IN (?)',
    'DELETE FROM user_profile WHERE user_id = ? AND profile_id NOT IN (?)',
  ])('aceita %s', (sql) => {
    expect(() => ensureSafeWhere(sql)).not.toThrow();
  });
});
