# Prompt — Remoção do Prisma e adoção do padrão sem ORM do api-geduc-tenant

> Uso: cole este prompt numa sessão nova do Claude Code aberta na raiz do `geduc-rag`.
> Base: levantamento feito em 2026-09-29 sobre `geduc-rag@3b972a4` e `/home/kaine/source/api-geduc-tenant`.

---

Use a skill `geduc:create-task-plan` para planejar e executar a **remoção completa do Prisma** do
backend do `geduc-rag` e sua substituição por acesso a dados **sem ORM** (`mysql2/promise` + SQL
parametrizado), seguindo o padrão do projeto `/home/kaine/source/api-geduc-tenant`.

**Antes de planejar, verifique:** leia de novo os pontos citados abaixo nos dois repositórios e
confirme que ainda valem. Se algo tiver mudado, avise antes de seguir. O `api-geduc-tenant` é
**somente leitura**: não altere nada lá.

## 1. Referência: o que copiar do api-geduc-tenant

Leia primeiro: `.claude/CLAUDE.md`, `.docs/architecture.md`, `.claude/skills/new-repository/SKILL.md`,
`.claude/skills/check-sql/SKILL.md` e `src/@core/infra/database/query-builder/README.md`.

Os exemplos bons estão no módulo `administration`: `deficiency.repository.ts`, os query builders em
`administration/infra/database/queries/`, `region.repository.ts` (transação) e
`__tests__/deficiency.repository.spec.ts`. O próprio CLAUDE.md de lá avisa que `auth` e partes de
`@core` têm SQL concatenado. Não use esse código como referência.

O que replicar:

- **Porta `IDatabaseConnection`** (`src/@core/application/adapters/database-connection.interface.ts`):
  `query`, `queryOne`, `insert`, `update`, `delete`, `runInTransaction`.
- **Adapter `MysqlAdapter`** (`src/@core/infra/adapters/mysql.adapter.ts`) com pool `mysql2`.
- **Transações**: `runInTransaction(async (tx) => …)`, passando `tx?: ITransactionalConnection` como
  parâmetro opcional dos métodos de repositório (`(tx ?? this.connection)`). Sem AsyncLocalStorage.
  Os métodos avulsos `startTransaction`/`commit`/`rollback` são `@deprecated` e não devem ser portados.
  Não faça chamadas externas (HTTP/LLM/embedding) dentro de transação.
- **Query builder** (`src/@core/infra/database/query-builder/`):
  - `BaseQueryBuilder` com `:named` → `?`, filtros `addEq`/`addIn`/`addLike`, paginação `{ items, pagination }`
    e allow-list de colunas em ORDER BY.
  - `MutationBuilder` com `ensureSafeWhere`, que bloqueia UPDATE/DELETE sem WHERE.
  - Porte só o necessário para os casos deste projeto. Não traga o builder inteiro se sobrar código morto.
- **Mapeamento row → saída** por `static createOutput(row)` ou por aliases camelCase no SELECT.
  Repositório nunca devolve row crua.
- **Chave duplicada**: `isMysqlDuplicateEntry` (`code === 'ER_DUP_ENTRY' || errno === 1062`, nunca pela
  mensagem) em `src/@core/shared/exceptions/400/duplicate-entry.exception.ts`.
- **Estrutura por módulo**: `application/interface/repository/*.repository.interface.ts`,
  `infra/database/repositories/*.repository.ts` e, quando houver builder, `infra/database/queries/*.query.ts`.
  Os tokens de repositório são strings (`'IUserRepository'`).
- **Testes de repositório** com conexão falsa (`jest.fn()`) que conferem o SQL final exato e os params,
  e verificam que nenhum `:named` sobrou na string.
- **Regras do `check-sql`**: valor sempre em placeholder; identificador só por allow-list; `LIMIT` nunca
  interpolado a partir de input. Sem `SELECT *` e sem N+1.

## 2. O que NÃO copiar

Estas partes são específicas do api-geduc-tenant ou defeitos conhecidos dele:

- **Pool por tenant**: `ConnectionTenant`, `ConnectionCache` e a tabela `conexao`. O `geduc-rag` usa um
  único banco com coluna `tenant_id`. Mantenha isso: toda query de dado do RAG filtra por `tenant_id`.
- **`@TenantService()` / `Scope.REQUEST`** nos repositórios. Aqui a conexão é singleton; o tenant chega
  por parâmetro, como já acontece hoje.
- **Trilha de auditoria do adapter**: `insert`/`update`/`delete` que recebem `user` e fazem
  `SELECT *` + `logMutation`. As colunas `createdById`/`updatedById` continuam gravadas pelo SQL.
- **"Sem FOREIGN KEY"**: as FKs e cascatas atuais do `geduc-rag` ficam como estão.
- **`typeCast` que devolve DATETIME como string**: mantenha `Date`, que é o que os DTOs e o frontend
  esperam hoje. Confirme lendo os DTOs.
- **`parseInt(process.env.X) ?? 5`**: esse código dá `NaN`. Use `DB_POOL_MAX` validado em `env.validation.ts`
  e lido via `ConfigService`.
- **A ausência de ferramenta de migration** (ver §4).

## 3. Escopo no geduc-rag (verifique a contagem)

**Infra**
- `src/database/prisma.service.ts` e `database.module.ts`: trocar por um `DatabaseModule` `@Global`
  que exporte a conexão (token `DATABASE_CONNECTION`).
- `prisma.config.ts`.
- `DATABASE_URL`: continua como está. Faça o parse para o `mysql2` ou use `uri`.

**RAG** (já está atrás de interfaces; basta trocar o adapter e o wiring)
- `modules/documents/infra/database/repositories/prisma-document.repository.ts` → `document.repository.ts`
  (`IDocumentRepository`). O `$transaction([findMany, count])` vira duas queries ou o builder paginado.
- `modules/chat/infra/database/repositories/prisma-conversation.repository.ts` → `conversation.repository.ts`.
  O `upsert` + `count` + `createMany` viram `INSERT … ON DUPLICATE KEY UPDATE` + `INSERT … VALUES ?`
  dentro de `runInTransaction`.
- `@core/infra/vector-store/prisma-vector-store.client.ts` → `mysql-vector-store.client.ts`:
  - o embedding é `BLOB` Float32 LE e o `mysql2` devolve `Buffer`, então o `float32-codec.ts` continua servindo;
  - a busca continua sendo varredura linear por `tenant_id` + `dimensions`, com JOIN em `document`
    (`status = 'ready'`) e cosseno em Node.
- Wiring: `documents.providers.ts`, `chat.providers.ts` e `vector-store.module.ts`. O `RAG_STORAGE=memory`
  e os adapters in-memory continuam funcionando.

**Plataforma** (é a maior parte do trabalho: hoje não há repositório e os tipos `Prisma.*` vazam)
- Crie repositórios com interface para user, profile, permission, tenant e os vínculos N:N. Os services
  continuam como orquestradores; **não** converta para use cases, porque isso é outra refatoração.
- `auth/auth.service.ts`.
- `users/users.service.ts`, o mais pesado:
  - usa `$transaction` de array e de callback, nested create de profiles/tenants,
    `createMany skipDuplicates` (→ `INSERT IGNORE` ou `ON DUPLICATE KEY UPDATE`), `deleteMany … notIn`,
    filtros `some`/`contains` e P2002;
  - a detecção de P2002 vira `isMysqlDuplicateEntry`, que deve continuar lançando `EMAIL_UNAVAILABLE`.
- `users/users.select.ts` (select aninhado em 3 níveis):
  - carregue a página de usuários e depois perfis, permissões e tenants **em lote por `IN (…)`** e monte
    o agregado em memória;
  - não faça N+1;
  - preserve a ordenação atual.
- `users/users.policy.ts`: `userScopeWhere` deixa de devolver `Prisma.UserWhereInput`. Ela vira um
  fragmento SQL + params, ou um parâmetro de repositório (`scopeTenantIds: string[] | 'all'`).
  Reescreva `users.policy.spec.ts`.
- `profiles/profiles.service.ts`.
- `tenants/tenants.service.ts`: P2002 continua virando `TENANT_SLUG_TAKEN`.
- `common/rbac/effective-permissions.service.ts`.
- `common/tenancy/tenant-access.service.ts`: `tenantWhere()` sai do contrato entre services.
- Nenhum tipo de `@prisma/client` pode sobrar em assinaturas.

**Comportamentos que o Prisma fazia sozinho** e agora precisam ser explícitos:
- `id @default(uuid())`: gere com `randomUUID()` no repositório. `DocumentChunk.id` continua `<documentId>:<index>`.
- `@updatedAt`: preencha `updated_at = NOW(3)` no SQL de UPDATE, ou crie uma migration com
  `ON UPDATE CURRENT_TIMESTAMP(3)`. Escolha uma das duas e documente.
- Booleanos `TINYINT(1)`: o `mysql2` devolve `0/1`. Converta com `Boolean()` no `createOutput`
  (`active`, `isSuperAdmin`, `system`…).
- Coluna `JSON` (`citations`): o `mysql2` já faz o parse na leitura. Na escrita use `JSON.stringify`.
- Enums (`DocumentStatus`, `MessageRole`): tipos TS locais; não importe de `@prisma/client`.
- Soft delete (`deleted_at IS NULL`) em todas as leituras de user, profile e tenant.

**Seed**: reescreva `prisma/seed.ts` com a nova conexão (por exemplo, em `backend/database/seed.ts`).
- Mantenha a mesma idempotência:
  - upsert de permissões pelo catálogo `src/common/rbac/permissions.ts`;
  - perfis `system` com permissões regravadas;
  - tenant `geduc`;
  - SUPERADMIN só se não existir, com argon2.
- Mantenha as mesmas env vars e **o guard `NODE_ENV=production`**.

**Testes**: reescreva os 6 specs unitários acoplados, mais `users.policy.spec.ts` e o e2e
(`test/app.e2e-spec.ts`, que hoje faz `overrideProvider(PrismaService)`). Os specs de repositório de
dado do RAG devem conferir que **todo** SQL tem `tenant_id` no WHERE, no lugar do atual
`expectEveryWhereHasTenant`.

## 4. Migrations sem Prisma

O api-geduc-tenant aplica scripts `.sql` à mão. Aqui, recomendo um runner mínimo; confirme comigo na
fase de planejamento:

- Pasta `backend/database/migrations/NNNN_descricao.sql`.
- `npm run db:migrate`: script em TS que aplica em ordem e registra em `schema_migrations`
  (nome + checksum). Não há `down`.
- **Baseline**: os dois SQL atuais (`20260924000000_init` e `20260925000000_rag_persistence`) viram
  `0001` e `0002` sem alteração de DDL.
  - Em banco novo, o runner aplica tudo.
  - Em banco que já tem `_prisma_migrations`, o runner marca `0001` e `0002` como aplicadas sem executar.
  - A tabela `_prisma_migrations` fica onde está; não faça `DROP`.
- **Validação do schema**: crie um banco de dev **novo** só com o runner e compare o `SHOW CREATE TABLE`
  das 11 tabelas com o banco criado pelo Prisma. A diferença esperada é zero, exceto o `ON UPDATE` se
  essa opção tiver sido escolhida.

## 5. Config, docs e harness

- **`backend/package.json`**:
  - remova `@prisma/client`, `@prisma/adapter-mariadb` e `prisma`, o `postinstall`, o bloco `"prisma"`
    e a menção na descrição;
  - adicione `mysql2`;
  - ajuste `db:seed` e crie `db:migrate`.
- **Dockerfile e dotfiles**:
  - `backend/Dockerfile`: tire o `prisma generate`, o OpenSSL instalado "p/ o Prisma" e as cópias de
    schema/config; decida se as migrations rodam no arranque;
  - `.dockerignore`, `.gitignore` (`generated/prisma`) e `tsconfig.build.json` (exclude `prisma`).
- **`.env.example`**: seção "MySQL" com placeholders. **Não leia o `.env` real.**
- **Docs**:
  - `backend/CLAUDE.md` (a seção "Regras — Services, DTOs, Prisma" vira regras de SQL/repositório no
    padrão do `check-sql`);
  - `.claude/CLAUDE.md` (a regra "após mudar `schema.prisma`, `prisma generate`" vira a regra de migration);
  - `README.md`;
  - `.docs/rag-architecture.md`, `.docs/rag-assistant-feature.md` e `.docs/prd/modulo-users.md`.
- **Agentes**: `.claude/agents/nest-backend.md`, `explorer.md` e `flutter-dev.md`.
- **Hooks e settings**:
  - `.claude/hooks/protect-migrations.sh` passa a proteger o novo caminho das migrations;
  - `.claude/hooks/protect-db.sh`: remova os padrões do Prisma e mantenha DROP/TRUNCATE/DELETE sem WHERE;
  - `.claude/settings.json`: a allowlist de `npx prisma *` deve ser **proposta** para eu aplicar, e não
    editada por você.
- Os planos antigos em `.claude/tasks/**` são histórico; não altere.

## 6. Ondas sugeridas

1. **Infra**: `mysql2`, porta e adapter, `DatabaseModule`, `runInTransaction`, builder mínimo,
   `isMysqlDuplicateEntry`, runner de migration + baseline. Tudo com specs. O Prisma ainda convive.
2. **RAG**: os 3 adapters e o wiring, com specs.
3. **Plataforma**:
   - primeiro `rbac` e `tenancy`, porque os guards dependem deles;
   - depois `auth`, `profiles` e `tenants`;
   - por último `users` + policy.
4. **Remoção**: seed novo, deps, `prisma/`, `prisma.config.ts`, Dockerfile, docs, agentes e hooks.
5. **Validação final**:
   - `npm ci` limpo (sem `postinstall`), `npm run build`, `lint`, `typecheck`, `test` e `test:e2e`;
   - em banco local novo: `db:migrate` + `db:seed` + smoke manual (login, CRUD de user/tenant,
     upload → ingestão → chat com citação).

## 7. Critérios de aceite

- `grep -ri prisma backend/src backend/test backend/package.json` não retorna nada.
- Contratos HTTP inalterados: mesmos DTOs, códigos de erro (`EMAIL_UNAVAILABLE`, `TENANT_SLUG_TAKEN`,
  `TENANT_OUT_OF_SCOPE`) e formato de paginação.
- RBAC, alcance de tenant e "ninguém concede o que não tem" continuam com o mesmo comportamento
  (os specs existentes de service/guard passam).
- Nenhum SQL com valor interpolado; todo UPDATE/DELETE com WHERE; todo acesso a dado do RAG com `tenant_id`.
- Schema gerado pelo runner equivalente ao atual (§4).

## 8. Salvaguardas

- Não rode comandos destrutivos de banco nem contorne o `protect-db.sh`.
- Antes de migrate ou seed, confirme que `DATABASE_URL` aponta para `localhost`. Não leia nem imprima segredos.
- Sem push, sem PR e sem ação externa, a menos que eu peça.
- Comunicação, comentários e docs em pt-BR com acentuação correta.
