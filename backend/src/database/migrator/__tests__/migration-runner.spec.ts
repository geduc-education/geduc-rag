import {
  checksumOf,
  MigrationChecksumError,
  MigrationConnection,
  MigrationFile,
  PRISMA_BASELINE,
  runMigrations,
} from '../migration-runner';

const INIT_SQL = 'CREATE TABLE `users` (`id` VARCHAR(191) NOT NULL);';
const RAG_SQL = 'CREATE TABLE `documents` (`id` VARCHAR(191) NOT NULL);';

interface FakeState {
  /** Nomes Prisma concluídos; `null` = `_prisma_migrations` não existe. */
  prismaFinished: string[] | null;
  registered: Map<string, string>;
}

/** Conexão falsa: responde às consultas do runner e grava o SQL emitido. */
function fakeConnection(state: FakeState): {
  conn: MigrationConnection;
  sqls: string[];
} {
  const sqls: string[] = [];
  const conn: MigrationConnection = {
    query: (sql: string, params?: readonly unknown[]) => {
      sqls.push(sql);
      if (/FROM\s+schema_migrations/i.test(sql)) {
        return Promise.resolve(
          [...state.registered].map(([name, checksum]) => ({ name, checksum })),
        );
      }
      if (/information_schema\.tables/i.test(sql)) {
        return Promise.resolve([{ total: state.prismaFinished ? 1 : 0 }]);
      }
      if (/FROM\s+`?_prisma_migrations/i.test(sql)) {
        return Promise.resolve(
          (state.prismaFinished ?? []).map((migration_name) => ({
            migration_name,
          })),
        );
      }
      if (/INSERT\s+INTO\s+schema_migrations/i.test(sql) && params) {
        state.registered.set(String(params[0]), String(params[1]));
      }
      return Promise.resolve([]);
    },
  };
  return { conn, sqls };
}

function files(): MigrationFile[] {
  // Fora de ordem de propósito: o runner ordena por nome.
  return [
    { name: '0002_rag_persistence', sql: RAG_SQL },
    { name: '0001_init', sql: INIT_SQL },
  ];
}

describe('runMigrations', () => {
  it('banco vazio aplica 0001_init e 0002_rag_persistence nessa ordem e registra as duas', async () => {
    const state: FakeState = { prismaFinished: null, registered: new Map() };
    const { conn, sqls } = fakeConnection(state);

    const report = await runMigrations(conn, files());

    expect(report).toEqual({
      applied: ['0001_init', '0002_rag_persistence'],
      baselined: [],
    });
    expect(sqls.indexOf(INIT_SQL)).toBeGreaterThan(-1);
    expect(sqls.indexOf(RAG_SQL)).toBeGreaterThan(sqls.indexOf(INIT_SQL));
    expect(sqls[0]).toMatch(
      /CREATE TABLE IF NOT EXISTS schema_migrations[\s\S]*name VARCHAR\(191\) PRIMARY KEY[\s\S]*checksum CHAR\(64\) NOT NULL[\s\S]*applied_at DATETIME\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP\(3\)/,
    );
    expect(state.registered).toEqual(
      new Map([
        ['0001_init', checksumOf(INIT_SQL)],
        ['0002_rag_persistence', checksumOf(RAG_SQL)],
      ]),
    );
  });

  it('banco com _prisma_migrations concluídas faz baseline sem executar SQL das migrations', async () => {
    const state: FakeState = {
      prismaFinished: [
        PRISMA_BASELINE['0001_init'],
        PRISMA_BASELINE['0002_rag_persistence'],
      ],
      registered: new Map(),
    };
    const { conn, sqls } = fakeConnection(state);

    const report = await runMigrations(conn, files());

    expect(report).toEqual({
      applied: [],
      baselined: ['0001_init', '0002_rag_persistence'],
    });
    expect(sqls).not.toContain(INIT_SQL);
    expect(sqls).not.toContain(RAG_SQL);
    expect(state.registered.get('0001_init')).toBe(checksumOf(INIT_SQL));
    expect(state.registered.get('0002_rag_persistence')).toBe(
      checksumOf(RAG_SQL),
    );
  });

  it('baseline só cobre as migrations Prisma concluídas e aplica o resto', async () => {
    const state: FakeState = {
      prismaFinished: [PRISMA_BASELINE['0001_init']],
      registered: new Map(),
    };
    const { conn, sqls } = fakeConnection(state);

    const report = await runMigrations(conn, files());

    expect(report).toEqual({
      applied: ['0002_rag_persistence'],
      baselined: ['0001_init'],
    });
    expect(sqls).not.toContain(INIT_SQL);
    expect(sqls).toContain(RAG_SQL);
  });

  it('não repete migrations já registradas', async () => {
    const state: FakeState = {
      prismaFinished: null,
      registered: new Map([
        ['0001_init', checksumOf(INIT_SQL)],
        ['0002_rag_persistence', checksumOf(RAG_SQL)],
      ]),
    };
    const { conn, sqls } = fakeConnection(state);

    const report = await runMigrations(conn, files());

    expect(report).toEqual({ applied: [], baselined: [] });
    expect(sqls).not.toContain(INIT_SQL);
    expect(sqls).not.toContain(RAG_SQL);
  });

  it('checksum divergente lança MigrationChecksumError antes de aplicar qualquer outra', async () => {
    const state: FakeState = {
      prismaFinished: null,
      registered: new Map([['0001_init', checksumOf('SQL antigo')]]),
    };
    const { conn, sqls } = fakeConnection(state);

    await expect(runMigrations(conn, files())).rejects.toBeInstanceOf(
      MigrationChecksumError,
    );
    expect(sqls).not.toContain(RAG_SQL);
    expect(state.registered.has('0002_rag_persistence')).toBe(false);
  });

  it('nenhum SQL emitido contém DROP nem altera _prisma_migrations', async () => {
    for (const prismaFinished of [null, [PRISMA_BASELINE['0001_init']]]) {
      const { conn, sqls } = fakeConnection({
        prismaFinished,
        registered: new Map(),
      });
      await runMigrations(conn, files());
      for (const sql of sqls) {
        expect(sql).not.toMatch(/\bDROP\b/i);
        expect(sql).not.toMatch(
          /(INSERT|UPDATE|DELETE|ALTER)[\s\S]*_prisma_migrations/i,
        );
      }
    }
  });
});

describe('checksumOf', () => {
  it('devolve sha256 em hex', () => {
    expect(checksumOf('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
