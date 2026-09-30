# Plano: Remoção do Prisma e acesso a dados sem ORM (mysql2 + SQL parametrizado)

## Objetivo
Remover o Prisma do backend do geduc-rag e trocar o acesso a dados por `mysql2/promise` com SQL parametrizado, seguindo o padrão de porta, adapter, query builder e repositórios do `api-geduc-tenant`. Contratos HTTP, RBAC, alcance de tenant e schema do banco ficam como estão. O projeto ganha um runner mínimo de migrations com baseline dos dois SQL atuais.

## Premissas
- Migrations: runner mínimo em `backend/database/migrations/NNNN_*.sql` + `npm run db:migrate` (TS), registrando nome + checksum em `schema_migrations`, sem `down`. O baseline `0001`/`0002` são os dois SQL atuais do Prisma sem alteração de DDL. Em banco com `_prisma_migrations`, as duas são marcadas como aplicadas sem executar, e `_prisma_migrations` nunca sofre `DROP`.
- `@updatedAt` passa a ser preenchido pela aplicação (`updated_at = NOW(3)` em todo INSERT/UPDATE), sem alterar DDL.
- Datas continuam `Date` (sem `typeCast` para string). FKs e cascatas atuais mantidas. Banco único com `tenant_id` (sem pool por tenant, sem `Scope.REQUEST`, sem trilha de auditoria no adapter).
- Services da plataforma continuam services e ganham repositórios com interface (token string); não viram use cases.
- `.claude/settings.json` não é editado: a remoção da allowlist `npx prisma *` fica como proposta em `notes.md § Pendências`.
- `.claude/tasks/**` históricos não são alterados. Sem push nem PR.
- Validação com banco real (migrate, seed, smoke) só no MySQL local; sem MySQL local acessível, vira pendência de ambiente.
- O `api-geduc-tenant` é somente leitura: referência, nunca destino de edição.

## Escopo

### Incluso
- Porta `IDatabaseConnection`/`ITransactionalConnection`, `MysqlAdapter` com pool `mysql2`, `runInTransaction`, guarda de UPDATE/DELETE sem WHERE e `DatabaseModule` `@Global` com `DATABASE_CONNECTION` (T-01).
- Query builder mínimo, filtros, SELECT paginado com allow-list e `isMysqlDuplicateEntry` (T-02).
- Runner de migration, baseline e `npm run db:migrate` (T-03).
- Adapters do RAG: documentos, conversas e vector store, com wiring e `RAG_STORAGE=memory` preservado (T-04, T-05, T-06).
- Repositórios de RBAC e tenancy e services de `common/` sem Prisma (T-07).
- Repositórios e services de profiles, tenants, users e auth; `userScopeWhere` e `tenantWhere` fora dos contratos (T-08, T-09, T-10, T-12, T-13).
- Seed novo com a mesma idempotência, as mesmas env vars e o guard `NODE_ENV=production` (T-11).
- Reescrita dos 6 specs acoplados, de `users.policy.spec.ts` e do e2e (T-04, T-05, T-06, T-07, T-12, T-13, T-14).
- Remoção de deps, `prisma/`, `prisma.config.ts`, `PrismaService`, ajustes de Dockerfile, dotfiles, `tsconfig.build.json` e `.env.example` (T-14).
- Docs, `CLAUDE.md` e agentes (T-15); hooks `protect-migrations.sh` e `protect-db.sh` (T-16).
- Validação final com `npm ci`, suites, banco local novo, comparação de schema, seed e smoke (T-17).

### Excluído
- Alterações no `api-geduc-tenant`.
- Conversão dos services da plataforma para use cases.
- Pool por tenant, `ConnectionTenant`/`ConnectionCache`, `@TenantService()`/`Scope.REQUEST`, trilha de auditoria `logMutation`.
- Remoção de FOREIGN KEY ou mudança de DDL (inclusive `ON UPDATE CURRENT_TIMESTAMP`).
- `typeCast` de DATETIME para string.
- Edição de `.claude/settings.json` e dos planos em `.claude/tasks/**`.
- `DROP` de `_prisma_migrations`, migration `down`, rodar migrations no arranque do container.
- Mudança de contrato HTTP, de DTO ou do frontend.
- Push, PR ou ação externa.

## Contexto técnico
- Camadas envolvidas: infra, database, backend, docs, qa
- Projeto/base analisada: `/home/kaine/source/geduc-rag` (raiz do repositório; `git -C <DIR> rev-parse --show-toplevel`); referência somente leitura em `/home/kaine/source/api-geduc-tenant`
- Integrações: MySQL 8.4 local (container `geduc-rag-db-mysql-1`, `localhost:3307`, banco `geduc_rag`)

## Baseline
- nenhuma

`npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` (sem `--fix`) rodaram em `backend/` na árvore atual com exit 0 e 0 linhas; critérios que usam esses comandos exigem exit 0 e saída vazia.

## Exploração read-only
- Caminhos relevantes: `backend/src/database/` (`PrismaService`, `DatabaseModule` `@Global`); `backend/prisma/` (schema com 11 models `@@map`, 2 migrations, seed); adapters Prisma do RAG em `modules/documents/infra/database/repositories/`, `modules/chat/infra/database/repositories/` e `@core/infra/vector-store/`; services da plataforma em `modules/{auth,users,profiles,tenants}` e `common/{rbac,tenancy}`; 29 arquivos citam Prisma em `src`/`test` (21 com import real, 8 só em comentário); referência em `api-geduc-tenant/src/@core/{application/adapters,infra/adapters,infra/database/query-builder,shared/exceptions/400}` e `modules/administration`.
- Padrões identificados: tokens string (`'IDocumentRepository'`) em namespaces de providers; `useFactory` com `RAG_STORAGE === 'memory'` para in-memory; imports relativos (sem `paths`); exceções de `@core/shared/exceptions` com default export; jest com `rootDir: src`; e2e com `setupFiles` que fixa `RAG_STORAGE=memory` e `DATABASE_URL` fictício; listagens em `{ data, total }` com página base 1 e limite 20 (máx. 100); soft delete por `deleted_at` em user, profile e tenant.
- Scripts úteis: `npx jest <caminho>`, `npm test`, `npm run test:e2e`, `npx tsc --noEmit` (`npm run typecheck`), `npx eslint "{src,test}/**/*.ts"` (o `npm run lint` usa `--fix` e é proibido), `npm run build`, `backend/scripts/smoke-rag.sh`.
- Riscos identificados: `package.json`/lockfile compartilhados entre ondas; `test/app.e2e-spec.ts` depende de stub no formato Prisma; tipos Prisma vazam em `userScopeWhere`, `tenantWhere`, `USER_SELECT` e `EFFECTIVE_PERMISSIONS_SELECT`; `updated_at` é `NOT NULL` sem default (INSERT sem a coluna falha só no banco real); `key` e `system` são palavras reservadas do MySQL 8; `DATABASE_URL` traz `allowPublicKeyRetrieval` do driver `mariadb`; o hook `format-file.sh` roda `eslint --fix` em cada `.ts` editado; há um MySQL do host em `127.0.0.1:3306` além do container em 3307; o Dockerfile diz rodar `migrate deploy` no arranque, mas o `CMD` não roda.

## Mapa de arquivos

| Arquivo | Responsabilidade | Ação | Tasks que tocam |
|---|---|---|---|
| ⚠ `backend/package.json` | deps e scripts | modificar | T-01 (mysql2), T-03 (`db:migrate`), T-14 (remove Prisma, `db:seed`) |
| ⚠ `backend/package-lock.json` | lockfile | modificar | T-01, T-14 |
| `backend/src/@core/application/adapters/database-connection.interface.ts` | porta + token | criar | T-01 |
| `backend/src/@core/infra/adapters/mysql.adapter.ts` | adapter mysql2 + `buildPoolOptions` | criar | T-01 |
| `backend/src/@core/infra/adapters/__tests__/mysql.adapter.spec.ts` | spec do adapter | criar | T-01 |
| `backend/src/@core/infra/database/query-builder/mutation-guard.ts` | `ensureSafeWhere` | criar | T-01 |
| ⚠ `backend/src/database/database.module.ts` | módulo global da conexão | modificar | T-01 (adiciona token), T-14 (remove `PrismaService`) |
| `backend/src/@core/infra/database/query-builder/sql-params.ts` | `:named` → `?` | criar | T-02 |
| `backend/src/@core/infra/database/query-builder/filters.ts` | `addEq`/`addIn`/`addLike`/`addRaw` | criar | T-02 |
| `backend/src/@core/infra/database/query-builder/paged-select.ts` | SELECT paginado + contagem | criar | T-02 |
| `backend/src/@core/infra/database/query-builder/README.md` | uso do builder | criar | T-02 |
| `backend/src/@core/infra/database/query-builder/__tests__/query-builder.spec.ts` | spec do builder | criar | T-02 |
| `backend/src/@core/shared/exceptions/400/duplicate-entry.ts` | `isMysqlDuplicateEntry` | criar | T-02 |
| `backend/src/@core/shared/exceptions/__tests__/duplicate-entry.spec.ts` | spec | criar | T-02 |
| `backend/database/migrations/0001_init.sql` | baseline identidade/RBAC | criar | T-03 |
| `backend/database/migrations/0002_rag_persistence.sql` | baseline RAG | criar | T-03 |
| `backend/database/migrate.ts` | CLI `db:migrate` | criar | T-03 |
| `backend/src/database/migrator/migration-runner.ts` | lógica do runner | criar | T-03 |
| `backend/src/database/migrator/__tests__/migration-runner.spec.ts` | spec do runner | criar | T-03 |
| `backend/src/modules/documents/infra/database/repositories/document.repository.ts` | repositório SQL | criar | T-04 |
| `backend/src/modules/documents/infra/database/repositories/prisma-document.repository.ts` | adapter Prisma | remover | T-04 |
| `backend/src/modules/documents/__tests__/document.repository.spec.ts` | spec | criar | T-04 |
| `backend/src/modules/documents/__tests__/prisma-document.repository.spec.ts` | spec Prisma | remover | T-04 |
| `backend/src/modules/documents/documents.providers.ts` | wiring | modificar | T-04 |
| `backend/src/modules/documents/documents.module.ts` | comentário | modificar | T-04 |
| `backend/src/modules/chat/infra/database/repositories/conversation.repository.ts` | repositório SQL | criar | T-05 |
| `backend/src/modules/chat/infra/database/repositories/prisma-conversation.repository.ts` | adapter Prisma | remover | T-05 |
| `backend/src/modules/chat/__tests__/conversation.repository.spec.ts` | spec | criar | T-05 |
| `backend/src/modules/chat/__tests__/prisma-conversation.repository.spec.ts` | spec Prisma | remover | T-05 |
| `backend/src/modules/chat/chat.providers.ts` | wiring | modificar | T-05 |
| `backend/src/@core/infra/vector-store/mysql-vector-store.client.ts` | vector store SQL | criar | T-06 |
| `backend/src/@core/infra/vector-store/prisma-vector-store.client.ts` | adapter Prisma | remover | T-06 |
| `backend/src/@core/infra/vector-store/__tests__/mysql-vector-store.client.spec.ts` | spec (+ codec) | criar | T-06 |
| `backend/src/@core/infra/vector-store/__tests__/prisma-vector-store.client.spec.ts` | spec Prisma | remover | T-06 |
| `backend/src/@core/infra/vector-store/vector-store.module.ts` | wiring | modificar | T-06 |
| `backend/src/@core/infra/vector-store/vector-store.client.ts` | comentário | modificar | T-06 |
| `backend/src/common/rbac/application/interface/repository/effective-permissions.repository.interface.ts` | contrato | criar | T-07 |
| `backend/src/common/rbac/infra/database/repositories/effective-permissions.repository.ts` | repositório SQL | criar | T-07 |
| `backend/src/common/rbac/__tests__/effective-permissions.repository.spec.ts` | spec | criar | T-07 |
| `backend/src/common/rbac/effective-permissions.service.ts` | service + `buildEffectivePermissions` | modificar | T-07 |
| `backend/src/common/rbac/rbac.module.ts` | providers dos repositórios | modificar | T-07 |
| `backend/src/common/tenancy/application/interface/repository/tenant-access.repository.interface.ts` | contrato | criar | T-07 |
| `backend/src/common/tenancy/infra/database/repositories/tenant-access.repository.ts` | repositório SQL | criar | T-07 |
| `backend/src/common/tenancy/__tests__/tenant-access.repository.spec.ts` | spec | criar | T-07 |
| ⚠ `backend/src/common/tenancy/tenant-access.service.ts` | alcance de tenant | modificar | T-07 (repositório, `scopeOf`), T-09 (remove `tenantWhere`) |
| `backend/src/common/guards/__tests__/permissions.guard.spec.ts` | spec do guard | modificar | T-07 |
| ⚠ `backend/src/modules/users/users.select.ts` | projeção Prisma de user | modificar/remover | T-07 (chamada de `buildEffectivePermissions`), T-13 (remove) |
| ⚠ `backend/test/app.e2e-spec.ts` | e2e | modificar | T-07 (override dos repositórios), T-14 (remove `PrismaService`) |
| `backend/src/modules/profiles/application/interface/repository/profile.repository.interface.ts` | contrato | criar | T-08 |
| `backend/src/modules/profiles/infra/database/repositories/profile.repository.ts` | repositório SQL | criar | T-08 |
| `backend/src/modules/profiles/__tests__/profile.repository.spec.ts` | spec | criar | T-08 |
| `backend/src/modules/profiles/profiles.service.ts` | service | modificar | T-08 |
| `backend/src/modules/profiles/profiles.module.ts` | provê/exporta repositório | modificar | T-08 |
| `backend/src/modules/tenants/application/interface/repository/tenant.repository.interface.ts` | contrato | criar | T-09 |
| `backend/src/modules/tenants/infra/database/repositories/tenant.repository.ts` | repositório SQL | criar | T-09 |
| `backend/src/modules/tenants/__tests__/tenant.repository.spec.ts` | spec | criar | T-09 |
| `backend/src/modules/tenants/__tests__/tenants.service.spec.ts` | spec do service | criar | T-09 |
| `backend/src/modules/tenants/tenants.service.ts` | service | modificar | T-09 |
| `backend/src/modules/tenants/tenants.module.ts` | provê/exporta repositório | modificar | T-09 |
| `backend/src/modules/users/application/interface/repository/user.repository.interface.ts` | contrato + `UserAggregate` | criar | T-10 |
| `backend/src/modules/users/infra/database/repositories/user.repository.ts` | repositório SQL | criar | T-10 |
| `backend/src/modules/users/infra/database/queries/user-list.query.ts` | builder da listagem | criar | T-10 |
| `backend/src/modules/users/__tests__/user.repository.spec.ts` | spec | criar | T-10 |
| `backend/src/modules/users/users.mapper.ts` | `toUserResponse` | criar | T-10 |
| ⚠ `backend/src/modules/users/users.module.ts` | módulo users | modificar | T-10 (provê repositório), T-13 (importa Profiles/Tenants) |
| `backend/src/database/seed/run-seed.ts` | lógica do seed | criar | T-11 |
| `backend/src/database/seed/__tests__/run-seed.spec.ts` | spec | criar | T-11 |
| `backend/database/seed.ts` | CLI `db:seed` | criar | T-11 |
| `backend/src/modules/auth/auth.service.ts` | service | modificar | T-12 |
| `backend/src/modules/auth/auth.module.ts` | importa `UsersModule` | modificar | T-12 |
| `backend/src/modules/auth/__tests__/auth.service.spec.ts` | spec | modificar | T-12 |
| `backend/src/modules/users/users.service.ts` | service | modificar | T-13 |
| `backend/src/modules/users/users.policy.ts` | regras puras | modificar | T-13 |
| `backend/src/modules/users/__tests__/users.service.spec.ts` | spec | modificar | T-13 |
| `backend/src/modules/users/__tests__/users.policy.spec.ts` | spec | modificar | T-13 |
| `backend/prisma/schema.prisma` | schema Prisma | remover | T-14 |
| `backend/prisma/seed.ts` | seed Prisma | remover | T-14 |
| `backend/prisma/migrations/20260924000000_init/migration.sql` | migration Prisma | remover | T-14 |
| `backend/prisma/migrations/20260925000000_rag_persistence/migration.sql` | migration Prisma | remover | T-14 |
| `backend/prisma/migrations/migration_lock.toml` | lock Prisma | remover | T-14 |
| `backend/prisma.config.ts` | config Prisma | remover | T-14 |
| `backend/src/database/prisma.service.ts` | client Prisma | remover | T-14 |
| `backend/Dockerfile` | imagem | modificar | T-14 |
| `backend/.dockerignore` | contexto docker | modificar | T-14 |
| `backend/.gitignore` | ignorados | modificar | T-14 |
| `backend/tsconfig.build.json` | build | modificar | T-14 |
| `backend/.env.example` | placeholders | modificar | T-14 |
| `backend/src/config/env.validation.ts` | comentários `DB_POOL_MAX`/`RAG_STORAGE` | modificar | T-14 |
| `backend/src/app.module.ts` | comentário | modificar | T-14 |
| `backend/src/common/decorators/is-optional-not-null.decorator.ts` | comentário | modificar | T-14 |
| `backend/src/common/dto/partial-type.options.ts` | comentário | modificar | T-14 |
| `backend/CLAUDE.md` | regras do backend | modificar | T-15 |
| `.claude/CLAUDE.md` | regras do monorepo | modificar | T-15 |
| `README.md` | setup | modificar | T-15 |
| `.docs/rag-architecture.md` | arquitetura RAG | modificar | T-15 |
| `.docs/rag-assistant-feature.md` | feature | modificar | T-15 |
| `.docs/prd/modulo-users.md` | PRD | modificar | T-15 |
| `.claude/agents/nest-backend.md` | agente | modificar | T-15 |
| `.claude/agents/explorer.md` | agente | modificar | T-15 |
| `.claude/agents/flutter-dev.md` | agente | modificar | T-15 |
| `infra/db/docker-compose.yml` | comentário | modificar | T-15 |
| `.claude/hooks/protect-migrations.sh` | hook | modificar | T-16 |
| `.claude/hooks/protect-db.sh` | hook | modificar | T-16 |

Arquivos com ⚠ ficam em ondas diferentes (serialização): `package.json` nas Ondas 1, 2 e 5; `package-lock.json` e `database.module.ts` nas Ondas 1 e 5; `tenant-access.service.ts` e `users.select.ts` nas Ondas 2 e 3/4; `users.module.ts` nas Ondas 3 e 4; `app.e2e-spec.ts` nas Ondas 2 e 5.

## Decisões de arquitetura

| Decisão | Alternativas consideradas | Motivo da escolha |
|---|---|---|
| Adapter usa `pool.query` (escape no cliente) | `pool.execute` (prepared statement) | `execute` não expande `IN (?)` com array nem `VALUES ?` em lote, e `LIMIT ?` com número falha em prepared statement no MySQL 8 |
| `timezone: 'Z'` no pool + `SET time_zone = '+00:00'` em cada conexão | timezone local do mysql2 (padrão) | O Prisma grava e lê DATETIME em UTC; sem isso datas existentes deslocariam o fuso e `NOW(3)` sairia em hora local |
| `buildPoolOptions` faz parse explícito da `DATABASE_URL` | `uri` direto no mysql2 | A URL atual tem `allowPublicKeyRetrieval` (opção do driver `mariadb`), que o mysql2 rejeita ou avisa |
| `updated_at = NOW(3)` no SQL de INSERT/UPDATE | migration com `ON UPDATE CURRENT_TIMESTAMP(3)` | Premissa: sem mudança de DDL e schema idêntico ao do Prisma |
| Builder funcional mínimo (`toPositional`, filtros, `buildPagedSelect`) que devolve SQL + params | portar `BaseQueryBuilder` inteiro com execução e `{ items, pagination }` | Só o necessário; o contrato HTTP é `{ data, total }` e o repositório executa as queries |
| `ensureSafeWhere` dentro de `update`/`delete` do adapter (T-01) | só no builder de mutação | Todo UPDATE/DELETE passa pela guarda, inclusive os escritos à mão; tira a dependência T-01 → T-02 |
| Vínculos N:N com `INSERT … VALUES ? ON DUPLICATE KEY UPDATE id = id` | `INSERT IGNORE` (o que o Prisma faz) | Mesmo efeito do `skipDuplicates`, mas FK inválida continua falhando em vez de virar warning |
| Troca de vínculos com lista vazia usa `DELETE … WHERE user_id = ?` | `NOT IN ()` | `NOT IN ()` é SQL inválido no MySQL |
| Escopo de tenant como `TenantScope = readonly string[] \| 'all'` via `scopeOf(reach)` | fragmento SQL devolvido pela policy | A policy continua pura e o SQL fica no repositório; `[]` = nada visível |
| Agregado de usuário montado com 3 queries em lote por `IN (?)` | JOIN único com linhas multiplicadas; query por usuário | Sem N+1 e sem explosão cartesiana perfis × permissões × tenants |
| `save` de conversa confere a posse (`tenant_id`, `user_id`) depois do upsert, na mesma transação | upsert só por `id` (como hoje) | Um id de outro tenant nunca recebe mensagens; nos fluxos legítimos o resultado é o mesmo |
| Lógica do runner e do seed em `backend/src/database/…` com CLIs finos em `backend/database/*.ts` | tudo em `backend/database/` | O jest tem `rootDir: src`; a lógica fica testável e as CLIs só fazem I/O |
| Migrations não rodam no arranque do container | `db:migrate` no `CMD` | Hoje também não rodam (o comentário do Dockerfile está errado); aplicar schema continua ato explícito |
| Repositórios de `common/` ficam em `common/{rbac,tenancy}` | reusar o repositório de users | `common/` não pode depender de `modules/users`; guards globais precisam deles |

## Diagrama de dependências

```text
T-01 ─┬─ T-03 ─┬─ T-15
      │        └─ T-16
      ├─ T-04 (+T-02)
      ├─ T-05
      ├─ T-06
      ├─ T-07 ─┬─ T-09 (+T-02) ─┐
      │        └─ T-10 (+T-02) ─┼─ T-12
      ├─ T-08 ──────────────────┼─ T-13
      └─ T-11                   │
T-02 ───────────────────────────┘
T-03..T-13 → T-14 ; T-14 + T-15 + T-16 → T-17
```

## Estratégia de execução
- Branch de trabalho: `task/remover-prisma-sem-orm`
- Branch base: `main`
- Commits da onda: cada implementador commita os próprios caminhos (`git commit -- <caminhos>`); com `worktree por agente` eles chegam pelos merges de `wave<N>/T-XX`. O fechador usa a skill `new-commit --auto` só se sobrou algo sem commit e sempre registra o estado das tasks num `chore(tasks): registra commits da onda N`.
- Isolamento em ondas com edições paralelas: caminho exclusivo — o Mapa já serializa todo arquivo compartilhado em ondas diferentes; lockfile só muda nas Ondas 1 (T-01) e 5 (T-14), cada uma com um único escritor dele.

## Ondas de execução

### Onda 1
- T-01, T-02 (base: porta, adapter, builder)

### Onda 2
- T-03, T-04, T-05, T-06, T-07 (runner, adapters do RAG, RBAC e tenancy)

### Onda 3
- T-08, T-09, T-10, T-11 (repositórios da plataforma e seed)

### Onda 4
- T-12, T-13 (auth e users sobre repositórios)

### Onda 5
- T-14, T-15, T-16 (remoção, docs, hooks)

### Onda 6
- T-17 (validação final)

## Agentes

| Agente | subagent_type | model | Tasks |
|---|---|---|---|
| Sun Tzu — orquestrador | — | — | todas |
| Platão | general-purpose | inherit | T-01 |
| Arquimedes | general-purpose | inherit | T-02 |
| Spock | general-purpose | inherit | T-03 |
| Darwin | general-purpose | inherit | T-04 |
| Aang | general-purpose | inherit | T-05 |
| Saitama | general-purpose | inherit | T-06 |
| Jaspion | general-purpose | inherit | T-07 |
| Levi | general-purpose | inherit | T-08 |
| Yoda | general-purpose | inherit | T-09 |
| Goku | general-purpose | inherit | T-10 |
| Naruto | general-purpose | inherit | T-11 |
| Kratos | general-purpose | inherit | T-12 |
| Thanos | general-purpose | inherit | T-13 |
| Maquiavel | general-purpose | inherit | T-14 |
| Gandalf | geduc:documentador | sonnet | T-15 |
| Batman | general-purpose | inherit | T-16 |
| Sherlock | general-purpose | inherit | T-17 |

## Review Focus
- Registro gravado pelo Prisma (UTC) lido pelo mysql2 → mesmo instante ISO na resposta HTTP de antes, sem deslocamento de fuso, e `updated_at = NOW(3)` em UTC → T-01
- Busca de usuários com `%` ou `_` no `search` → tratada como caractere literal, igual ao `contains` do Prisma → T-02
- Ator não-SUPERADMIN sem nenhum tenant vinculado lista usuários → `{ data: [], total: 0 }`, nunca todos os usuários → T-10
- `PUT /users/:id` com `profileIds: []` ou troca de tenants que resulta em lista vazia → remove todos os vínculos, sem `NOT IN ()` inválido → T-10
- SQL executado no MySQL real: INSERT em tabela com `updated_at NOT NULL` sem default e colunas `key`/`system` (reservadas) → seed e CRUD de user/tenant gravam sem erro de coluna ou de sintaxe, coisa que a conexão falsa dos specs não pega → T-17

## Critérios gerais de aceite
- `grep -ri prisma backend/src backend/test backend/package.json` termina com exit 1 e 0 linhas.
- `npm ci` (sem `postinstall`), `npm run build`, `npx tsc --noEmit`, `npx eslint "{src,test}/**/*.ts"`, `npm test` e `npm run test:e2e` terminam com exit 0 em `backend/`.
- DTOs, códigos de erro (`EMAIL_UNAVAILABLE`, `TENANT_SLUG_TAKEN`, `TENANT_OUT_OF_SCOPE`) e o formato `{ data, total }` das listagens ficam iguais; os specs de guard e de service existentes passam com as mesmas asserções de comportamento.
- Nenhum SQL com valor interpolado; todo UPDATE/DELETE com WHERE (guarda `ensureSafeWhere`); todo acesso a dado do RAG com `tenant_id`.
- O `SHOW CREATE TABLE` das 11 tabelas criadas pelo runner em banco novo tem diff vazio contra o banco criado pelo Prisma.
