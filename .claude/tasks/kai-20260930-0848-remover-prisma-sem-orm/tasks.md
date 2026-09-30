# Tasks

| ID | Camada | Descrição | Dependências | Paralelizável | Complexidade | Agente | Status |
|---|---|---|---|---|---|---|---|
| T-01 | infra | Porta `IDatabaseConnection`, `MysqlAdapter` (mysql2), guarda de mutação e `DatabaseModule` com `DATABASE_CONNECTION` convivendo com o Prisma | — | sim | alta | Platão | [x] |
| T-02 | infra | Query builder mínimo (`:named` → `?`, filtros, SELECT paginado com allow-list) e `isMysqlDuplicateEntry` | — | sim | média | Arquimedes | [x] |
| T-03 | database | Runner de migration (`schema_migrations` + checksum), baseline 0001/0002 e `npm run db:migrate` | T-01 | sim | alta | Spock | [x] |
| T-04 | backend | `DocumentRepository` em SQL e wiring em `documents.providers.ts` | T-01, T-02 | sim | média | Darwin | [x] |
| T-05 | backend | `ConversationRepository` em SQL (upsert + mensagens em lote na transação) e wiring em `chat.providers.ts` | T-01 | sim | média | Aang | [x] |
| T-06 | backend | `MysqlVectorStoreClient` e wiring em `vector-store.module.ts` | T-01 | sim | média | Saitama | [x] |
| T-07 | backend | Repositórios de RBAC e tenancy; `EffectivePermissionsService` e `TenantAccessService` sem Prisma; e2e sobrescreve os repositórios | T-01 | sim | alta | Jaspion | [x] |
| T-08 | backend | `IProfileRepository` + `ProfilesService` sem Prisma | T-01 | sim | simples | Levi | [ ] |
| T-09 | backend | `ITenantRepository` + `TenantsService` sem Prisma; `tenantWhere()` removido | T-01, T-02, T-07 | sim | média | Yoda | [ ] |
| T-10 | backend | `IUserRepository` (agregado em lote por `IN`, vínculos N:N) e `users.mapper.ts` | T-01, T-02, T-07 | sim | alta | Goku | [ ] |
| T-11 | database | Seed novo sem Prisma (`runSeed` + CLI `backend/database/seed.ts`) | T-01 | sim | média | Naruto | [ ] |
| T-12 | backend | `AuthService` sobre `IUserRepository` | T-10 | sim | média | Kratos | [ ] |
| T-13 | backend | `UsersService` e `users.policy.ts` sobre repositórios; `users.select.ts` removido | T-02, T-07, T-08, T-09, T-10 | sim | alta | Thanos | [ ] |
| T-14 | infra | Remoção do Prisma: deps, `prisma/`, `prisma.config.ts`, `PrismaService`, Dockerfile, dotfiles, e2e, comentários | T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13 | sim | média | Maquiavel | [ ] |
| T-15 | docs | Docs e agentes sem Prisma (regras de SQL/repositório e de migration) | T-03, T-11, T-13 | sim | média | Gandalf | [ ] |
| T-16 | infra | Hooks `protect-migrations.sh` e `protect-db.sh` no novo caminho, sem padrões do Prisma | T-03 | sim | simples | Batman | [ ] |
| T-17 | qa | Validação final: `npm ci`, build, lint, typecheck, testes, e2e, migrate/seed em banco local, comparação de schema e smoke | T-14, T-15, T-16 | não | alta | Sherlock | [ ] |

## Detalhamento

### T-01 — Porta de conexão, MysqlAdapter e DatabaseModule

**Camada:** infra
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Platão

**Arquivos prováveis**
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/@core/application/adapters/database-connection.interface.ts`
- `backend/src/@core/infra/adapters/mysql.adapter.ts`
- `backend/src/@core/infra/adapters/__tests__/mysql.adapter.spec.ts`
- `backend/src/@core/infra/database/query-builder/mutation-guard.ts`
- `backend/src/database/database.module.ts`

**Interface**
- Produz: `export const DATABASE_CONNECTION = 'DATABASE_CONNECTION'` em `database-connection.interface.ts`
- Produz: `export type SqlParams = readonly unknown[]`; `export interface MutationResult { affectedRows: number; insertId: number }`
- Produz: `export interface ITransactionalConnection { query<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T[]>; queryOne<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T | null>; insert(sql: string, params?: SqlParams): Promise<MutationResult>; update(sql: string, params?: SqlParams): Promise<MutationResult>; delete(sql: string, params?: SqlParams): Promise<MutationResult> }`
- Produz: `export interface IDatabaseConnection extends ITransactionalConnection { runInTransaction<T>(work: (tx: ITransactionalConnection) => Promise<T>): Promise<T> }` — sem `startTransaction`/`commit`/`rollback`, sem parâmetro `user`, sem trilha de auditoria
- Produz: `export function buildPoolOptions(databaseUrl: string, poolMax: number): PoolOptions` — parse com `new URL` (host, port, user e password com `decodeURIComponent`, database do pathname), ignora os query params da URL (`allowPublicKeyRetrieval` é do driver `mariadb`), fixa `connectionLimit: poolMax`, `timezone: 'Z'`, `dateStrings: false`, `waitForConnections: true`
- Produz: `export class MysqlAdapter implements IDatabaseConnection, OnModuleDestroy { constructor(pool: Pool) }` (`Pool` de `mysql2/promise`) — usa `pool.query` (não `execute`), para `IN (?)` com array e `VALUES ?` em lote; `query` devolve as rows, `queryOne` devolve `rows[0] ?? null`, `insert`/`update`/`delete` devolvem `{ affectedRows, insertId }`; `runInTransaction` faz `getConnection` → `START TRANSACTION` → work → `COMMIT`, `ROLLBACK` no erro (relança) e `release()` no `finally`; toda conexão nova do pool roda `SET time_zone = '+00:00'`; `onModuleDestroy` chama `pool.end()`; nada conecta no boot (pool preguiçoso)
- Produz: `export function ensureSafeWhere(sql: string): void` e `export class UnsafeMutationError extends Error` em `mutation-guard.ts` — lança em UPDATE/DELETE sem WHERE, com WHERE trivial (`1=1`, `TRUE`, `'1'='1'`), com `--` ou `#`, ou sem operador de comparação; `update`/`delete` do adapter (e do `tx`) chamam antes de enviar o SQL
- Produz: `DatabaseModule` `@Global` provê e exporta `DATABASE_CONNECTION` (`useFactory: (config: ConfigService) => new MysqlAdapter(createPool(buildPoolOptions(config.getOrThrow('DATABASE_URL'), Number(config.get('DB_POOL_MAX') ?? 10))))`) e continua provendo `PrismaService` até T-14
- Consome: nada

**Teste RED**
- `backend/src/@core/infra/adapters/__tests__/mysql.adapter.spec.ts` — com pool falso (`jest.fn()`), `buildPoolOptions('mysql://u:p%40x@localhost:3307/geduc_rag?allowPublicKeyRetrieval=true', 7)` devolve `host: 'localhost'`, `port: 3307`, `password: 'p@x'`, `database: 'geduc_rag'`, `connectionLimit: 7`, `timezone: 'Z'` e não tem a chave `allowPublicKeyRetrieval`; `runInTransaction` emite `START TRANSACTION`/`COMMIT` e, com o work lançando, `ROLLBACK` e `release()`; `update('UPDATE user SET name = ?', ['x'])` rejeita com `UnsafeMutationError` e o pool não recebe `query` — falha porque `MysqlAdapter`, `buildPoolOptions` e `ensureSafeWhere` não existem (comando: `cd backend && npx jest src/@core/infra/adapters/__tests__/mysql.adapter.spec.ts`)

**Critério de aceite**
- O spec do adapter passa com pelo menos 6 casos, `mysql2` aparece em `dependencies` de `backend/package.json`, e o e2e continua passando com o `DATABASE_URL` fictício de `test/setup-e2e.ts` (nenhuma conexão aberta no boot).

**Validação**
- `cd backend && npx jest src/@core/infra/adapters/__tests__/mysql.adapter.spec.ts` (evidência: `Tests: N passed`, N ≥ 6, incluindo o caso de `timezone: 'Z'` e o de `SET time_zone = '+00:00'` na conexão nova)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída; baseline vazio)
- `cd backend && npx eslint "src/@core/**/*.ts" "src/database/**/*.ts"` (evidência: exit 0 e 0 linhas de saída)
- `cd backend && npm run test:e2e` (evidência: `Tests:` com 0 failed)

### T-02 — Query builder mínimo e isMysqlDuplicateEntry

**Camada:** infra
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Arquimedes

**Arquivos prováveis**
- `backend/src/@core/infra/database/query-builder/sql-params.ts`
- `backend/src/@core/infra/database/query-builder/filters.ts`
- `backend/src/@core/infra/database/query-builder/paged-select.ts`
- `backend/src/@core/infra/database/query-builder/README.md`
- `backend/src/@core/infra/database/query-builder/__tests__/query-builder.spec.ts`
- `backend/src/@core/shared/exceptions/400/duplicate-entry.ts`
- `backend/src/@core/shared/exceptions/__tests__/duplicate-entry.spec.ts`

**Interface**
- Produz: `export interface CompiledQuery { sql: string; params: unknown[] }` e `export function toPositional(sql: string, named: Record<string, unknown>): CompiledQuery` — troca `:nome` por `?` na ordem de ocorrência (nome repetido repete o valor), lança `InvalidQueryError` se um `:nome` não tem valor; nenhum `:nome` sobra no SQL
- Produz: `export class InvalidQueryError extends Error` em `sql-params.ts`
- Produz: `export interface FilterContext { where: string[]; params: Record<string, unknown> }` e `export function createFilterContext(): FilterContext`
- Produz: `export function addEq(ctx: FilterContext, column: string, name: string, value: unknown): void` — ignora `undefined` e `null`, mantém `0` e `false`
- Produz: `export function addIn(ctx: FilterContext, column: string, name: string, values: readonly unknown[] | undefined): void` — `undefined` ignora; array vazio gera `1 = 0` (nunca `IN ()`)
- Produz: `export function addLike(ctx: FilterContext, columns: readonly string[], name: string, term: string | undefined): void` — `trim`, vazio ignora; gera `(c1 LIKE :nome OR c2 LIKE :nome)` com o valor `%termo%`, escapando `\`, `%` e `_` (equivale ao `contains` do Prisma)
- Produz: `export function addRaw(ctx: FilterContext, fragment: string, params?: Record<string, unknown>): void` — fragmento fixo escrito no código (ex.: `u.deleted_at IS NULL`, `EXISTS (…)`), nunca input
- Produz: `export interface PageRequest { page: number; limit: number }` e `export interface PagedQuery { page: CompiledQuery; count: CompiledQuery }`
- Produz: `export function buildPagedSelect(input: { select: string; from: string; ctx: FilterContext; orderBy: string; allowedOrderBy: readonly string[]; page: PageRequest; maxLimit?: number }): PagedQuery` — `orderBy` precisa estar em `allowedOrderBy` (senão `InvalidQueryError`); `page` inteiro ≥ 1 e `limit` inteiro entre 1 e `maxLimit` (padrão 100), senão `InvalidQueryError`; página = `SELECT <select> FROM <from> WHERE … ORDER BY <orderBy> LIMIT ? OFFSET ?` (LIMIT/OFFSET como params numéricos, nunca interpolados); contagem = `SELECT COUNT(*) AS total FROM <from> WHERE …`; sem filtros, não emite `WHERE`
- Produz: `export function isMysqlDuplicateEntry(error: unknown): boolean` — `code === 'ER_DUP_ENTRY' || errno === 1062`, nunca pela mensagem
- Consome: nada

**Teste RED**
- `backend/src/@core/infra/database/query-builder/__tests__/query-builder.spec.ts`, `backend/src/@core/shared/exceptions/__tests__/duplicate-entry.spec.ts` — `toPositional('a = :x AND b = :x', { x: 1 })` devolve `sql: 'a = ? AND b = ?'` e `params: [1, 1]`; `addLike` com `'50%_a'` gera o param `'%50\\%\\_a%'`; `addIn` com `[]` gera `1 = 0`; `buildPagedSelect` com `orderBy` fora da allow-list lança `InvalidQueryError`, e com `page: 2, limit: 20` termina em `LIMIT ? OFFSET ?` com params finais `[20, 20]`; `isMysqlDuplicateEntry({ errno: 1062 })` é `true` e `isMysqlDuplicateEntry(new Error('Duplicate entry'))` é `false` — falha porque os módulos não existem (comando: `cd backend && npx jest src/@core/infra/database src/@core/shared/exceptions`)

**Critério de aceite**
- Os dois specs passam; nenhum SQL produzido pelos testes contém `:` seguido de letra nem `${`, e a contagem de `?` de cada `CompiledQuery` é igual a `params.length`.

**Validação**
- `cd backend && npx jest src/@core/infra/database src/@core/shared/exceptions` (evidência: `Tests: N passed`, incluindo os casos de `addLike` com `%`/`_` e de `addIn` vazio)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)
- `cd backend && npx eslint "src/@core/**/*.ts"` (evidência: exit 0 e 0 linhas de saída)

### T-03 — Runner de migration e baseline

**Camada:** database
**Dependências:** T-01
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Spock

**Arquivos prováveis**
- `backend/database/migrations/0001_init.sql`
- `backend/database/migrations/0002_rag_persistence.sql`
- `backend/database/migrate.ts`
- `backend/src/database/migrator/migration-runner.ts`
- `backend/src/database/migrator/__tests__/migration-runner.spec.ts`
- `backend/package.json`

**Interface**
- Produz: `0001_init.sql` e `0002_rag_persistence.sql` são cópias byte a byte de `backend/prisma/migrations/20260924000000_init/migration.sql` e `backend/prisma/migrations/20260925000000_rag_persistence/migration.sql` (copiar com `cp`, sem editar DDL)
- Produz: `export interface MigrationConnection { query(sql: string, params?: readonly unknown[]): Promise<unknown> }`, `export interface MigrationFile { name: string; sql: string }`, `export interface MigrationReport { applied: string[]; baselined: string[] }`
- Produz: `export const PRISMA_BASELINE: Readonly<Record<string, string>> = { '0001_init': '20260924000000_init', '0002_rag_persistence': '20260925000000_rag_persistence' }`
- Produz: `export function checksumOf(sql: string): string` (sha256 hex) e `export class MigrationChecksumError extends Error`
- Produz: `export async function runMigrations(conn: MigrationConnection, files: MigrationFile[]): Promise<MigrationReport>` — cria `schema_migrations (name VARCHAR(191) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))` se não existir; ordena por nome; com `schema_migrations` vazia e `_prisma_migrations` existente (`information_schema.tables`), registra como aplicadas, sem executar, as migrations de `PRISMA_BASELINE` cujo nome Prisma tem `finished_at IS NOT NULL AND rolled_back_at IS NULL`; aplica as pendentes em ordem, uma por arquivo, registrando nome + checksum; migration já registrada com checksum diferente lança `MigrationChecksumError` antes de aplicar qualquer outra; nunca `DROP`, nunca toca `_prisma_migrations`; sem `down`
- Produz: CLI `backend/database/migrate.ts` — `dotenv/config`, lê `DATABASE_URL`, abre uma conexão própria `mysql2/promise` com `multipleStatements: true` e `timezone: 'Z'` (reusando `buildPoolOptions` de T-01 para o parse), lê `backend/database/migrations/*.sql`, imprime `applied: …` e `baselined: …` e fecha a conexão; imprime só o host do banco, nunca a URL
- Produz: script `"db:migrate": "ts-node database/migrate.ts"` em `backend/package.json`
- Consome: T-01 `buildPoolOptions`

**Teste RED**
- `backend/src/database/migrator/__tests__/migration-runner.spec.ts` — com conexão falsa: banco vazio aplica `0001_init` e `0002_rag_persistence` nessa ordem e grava as duas em `schema_migrations`; banco com `_prisma_migrations` com as duas concluídas devolve `baselined: ['0001_init', '0002_rag_persistence']` e nenhum SQL das migrations é executado; checksum divergente lança `MigrationChecksumError`; nenhum SQL emitido contém `DROP` — falha porque `runMigrations` não existe (comando: `cd backend && npx jest src/database/migrator`)

**Critério de aceite**
- O spec do runner passa; `cmp` entre cada SQL novo e o SQL Prisma correspondente termina com exit 0; `backend/package.json` tem o script `db:migrate`.

**Validação**
- `cd backend && npx jest src/database/migrator` (evidência: `Tests: N passed`, com os casos de banco vazio, baseline e checksum divergente)
- `cd backend && cmp database/migrations/0001_init.sql prisma/migrations/20260924000000_init/migration.sql && cmp database/migrations/0002_rag_persistence.sql prisma/migrations/20260925000000_rag_persistence/migration.sql && echo idênticos` (evidência: `idênticos`)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída; cobre `database/migrate.ts`)

### T-04 — DocumentRepository em SQL

**Camada:** backend
**Dependências:** T-01, T-02
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Darwin

**Arquivos prováveis**
- `backend/src/modules/documents/infra/database/repositories/document.repository.ts`
- `backend/src/modules/documents/infra/database/repositories/prisma-document.repository.ts`
- `backend/src/modules/documents/__tests__/document.repository.spec.ts`
- `backend/src/modules/documents/__tests__/prisma-document.repository.spec.ts`
- `backend/src/modules/documents/documents.providers.ts`
- `backend/src/modules/documents/documents.module.ts`

**Interface**
- Produz: `export class DocumentRepository implements IDocumentRepository { constructor(connection: IDatabaseConnection) }` em `document.repository.ts` (o `prisma-document.repository.ts` e seu spec são removidos)
- Produz: provider `'IDocumentRepository'` com `inject: [ConfigService, DATABASE_CONNECTION]`; `RAG_STORAGE === 'memory'` continua devolvendo `InMemoryDocumentRepository`
- Produz: `create` grava `updated_at = NOW(3)`; `save` faz `UPDATE document SET status = ?, error_message = ?, embedding_model = ?, embedding_version = ?, updated_at = NOW(3) WHERE id = ? AND tenant_id = ?`; `list(tenantId, page, limit)` usa `buildPagedSelect` com `ORDER BY created_at DESC` e devolve `{ data, total }`; `delete` devolve `affectedRows > 0`; `status` é tipo TS local (`pending | processing | ready | failed`), sem `@prisma/client`
- Consome: T-01 `IDatabaseConnection`, T-01 `DATABASE_CONNECTION`, T-02 `buildPagedSelect`

**Teste RED**
- `backend/src/modules/documents/__tests__/document.repository.spec.ts` — com conexão falsa, cada método do `IDocumentRepository` emite SQL cujo WHERE contém `tenant_id = ?` (INSERT inclui a coluna `tenant_id`), sem `:nome` sobrando e com `?` igual ao tamanho dos params; `list('t1', 2, 10)` devolve `{ data, total }` com a row mapeada para `DocumentEntity` e o `total` vindo de `COUNT(*)` — falha porque `DocumentRepository` não existe (comando: `cd backend && npx jest src/modules/documents`)

**Critério de aceite**
- `npx jest src/modules/documents` passa com o spec novo, `prisma-document.repository.ts` não existe e `grep -n -i prisma` em `documents.providers.ts` e `documents.module.ts` não retorna linha.

**Validação**
- `cd backend && npx jest src/modules/documents` (evidência: `Tests:` com 0 failed e o spec `document.repository.spec.ts` listado)
- `cd backend && grep -n -i prisma src/modules/documents -r; echo "exit=$?"` (evidência: `exit=1`)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)

### T-05 — ConversationRepository em SQL

**Camada:** backend
**Dependências:** T-01
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Aang

**Arquivos prováveis**
- `backend/src/modules/chat/infra/database/repositories/conversation.repository.ts`
- `backend/src/modules/chat/infra/database/repositories/prisma-conversation.repository.ts`
- `backend/src/modules/chat/__tests__/conversation.repository.spec.ts`
- `backend/src/modules/chat/__tests__/prisma-conversation.repository.spec.ts`
- `backend/src/modules/chat/chat.providers.ts`

**Interface**
- Produz: `export class ConversationRepository implements IConversationRepository { constructor(connection: IDatabaseConnection) }` (o adapter Prisma e seu spec são removidos); provider `'IConversationRepository'` com `inject: [ConfigService, DATABASE_CONNECTION]`, `RAG_STORAGE=memory` mantém o in-memory
- Produz: `findById` = conversa por `id`, `tenant_id` e `user_id` + mensagens em `ORDER BY created_at ASC` (2 queries, sem N+1); `citations` chega parseado pelo mysql2 e entradas fora do formato são descartadas
- Produz: `save` dentro de `runInTransaction`: `INSERT INTO conversation (id, tenant_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(3)) ON DUPLICATE KEY UPDATE updated_at = NOW(3)`; depois `SELECT id FROM conversation WHERE id = ? AND tenant_id = ? AND user_id = ?` e, sem linha, lança (rollback — nada é escrito em conversa de outro tenant); `COUNT(*)` das mensagens persistidas; as pendentes num único `INSERT INTO conversation_message (id, conversation_id, role, content, citations, created_at) VALUES ?` com `randomUUID()` e `citations` em `JSON.stringify` ou `NULL` quando vazio; `role` é tipo TS local (`user | assistant`)
- Consome: T-01 `IDatabaseConnection`, T-01 `DATABASE_CONNECTION`, T-01 `runInTransaction`

**Teste RED**
- `backend/src/modules/chat/__tests__/conversation.repository.spec.ts` — com conexão falsa, `save` de conversa com 3 mensagens e 1 persistida emite, na transação, o upsert, a checagem de posse com `tenant_id = ?`, o `COUNT(*)` e um único INSERT com 2 linhas; checagem de posse sem linha rejeita e não emite o INSERT das mensagens; todo SELECT de `findById` tem `tenant_id = ?` no WHERE — falha porque `ConversationRepository` não existe (comando: `cd backend && npx jest src/modules/chat`)

**Critério de aceite**
- `npx jest src/modules/chat` passa com o spec novo e `grep -rn -i prisma src/modules/chat` não retorna linha.

**Validação**
- `cd backend && npx jest src/modules/chat` (evidência: `Tests:` com 0 failed e `conversation.repository.spec.ts` listado)
- `cd backend && grep -rn -i prisma src/modules/chat; echo "exit=$?"` (evidência: `exit=1`)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)

### T-06 — MysqlVectorStoreClient

**Camada:** backend
**Dependências:** T-01
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Saitama

**Arquivos prováveis**
- `backend/src/@core/infra/vector-store/mysql-vector-store.client.ts`
- `backend/src/@core/infra/vector-store/prisma-vector-store.client.ts`
- `backend/src/@core/infra/vector-store/__tests__/mysql-vector-store.client.spec.ts`
- `backend/src/@core/infra/vector-store/__tests__/prisma-vector-store.client.spec.ts`
- `backend/src/@core/infra/vector-store/vector-store.module.ts`
- `backend/src/@core/infra/vector-store/vector-store.client.ts`

**Interface**
- Produz: `export class MysqlVectorStoreClient implements VectorStoreClient { constructor(connection: IDatabaseConnection) }` (adapter Prisma e spec removidos; os testes do `float32-codec` migram para o spec novo); `VECTOR_STORE_CLIENT` com `inject: [ConfigService, DATABASE_CONNECTION]`, `RAG_STORAGE=memory` mantém o in-memory
- Produz: `upsert` = `INSERT INTO document_chunk (…) VALUES (…) ON DUPLICATE KEY UPDATE` com o embedding em `Buffer` do `float32-codec`; `search(tenantId, queryVector, topK)` = varredura linear `FROM document_chunk c INNER JOIN document d ON d.id = c.document_id WHERE c.tenant_id = ? AND c.dimensions = ? AND d.status = ?` (param `'ready'`), cosseno em Node, `filename` de `d.filename`; `deleteByDocument` = `DELETE FROM document_chunk WHERE tenant_id = ? AND document_id = ?`; erros continuam embrulhados em `VectorStoreError`
- Consome: T-01 `IDatabaseConnection`, T-01 `DATABASE_CONNECTION`

**Teste RED**
- `backend/src/@core/infra/vector-store/__tests__/mysql-vector-store.client.spec.ts` — com conexão falsa devolvendo `embedding` como `Buffer` Float32 LE, `search('t1', v, 2)` devolve os 2 chunks de maior cosseno com `filename`, o SQL tem `c.tenant_id = ?` e `d.status = ?` e os params são `['t1', v.length, 'ready']`; falha de conexão vira `VectorStoreError` — falha porque `MysqlVectorStoreClient` não existe (comando: `cd backend && npx jest src/@core/infra/vector-store`)

**Critério de aceite**
- `npx jest src/@core/infra/vector-store` passa e `grep -rn -i prisma src/@core/infra/vector-store` não retorna linha.

**Validação**
- `cd backend && npx jest src/@core/infra/vector-store` (evidência: `Tests:` com 0 failed, incluindo os casos do codec)
- `cd backend && grep -rn -i prisma src/@core/infra/vector-store; echo "exit=$?"` (evidência: `exit=1`)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)

### T-07 — Repositórios de RBAC e tenancy

**Camada:** backend
**Dependências:** T-01
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Jaspion

**Arquivos prováveis**
- `backend/src/common/rbac/application/interface/repository/effective-permissions.repository.interface.ts`
- `backend/src/common/rbac/infra/database/repositories/effective-permissions.repository.ts`
- `backend/src/common/rbac/__tests__/effective-permissions.repository.spec.ts`
- `backend/src/common/rbac/effective-permissions.service.ts`
- `backend/src/common/rbac/rbac.module.ts`
- `backend/src/common/tenancy/application/interface/repository/tenant-access.repository.interface.ts`
- `backend/src/common/tenancy/infra/database/repositories/tenant-access.repository.ts`
- `backend/src/common/tenancy/__tests__/tenant-access.repository.spec.ts`
- `backend/src/common/tenancy/tenant-access.service.ts`
- `backend/src/common/guards/__tests__/permissions.guard.spec.ts`
- `backend/src/modules/users/users.select.ts`
- `backend/test/app.e2e-spec.ts`

**Interface**
- Produz: `export const EFFECTIVE_PERMISSIONS_REPOSITORY = 'IEffectivePermissionsRepository'`, `export interface UserGrants { isSuperAdmin: boolean; permissionKeys: readonly string[] }` e `export interface IEffectivePermissionsRepository { findActiveUserGrants(userId: string): Promise<UserGrants | null> }` — usuário `active = 1 AND deleted_at IS NULL`; chaves só de perfis `active = 1 AND deleted_at IS NULL`; coluna `` `key` `` sempre com crase (palavra reservada)
- Produz: `export function buildEffectivePermissions(grants: UserGrants): EffectivePermissions` (substitui a versão que recebia o payload Prisma; `EFFECTIVE_PERMISSIONS_SELECT` e `UserWithEffectivePermissions` somem) e `EffectivePermissionsService.load(userId: string): Promise<EffectivePermissions | null>` com a mesma assinatura de hoje
- Produz: `export const TENANT_ACCESS_REPOSITORY = 'ITenantAccessRepository'`, `export interface UserTenantLinks { isSuperAdmin: boolean; tenantIds: string[] }` e `export interface ITenantAccessRepository { findActiveUserTenants(userId: string): Promise<UserTenantLinks | null>; isTenantActive(tenantId: string): Promise<boolean> }` — vínculos só de tenants `deleted_at IS NULL`; `isTenantActive` exige `active = 1 AND deleted_at IS NULL`
- Produz: `export type TenantScope = readonly string[] | 'all'` e `export function scopeOf(reach: TenantReach): TenantScope` (`tenantIds === null` → `'all'`) em `tenant-access.service.ts`; `reachOf` e `canAccess` com as assinaturas de hoje; `tenantWhere()` permanece até T-09
- Produz: `RbacModule` provê `EFFECTIVE_PERMISSIONS_REPOSITORY` e `TENANT_ACCESS_REPOSITORY` (`useFactory` com `inject: [DATABASE_CONNECTION]`)
- Produz: `users.select.ts` passa a chamar `buildEffectivePermissions({ isSuperAdmin, permissionKeys })` (ajuste de uma função; o resto do arquivo segue até T-13)
- Produz: `test/app.e2e-spec.ts` sobrescreve `'IEffectivePermissionsRepository'` e `'ITenantAccessRepository'` com stubs equivalentes ao `prismaStub` atual e `DATABASE_CONNECTION` com um stub que rejeita qualquer chamada; o override de `PrismaService` fica até T-14
- Consome: T-01 `IDatabaseConnection`, T-01 `DATABASE_CONNECTION`

**Teste RED**
- `backend/src/common/rbac/__tests__/effective-permissions.repository.spec.ts`, `backend/src/common/tenancy/__tests__/tenant-access.repository.spec.ts` — com conexão falsa, `findActiveUserGrants('u1')` devolve `{ isSuperAdmin: false, permissionKeys: ['user:read'] }` a partir das rows, com o SQL filtrando `u.deleted_at IS NULL`, `p.active = ?`/`p.deleted_at IS NULL` e `` `key` `` com crase; usuário ausente devolve `null`; `findActiveUserTenants` converte `is_super_admin` 0/1 em boolean e ignora tenant excluído; `isTenantActive` devolve `false` sem linha — falha porque os repositórios não existem (comando: `cd backend && npx jest src/common`)

**Critério de aceite**
- `npx jest src/common` passa, incluindo `permissions.guard.spec.ts` e `tenant.guard.spec.ts` sem alterar as asserções de comportamento; `grep -rn -i prisma src/common/rbac src/common/tenancy/tenant-access.service.ts` retorna só a linha de `tenantWhere`; `npm run test:e2e` passa.

**Validação**
- `cd backend && npx jest src/common` (evidência: `Tests:` com 0 failed e os dois specs novos listados)
- `cd backend && grep -rn -i prisma src/common/rbac src/common/tenancy; echo "exit=$?"` (evidência: só as linhas do `import { Prisma }` e de `tenantWhere` em `tenant-access.service.ts`)
- `cd backend && npm run test:e2e` (evidência: `Tests:` com 0 failed, incluindo `403 TENANT_OUT_OF_SCOPE` e `403 FORBIDDEN_PERMISSION`)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)

### T-08 — ProfileRepository e ProfilesService

**Camada:** backend
**Dependências:** T-01
**Paralelizável:** sim
**Complexidade:** simples
**Agente:** Levi

**Arquivos prováveis**
- `backend/src/modules/profiles/application/interface/repository/profile.repository.interface.ts`
- `backend/src/modules/profiles/infra/database/repositories/profile.repository.ts`
- `backend/src/modules/profiles/__tests__/profile.repository.spec.ts`
- `backend/src/modules/profiles/profiles.service.ts`
- `backend/src/modules/profiles/profiles.module.ts`

**Interface**
- Produz: `export const PROFILE_REPOSITORY = 'IProfileRepository'`, `export interface ProfileWithPermissions { id: string; name: string; description: string | null; system: boolean; permissionKeys: string[] }` e `export interface IProfileRepository { listActive(): Promise<ProfileWithPermissions[]>; findActiveByIds(ids: readonly string[]): Promise<ProfileWithPermissions[]> }` — `active = 1 AND deleted_at IS NULL`, `ORDER BY name ASC`, `permissionKeys` ordenado; chaves carregadas em lote por `profile_id IN (?)` (2 queries); `` `system` `` e `` `key` `` com crase; `findActiveByIds([])` devolve `[]` sem SQL
- Produz: `ProfilesModule` provê e exporta `PROFILE_REPOSITORY`; `ProfilesService.list(): Promise<ProfileResponseDto[]>` inalterado
- Consome: T-01 `IDatabaseConnection`, T-01 `DATABASE_CONNECTION`

**Teste RED**
- `backend/src/modules/profiles/__tests__/profile.repository.spec.ts` — com conexão falsa, `listActive()` emite 2 queries (perfis e chaves por `IN (?)`), converte `system` 0/1 em boolean e devolve `permissionKeys` ordenado; `findActiveByIds([])` não chama a conexão — falha porque `ProfileRepository` não existe (comando: `cd backend && npx jest src/modules/profiles`)

**Critério de aceite**
- `npx jest src/modules/profiles` passa e `grep -rn -i prisma src/modules/profiles` não retorna linha.

**Validação**
- `cd backend && npx jest src/modules/profiles` (evidência: `Tests:` com 0 failed)
- `cd backend && grep -rn -i prisma src/modules/profiles; echo "exit=$?"` (evidência: `exit=1`)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)

### T-09 — TenantRepository e TenantsService

**Camada:** backend
**Dependências:** T-01, T-02, T-07
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Yoda

**Arquivos prováveis**
- `backend/src/modules/tenants/application/interface/repository/tenant.repository.interface.ts`
- `backend/src/modules/tenants/infra/database/repositories/tenant.repository.ts`
- `backend/src/modules/tenants/__tests__/tenant.repository.spec.ts`
- `backend/src/modules/tenants/__tests__/tenants.service.spec.ts`
- `backend/src/modules/tenants/tenants.service.ts`
- `backend/src/modules/tenants/tenants.module.ts`
- `backend/src/common/tenancy/tenant-access.service.ts`

**Interface**
- Produz: `export const TENANT_REPOSITORY = 'ITenantRepository'`, `export interface TenantRecord { id: string; name: string; slug: string; active: boolean; createdAt: Date; updatedAt: Date }`
- Produz: `export interface ITenantRepository { list(scope: TenantScope): Promise<TenantRecord[]>; findById(id: string): Promise<TenantRecord | null>; create(input: { name: string; slug: string; active: boolean; createdById: string; linkUserId: string | null }): Promise<TenantRecord>; update(id: string, input: { name?: string; slug?: string; active?: boolean; updatedById: string }): Promise<TenantRecord>; countExisting(ids: readonly string[]): Promise<number> }` — toda leitura com `deleted_at IS NULL`; `list` em `ORDER BY name ASC` e `scope` `[]` devolve `[]`; `create` com `randomUUID()`, `updated_at = NOW(3)` e, com `linkUserId`, o `INSERT INTO user_tenant` na mesma `runInTransaction`; `update` só grava os campos definidos (SET montado por allow-list de colunas) mais `updated_by_id` e `updated_at = NOW(3)`; `countExisting([])` devolve `0` sem SQL
- Produz: `TenantsModule` provê e exporta `TENANT_REPOSITORY`; `TenantsService` com as assinaturas de hoje; chave duplicada detectada por `isMysqlDuplicateEntry` continua virando 409 `TENANT_SLUG_TAKEN`; `tenantWhere()` e o import de `Prisma` saem de `tenant-access.service.ts`
- Consome: T-07 `TenantScope`, T-07 `scopeOf`, T-02 `isMysqlDuplicateEntry`, T-01 `DATABASE_CONNECTION`

**Teste RED**
- `backend/src/modules/tenants/__tests__/tenants.service.spec.ts` — com `ITenantRepository` e `TenantAccessService` falsos, `create` com o repositório rejeitando `{ code: 'ER_DUP_ENTRY', errno: 1062 }` lança `ConflictException` com `code: 'TENANT_SLUG_TAKEN'`; `list` de ator não-SUPERADMIN chama `list(['t1'])`; `findOne` de tenant fora do alcance lança `NotFoundException` sem consultar o repositório — falha porque `TenantsService` ainda depende de `PrismaService` (comando: `cd backend && npx jest src/modules/tenants`)

**Critério de aceite**
- `npx jest src/modules/tenants` passa (service e repositório) e `grep -rn -i prisma src/modules/tenants src/common/tenancy` não retorna linha.

**Validação**
- `cd backend && npx jest src/modules/tenants` (evidência: `Tests:` com 0 failed; `tenant.repository.spec.ts` inclui `list([])` sem SQL e `update` só com `name` sem `slug` no SET)
- `cd backend && grep -rn -i prisma src/modules/tenants src/common/tenancy; echo "exit=$?"` (evidência: `exit=1`)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)

### T-10 — UserRepository e users.mapper

**Camada:** backend
**Dependências:** T-01, T-02, T-07
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Goku

**Arquivos prováveis**
- `backend/src/modules/users/application/interface/repository/user.repository.interface.ts`
- `backend/src/modules/users/infra/database/repositories/user.repository.ts`
- `backend/src/modules/users/infra/database/queries/user-list.query.ts`
- `backend/src/modules/users/__tests__/user.repository.spec.ts`
- `backend/src/modules/users/users.mapper.ts`
- `backend/src/modules/users/users.module.ts`

**Interface**
- Produz: `export const USER_REPOSITORY = 'IUserRepository'`
- Produz: `export interface UserAggregate { id: string; name: string; email: string; active: boolean; mustChangePassword: boolean; isSuperAdmin: boolean; lastLoginAt: Date | null; createdAt: Date; updatedAt: Date; profiles: { id: string; name: string }[]; tenants: { id: string; name: string; slug: string }[]; permissionKeys: string[] }` — `profiles` só ativos e não excluídos, `name ASC`; `tenants` só não excluídos, `name ASC`; `permissionKeys` = chaves dos perfis ativos
- Produz: `export interface UserCredentials { id: string; email: string; passwordHash: string; active: boolean }`
- Produz: `export interface UserListFilter { scope: TenantScope; active?: boolean; tenantId?: string; search?: string; page: number; limit: number }`, `export interface CreateUserInput { name: string; email: string; passwordHash: string; active: boolean; createdById: string; profileIds: readonly string[]; tenantIds: readonly string[] }`, `export interface UpdateUserInput { name?: string; email?: string; active?: boolean; updatedById: string; profileIds?: readonly string[] }`
- Produz: `export interface IUserRepository { list(filter: UserListFilter): Promise<{ data: UserAggregate[]; total: number }>; findInScope(id: string, scope: TenantScope): Promise<UserAggregate | null>; findActiveById(id: string): Promise<UserAggregate | null>; findById(id: string): Promise<UserAggregate | null>; findCredentialsByEmail(email: string): Promise<UserCredentials | null>; findActiveCredentialsById(id: string): Promise<UserCredentials | null>; findIdByEmail(email: string): Promise<string | null>; create(input: CreateUserInput): Promise<string>; update(id: string, input: UpdateUserInput): Promise<void>; replaceTenants(id: string, tenantIds: readonly string[], updatedById: string): Promise<void>; updatePassword(id: string, input: { passwordHash: string; mustChangePassword: boolean; updatedById?: string }): Promise<void>; touchLastLogin(id: string): Promise<void>; softDelete(id: string, deletedById: string): Promise<void> }`
- Produz: semântica — `list`/`findInScope` com `u.deleted_at IS NULL`; `scope` diferente de `'all'` vira `EXISTS (SELECT 1 FROM user_tenant ut WHERE ut.user_id = u.id AND ut.tenant_id IN (?))` e `[]` devolve `{ data: [], total: 0 }`; `tenantId` vira outro `EXISTS`; `search` usa `addLike` em `u.name` e `u.email`; `list` em `ORDER BY u.name ASC, u.id ASC` via `buildPagedSelect`; o agregado da página inteira é montado com 3 queries em lote por `user_id IN (?)` (perfis, chaves, tenants) — nunca uma query por usuário; `findById` não filtra exclusão (equivale ao `findUniqueOrThrow`); `findCredentialsByEmail` filtra `deleted_at IS NULL`; `findIdByEmail` não filtra exclusão (o unique é global); `create`, `update` e `replaceTenants` em `runInTransaction`; `create` gera `randomUUID()` para user e vínculos e grava `updated_at = NOW(3)`; `update` só grava campos definidos e, com `profileIds`, troca os perfis (`DELETE … AND profile_id NOT IN (?)`, ou `DELETE … WHERE user_id = ?` quando `profileIds` é `[]`, seguido de `INSERT … VALUES ? ON DUPLICATE KEY UPDATE id = id` com `assigned_by_id = updatedById`); `replaceTenants` faz o mesmo em `user_tenant` e grava `updated_by_id`; todo UPDATE grava `updated_at = NOW(3)`; `softDelete` grava `active = 0`, `deleted_at = NOW(3)`, `deleted_by_id`; booleanos com `Boolean()`
- Produz: `export function toUserResponse(user: UserAggregate): UserResponseDto` em `users.mapper.ts` — `permissions` = `buildEffectivePermissions({ isSuperAdmin, permissionKeys }).toSortedKeys()`, mesmos campos de hoje
- Produz: `UsersModule` provê e exporta `USER_REPOSITORY` (`inject: [DATABASE_CONNECTION]`); `UsersService` e `users.select.ts` não mudam nesta task
- Consome: T-01 `IDatabaseConnection`, T-01 `DATABASE_CONNECTION`, T-01 `runInTransaction`, T-02 `buildPagedSelect`, T-02 `addLike`, T-02 `addIn`, T-07 `TenantScope`, T-07 `buildEffectivePermissions`

**Teste RED**
- `backend/src/modules/users/__tests__/user.repository.spec.ts` — com conexão falsa e página de 2 usuários, `list({ scope: ['t1'], page: 1, limit: 20 })` emite exatamente 5 queries (página, contagem e 3 em lote com `IN (?)` recebendo `['u1', 'u2']`), o SQL da página contém `EXISTS` com `ut.tenant_id IN (?)` e termina em `LIMIT ? OFFSET ?`, e o agregado sai com `profiles`/`tenants` agrupados por usuário e `active` boolean; `list({ scope: [], page: 1, limit: 20 })` devolve `{ data: [], total: 0 }`; `update('u1', { updatedById: 'a', profileIds: [] })` emite `DELETE FROM user_profile WHERE user_id = ?` sem `NOT IN` — falha porque `UserRepository` não existe (comando: `cd backend && npx jest src/modules/users/__tests__/user.repository.spec.ts`)

**Critério de aceite**
- O spec do repositório passa; nenhum SQL capturado nos testes tem `:nome` sobrando, `${` ou `SELECT *`; `npx jest src/modules/users` continua passando (service ainda no Prisma).

**Validação**
- `cd backend && npx jest src/modules/users` (evidência: `Tests:` com 0 failed; o spec do repositório inclui `replaceTenants('u1', [], 'a')` sem `NOT IN` e `search: '50%'` com o param `'%50\\%%'`)
- `cd backend && grep -n -i prisma src/modules/users/users.mapper.ts src/modules/users/infra -r; echo "exit=$?"` (evidência: `exit=1`)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)

### T-11 — Seed sem Prisma

**Camada:** database
**Dependências:** T-01
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Naruto

**Arquivos prováveis**
- `backend/src/database/seed/run-seed.ts`
- `backend/src/database/seed/__tests__/run-seed.spec.ts`
- `backend/database/seed.ts`

**Interface**
- Produz: `export interface SeedEnv { nodeEnv: string | undefined; adminEmail: string; adminPassword: string | undefined; adminName: string }` e `export interface SeedReport { skipped: 'production' | null; permissions: number; profiles: number; tenantSlug: string; superAdminCreated: boolean }`
- Produz: `export async function runSeed(conn: IDatabaseConnection, env: SeedEnv, hash: (password: string) => Promise<string>): Promise<SeedReport>` — `nodeEnv === 'production'` devolve `skipped: 'production'` sem nenhum SQL; permissões do catálogo `src/common/rbac/permissions.ts` por `INSERT … ON DUPLICATE KEY UPDATE description = ?, updated_at = NOW(3)`; perfis `DEFAULT_PROFILES` com `` `system` = 1 `` e permissões regravadas (`DELETE FROM profile_permission WHERE profile_id = ?` + INSERT em lote); tenant `{ name: 'GEDUC', slug: 'geduc' }` por upsert no `slug`; SUPERADMIN só se `SELECT id FROM user WHERE email = ?` (sem filtro de exclusão) não achar o e-mail, com `hash(adminPassword)`, `is_super_admin = 1`, `must_change_password = 1`, vínculo ao perfil `Administrador` de `DEFAULT_PROFILES` e ao tenant `geduc`; `adminPassword` ausente com SUPERADMIN a criar lança `Error('BOOTSTRAP_ADMIN_PASSWORD é obrigatória para o seed.')`; `randomUUID()` em todo id novo e `updated_at = NOW(3)` em todo INSERT de tabela que tem a coluna
- Produz: CLI `backend/database/seed.ts` — `dotenv/config`, guard `NODE_ENV=production` antes de abrir conexão, lê `BOOTSTRAP_ADMIN_EMAIL` (padrão `admin@rag.local`, normalizado), `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME` (padrão `Super Admin`) e `DATABASE_URL`, usa `argon2.hash`, `MysqlAdapter` + `buildPoolOptions`, imprime o `SeedReport` e encerra o pool; o script `db:seed` passa a apontar para ele em T-14
- Consome: T-01 `IDatabaseConnection`, T-01 `MysqlAdapter`, T-01 `buildPoolOptions`

**Teste RED**
- `backend/src/database/seed/__tests__/run-seed.spec.ts` — com conexão falsa, `nodeEnv: 'production'` devolve `skipped: 'production'` e a conexão não recebe chamada; execução normal emite um `INSERT … ON DUPLICATE KEY UPDATE` por chave de `ALL_PERMISSION_KEYS`, regrava `profile_permission` de cada perfil de `DEFAULT_PROFILES` e, com o e-mail já existente, devolve `superAdminCreated: false` sem chamar `hash` — falha porque `runSeed` não existe (comando: `cd backend && npx jest src/database/seed`)

**Critério de aceite**
- O spec do seed passa com os casos de guard de produção, idempotência (SUPERADMIN existente) e senha ausente; `backend/database/seed.ts` compila no `tsc --noEmit`.

**Validação**
- `cd backend && npx jest src/database/seed` (evidência: `Tests: N passed` com os 3 casos do critério)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)

### T-12 — AuthService sobre IUserRepository

**Camada:** backend
**Dependências:** T-10
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Kratos

**Arquivos prováveis**
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.module.ts`
- `backend/src/modules/auth/__tests__/auth.service.spec.ts`

**Interface**
- Produz: `AuthService(users: IUserRepository via @Inject(USER_REPOSITORY), jwtService: JwtService)` com `login(dto: LoginDto): Promise<AuthResponseDto>`, `changePassword(userId: string, dto: ChangePasswordDto): Promise<AuthResponseDto>` e `me(userId: string): Promise<AuthUserDto>` inalterados; `login` usa `findCredentialsByEmail` + `touchLastLogin`; `changePassword` usa `findActiveCredentialsById` + `updatePassword(id, { passwordHash, mustChangePassword: false })` (sem `updatedById`, como hoje); `me` usa `findActiveById`; `buildAuthResponse` usa `findById` e lança se `null`; `toAuthUser` recebe `UserAggregate` e usa `toUserResponse` de `users.mapper.ts`
- Produz: `AuthModule` importa `UsersModule`
- Consome: T-10 `USER_REPOSITORY`, T-10 `IUserRepository`, T-10 `UserAggregate`, T-10 `toUserResponse(user: UserAggregate): UserResponseDto`

**Teste RED**
- `backend/src/modules/auth/__tests__/auth.service.spec.ts` — com `IUserRepository` falso, `login` com credencial válida chama `touchLastLogin('u1')` e devolve `accessToken`; usuário inativo lança `UnauthorizedException` com `code: 'ACCOUNT_DISABLED'`; `changePassword` chama `updatePassword('u1', { passwordHash: <hash>, mustChangePassword: false })`; `me` de usuário ausente lança `UnauthorizedException` — falha porque `AuthService` ainda injeta `PrismaService` (comando: `cd backend && npx jest src/modules/auth`)

**Critério de aceite**
- `npx jest src/modules/auth` passa e `grep -rn -i prisma src/modules/auth` não retorna linha.

**Validação**
- `cd backend && npx jest src/modules/auth` (evidência: `Tests:` com 0 failed)
- `cd backend && grep -rn -i prisma src/modules/auth; echo "exit=$?"` (evidência: `exit=1`)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)

### T-13 — UsersService e users.policy sobre repositórios

**Camada:** backend
**Dependências:** T-02, T-07, T-08, T-09, T-10
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Thanos

**Arquivos prováveis**
- `backend/src/modules/users/users.service.ts`
- `backend/src/modules/users/users.policy.ts`
- `backend/src/modules/users/users.select.ts`
- `backend/src/modules/users/users.module.ts`
- `backend/src/modules/users/__tests__/users.service.spec.ts`
- `backend/src/modules/users/__tests__/users.policy.spec.ts`

**Interface**
- Produz: `UsersService(users: IUserRepository, profiles: IProfileRepository, tenants: ITenantRepository, permissions: EffectivePermissionsService, tenantAccess: TenantAccessService)` com as assinaturas públicas de hoje (`list`, `findOne`, `create`, `update`, `assignTenants`, `resetPassword`, `setActive`, `remove`) e as mesmas respostas (`UserListResponseDto` = `{ data, total }`, `UserResponseDto`)
- Produz: `list` passa `{ scope: scopeOf(actor.reach), active, tenantId, search, page: query.page ?? 1, limit: query.limit ?? 20 }`; `findInScope` usa `users.findInScope(id, scopeOf(actor.reach))`; `assertProfilesGrantable` usa `profiles.findActiveByIds`; `assertTenantsExist` usa `tenants.countExisting`; `assertEmailAvailable` usa `users.findIdByEmail`; `withEmailConflict` usa `isMysqlDuplicateEntry` e continua lançando 409 `EMAIL_UNAVAILABLE`; nenhum tipo `Prisma.*` em assinatura
- Produz: `users.policy.ts` sem `userScopeWhere` e sem import de `@prisma/client`; as demais funções puras inalteradas; `users.select.ts` removido (respostas via `toUserResponse` de `users.mapper.ts`)
- Produz: `UsersModule` importa `ProfilesModule` e `TenantsModule`
- Consome: T-10 `USER_REPOSITORY`, T-10 `IUserRepository`, T-10 `toUserResponse(user: UserAggregate): UserResponseDto`, T-08 `PROFILE_REPOSITORY`, T-08 `findActiveByIds`, T-09 `TENANT_REPOSITORY`, T-09 `countExisting`, T-07 `scopeOf`, T-02 `isMysqlDuplicateEntry`

**Teste RED**
- `backend/src/modules/users/__tests__/users.service.spec.ts` — com repositórios falsos, `create` com `users.create` rejeitando `{ code: 'ER_DUP_ENTRY', errno: 1062 }` lança `ConflictException` com `code: 'EMAIL_UNAVAILABLE'`; `list` de ator com `tenantIds: ['t1']` chama `users.list` com `scope: ['t1']`, `page: 1` e `limit: 20`; ator sem a permissão de um perfil recebe `PERMISSION_NOT_GRANTABLE` sem escrita — falha porque `UsersService` ainda injeta `PrismaService` (comando: `cd backend && npx jest src/modules/users`)

**Critério de aceite**
- `npx jest src/modules/users` passa (service, policy e repositório), `users.select.ts` não existe e `grep -rn -i prisma src/modules/users` não retorna linha.

**Validação**
- `cd backend && npx jest src/modules/users` (evidência: `Tests:` com 0 failed, com os casos de `TENANT_NOT_GRANTABLE`, `USER_PROTECTED` e `EMAIL_UNAVAILABLE`)
- `cd backend && grep -rn -i prisma src/modules/users; echo "exit=$?"` (evidência: `exit=1`)
- `cd backend && npx tsc --noEmit` (evidência: exit 0 e 0 linhas de saída)
- `cd backend && npm run test:e2e` (evidência: `Tests:` com 0 failed)

### T-14 — Remoção do Prisma do backend

**Camada:** infra
**Dependências:** T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Maquiavel

**Arquivos prováveis**
- `backend/package.json`
- `backend/package-lock.json`
- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/prisma/migrations/20260924000000_init/migration.sql`
- `backend/prisma/migrations/20260925000000_rag_persistence/migration.sql`
- `backend/prisma/migrations/migration_lock.toml`
- `backend/prisma.config.ts`
- `backend/src/database/prisma.service.ts`
- `backend/src/database/database.module.ts`
- `backend/test/app.e2e-spec.ts`
- `backend/Dockerfile`
- `backend/.dockerignore`
- `backend/.gitignore`
- `backend/tsconfig.build.json`
- `backend/.env.example`
- `backend/src/config/env.validation.ts`
- `backend/src/app.module.ts`
- `backend/src/common/decorators/is-optional-not-null.decorator.ts`
- `backend/src/common/dto/partial-type.options.ts`

**Interface**
- Produz: `backend/package.json` sem `@prisma/client`, `@prisma/adapter-mariadb`, `prisma`, `postinstall`, bloco `"prisma"`, entradas `@prisma/engines`/`prisma` de `allowScripts` e a palavra Prisma na descrição; `"db:seed": "ts-node database/seed.ts"`; `package-lock.json` regenerado por `npm install`
- Produz: `DatabaseModule` só com `DATABASE_CONNECTION`; `prisma.service.ts`, `prisma.config.ts` e a pasta `backend/prisma/` removidos com `git rm`; e2e sem `PrismaService` nem `prismaStub`; `backend/generated/` (artefato ignorado) apagado
- Produz: `Dockerfile` sem `prisma generate`, sem OpenSSL "p/ o Prisma", sem cópias de schema/config e com comentário dizendo que as migrations rodam por `npm run db:migrate` fora do arranque; `.dockerignore`/`.gitignore` sem `generated/prisma`; `tsconfig.build.json` troca `"prisma"` por `"database"` no `exclude`
- Produz: `.env.example` com a seção "MySQL" (placeholders, `DATABASE_URL` e `DB_POOL_MAX`) e `RAG_STORAGE=mysql` descrito como "repositórios SQL (mysql2)"; comentários de `env.validation.ts`, `app.module.ts` e dos dois arquivos de `common/` sem Prisma
- Consome: T-03 `"db:migrate": "ts-node database/migrate.ts"`

**Teste RED**
- sem teste: remoção de dependências, arquivos e configuração; a prova é o grep vazio, o build e as suítes existentes

**Critério de aceite**
- `grep -ri prisma backend/src backend/test backend/package.json` termina com exit 1 e 0 linhas; `npm run build` gera `backend/dist/src/main.js`; `npm test` e `npm run test:e2e` com 0 failed.

**Validação**
- `cd /home/kaine/source/geduc-rag && grep -ri prisma backend/src backend/test backend/package.json; echo "exit=$?"` (evidência: `exit=1` sem linhas antes)
- `cd backend && npm run build && ls dist/src/main.js` (evidência: `dist/src/main.js`)
- `cd backend && npm test && npm run test:e2e` (evidência: as duas linhas `Tests:` com 0 failed)
- `cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts"` (evidência: exit 0 e 0 linhas de saída)

### T-15 — Docs e agentes sem Prisma

**Camada:** docs
**Dependências:** T-03, T-11, T-13
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Gandalf

**Arquivos prováveis**
- `backend/CLAUDE.md`
- `.claude/CLAUDE.md`
- `README.md`
- `.docs/rag-architecture.md`
- `.docs/rag-assistant-feature.md`
- `.docs/prd/modulo-users.md`
- `.claude/agents/nest-backend.md`
- `.claude/agents/explorer.md`
- `.claude/agents/flutter-dev.md`
- `infra/db/docker-compose.yml`

**Interface**
- Produz: em `backend/CLAUDE.md`, a seção "Regras — Services, DTOs, Prisma" vira "Regras — Services, DTOs, SQL e repositórios" com as regras do `check-sql` (valor sempre em placeholder, identificador só por allow-list, `LIMIT` nunca interpolado, sem `SELECT *`, sem N+1, `tenant_id` em todo acesso a dado do RAG, UPDATE/DELETE sempre com WHERE, `updated_at = NOW(3)` em INSERT/UPDATE, crase em `key`/`system`, `tx?: ITransactionalConnection`, sem chamada externa em transação, token string de repositório) e a estrutura de pastas/comandos passa a `backend/database/migrations/NNNN_*.sql`, `npm run db:migrate`, `npm run db:seed`
- Produz: em `.claude/CLAUDE.md`, a regra "após mudar `schema.prisma`, `npx prisma generate`" vira "mudança de schema = nova migration `backend/database/migrations/NNNN_*.sql` (nunca editar uma aplicada) + `npm run db:migrate` em banco local"; stack sem Prisma; linha do hook `protect-migrations.sh` com o caminho novo
- Produz: `README.md`, os três `.docs/*.md`, os três agentes e o comentário de `infra/db/docker-compose.yml` sem Prisma, descrevendo mysql2 + SQL parametrizado e o runner
- Consome: T-03 `"db:migrate": "ts-node database/migrate.ts"`, T-11 `runSeed`

**Teste RED**
- sem teste: documentação

**Critério de aceite**
- `grep -n -i prisma` nos 10 arquivos da task termina com exit 1; `backend/CLAUDE.md` contém `npm run db:migrate` e a seção "Regras — Services, DTOs, SQL e repositórios".

**Validação**
- `cd /home/kaine/source/geduc-rag && grep -n -i prisma backend/CLAUDE.md .claude/CLAUDE.md README.md .docs/rag-architecture.md .docs/rag-assistant-feature.md .docs/prd/modulo-users.md .claude/agents/nest-backend.md .claude/agents/explorer.md .claude/agents/flutter-dev.md infra/db/docker-compose.yml; echo "exit=$?"` (evidência: `exit=1`)
- `grep -n "db:migrate\|SQL e repositórios" /home/kaine/source/geduc-rag/backend/CLAUDE.md` (evidência: ao menos 2 linhas)

### T-16 — Hooks no novo caminho de migrations

**Camada:** infra
**Dependências:** T-03
**Paralelizável:** sim
**Complexidade:** simples
**Agente:** Batman

**Arquivos prováveis**
- `.claude/hooks/protect-migrations.sh`
- `.claude/hooks/protect-db.sh`

**Interface**
- Produz: `protect-migrations.sh` pede confirmação para Edit/Write em `*/backend/database/migrations/*` (mensagem: migration aplicada tem checksum em `schema_migrations`; crie uma nova em vez de editar); o caminho `backend/prisma/migrations` sai
- Produz: `protect-db.sh` sem o padrão `MIGRATE\s+RESET|DB\s+PUSH\s.*--FORCE-RESET|--ACCEPT-DATA-LOSS|DROPDB` do Prisma; mantém DELETE sem WHERE → exit 2 e DROP/TRUNCATE/ALTER … DROP/DELETE → confirmação
- Consome: T-03 `0001_init.sql`

**Teste RED**
- sem teste: hooks shell sem suíte de testes no projeto; a prova é a invocação com JSON de exemplo na Validação

**Critério de aceite**
- Com JSON de Edit em `backend/database/migrations/0001_init.sql`, `protect-migrations.sh` imprime a decisão de confirmação (`ask`); com `backend/src/main.ts`, não imprime nada e sai com 0; `protect-db.sh` com `DELETE FROM user` sai com 2 e com `DROP TABLE x` imprime `ask`; `grep -n -i prisma .claude/hooks/protect-*.sh` termina com exit 1.

**Validação**
- `cd /home/kaine/source/geduc-rag && echo '{"tool_name":"Edit","tool_input":{"file_path":"/home/kaine/source/geduc-rag/backend/database/migrations/0001_init.sql"}}' | bash .claude/hooks/protect-migrations.sh; echo "exit=$?"` (evidência: saída com `ask`)
- `cd /home/kaine/source/geduc-rag && echo '{"tool_name":"Bash","tool_input":{"command":"mysql -e \"DELETE FROM user\""}}' | bash .claude/hooks/protect-db.sh; echo "exit=$?"` (evidência: `exit=2`)
- `cd /home/kaine/source/geduc-rag && grep -n -i prisma .claude/hooks/protect-*.sh; echo "exit=$?"` (evidência: `exit=1`)

### T-17 — Validação final com banco local

**Camada:** qa
**Dependências:** T-14, T-15, T-16
**Paralelizável:** não
**Complexidade:** alta
**Agente:** Sherlock

**Arquivos prováveis**

**Interface**
- Produz: `reports/T-17.md` com a saída de cada comando da Validação e o diff de schema
- Consome: T-14 `"db:seed": "ts-node database/seed.ts"`, T-03 `"db:migrate": "ts-node database/migrate.ts"`

**Teste RED**
- sem teste: task de validação, sem código novo

**Critério de aceite**
- `npm ci` termina com exit 0 sem executar `prisma generate`; build, `tsc --noEmit`, `eslint` sem `--fix`, `npm test` e `npm run test:e2e` com exit 0; `grep -ri prisma backend/src backend/test backend/package.json` com exit 1; em banco local novo, `npm run db:migrate` imprime `applied: 0001_init, 0002_rag_persistence` e o `SHOW CREATE TABLE` das 11 tabelas tem diff vazio contra o banco criado pelo Prisma; no banco de dev, `db:migrate` imprime `baselined: 0001_init, 0002_rag_persistence` e `SELECT COUNT(*) FROM user` é igual antes e depois; `db:seed` rodado 2 vezes no banco novo deixa `SELECT COUNT(*) FROM user WHERE is_super_admin = 1` = 1; smoke: login 200, criação de usuário e tenant 201, upload 202 com status `ready`, chat com ao menos 1 citação.

**Validação**
- `cd backend && npm ci 2>&1 | grep -ci prisma; npm run build && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts" && npm test && npm run test:e2e` (evidência: `0` no grep e as duas linhas `Tests:` com 0 failed)
- `cd /home/kaine/source/geduc-rag && grep -ri prisma backend/src backend/test backend/package.json; echo "exit=$?"` (evidência: `exit=1`)
- `cd backend && grep -rnE '\$\{' src --include=*.repository.ts --include=*.query.ts --include=*.client.ts` (evidência: toda linha listada interpola só identificador de allow-list ou lista de `?`, nunca valor)
- `cd backend && node -e "console.log(new URL(require('dotenv').config().parsed.DATABASE_URL).host)"` (evidência: `localhost:3307`; nunca imprimir a URL inteira)
- Banco novo `geduc_rag_runner_check` no MySQL local (container `geduc-rag-db-mysql-1`, porta 3307): `DATABASE_URL` apontando para ele + `npm run db:migrate` (evidência: `applied: 0001_init, 0002_rag_persistence`)
- `SHOW CREATE TABLE` das 11 tabelas nos dois bancos, `diff` das saídas (evidência: diff vazio)
- Banco de dev: `SELECT COUNT(*)` de `user`, `tenant` e `document` antes e depois de `npm run db:migrate` (evidência: `baselined: 0001_init, 0002_rag_persistence` e contagens iguais)
- `npm run db:seed` 2 vezes no banco novo e contagem de SUPERADMIN (evidência: `1`)
- Smoke com `bash backend/scripts/smoke-rag.sh` e chamadas HTTP de login, `POST /users`, `POST /tenants` e `PATCH /tenants/:id` com só `name` (evidência: status 200/201/202, citação no chat e `slug` inalterado no PATCH parcial)

## Legenda

- [ ] pendente
- [~] em andamento
- [x] concluído com evidência
- [!] bloqueado
