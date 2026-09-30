# Notas de execução

## Decisões tomadas
- 2026-09-30 · plano · onda 0 — Premissas da Fase 1 fechadas: runner mínimo com baseline 0001/0002 sem alterar DDL, `@updatedAt` preenchido pela aplicação (`updated_at = NOW(3)`), datas como `Date`, FKs mantidas, banco único com `tenant_id`, services continuam services, `.claude/settings.json` só como proposta.
- 2026-09-30 · plano · onda 0 — O adapter usa `pool.query` em vez de `execute`: `IN (?)` com array, `VALUES ?` em lote e `LIMIT ? OFFSET ?` numérico só funcionam no protocolo texto com escape do cliente. Valores continuam sempre em placeholder.
- 2026-09-30 · plano · onda 0 — Fuso fixo em UTC (`timezone: 'Z'` + `SET time_zone = '+00:00'` por conexão): o Prisma gravava e lia DATETIME em UTC, e `NOW(3)` precisa sair no mesmo fuso de `created_at`.
- 2026-09-30 · plano · onda 0 — `DATABASE_URL` continua igual; `buildPoolOptions` faz o parse e descarta os query params (`allowPublicKeyRetrieval` é do driver `mariadb`). O mysql2 negocia `caching_sha2_password` sozinho.
- 2026-09-30 · plano · onda 0 — Paginação: o contrato HTTP é `{ data, total }` (não o `{ items, pagination }` do api-geduc-tenant). O builder devolve SQL + params de página e contagem; o repositório executa e monta `{ data, total }`.
- 2026-09-30 · plano · onda 0 — `ensureSafeWhere` vive em `query-builder/mutation-guard.ts` (T-01) e é chamado por `update`/`delete` do adapter e do `tx`, então nenhum UPDATE/DELETE escapa da guarda.
- 2026-09-30 · plano · onda 0 — Vínculos N:N usam `ON DUPLICATE KEY UPDATE id = id` no lugar de `INSERT IGNORE`: mesmo efeito do `skipDuplicates`, sem engolir erro de FK. Lista vazia vira `DELETE … WHERE user_id = ?` (nunca `NOT IN ()`).
- 2026-09-30 · plano · onda 0 — `userScopeWhere` e `tenantWhere` saem dos contratos; o alcance vira `TenantScope = readonly string[] | 'all'` (`scopeOf(reach)` em `tenant-access.service.ts`), passado aos repositórios. `[]` significa nada visível (`1 = 0`).
- 2026-09-30 · plano · onda 0 — `buildEffectivePermissions` passa a receber `UserGrants { isSuperAdmin, permissionKeys }` (T-07). Para o build não quebrar entre ondas, T-07 ajusta a única chamada em `users.select.ts`, que só some em T-13; `users.mapper.ts` (T-10) passa a ser a projeção nova, usada por auth (T-12) e users (T-13).
- 2026-09-30 · plano · onda 0 — `ConversationRepository.save` confere a posse (id + `tenant_id` + `user_id`) depois do upsert, na mesma transação, e faz rollback se não for do par. É uma defesa a mais: nos fluxos legítimos o use case já garante a posse e o resultado não muda.
- 2026-09-30 · plano · onda 0 — Ordenação de usuários `u.name ASC, u.id ASC`: preserva o `name asc` atual e deixa a paginação estável em empates.
- 2026-09-30 · plano · onda 0 — Migrations não rodam no arranque do container. Hoje também não rodam (o `CMD` é só `node dist/src/main`; o comentário do Dockerfile sobre `migrate deploy` está errado).
- 2026-09-30 · plano · onda 0 — `tsconfig.build.json` troca `prisma` por `database` no `exclude` (CLIs de migrate e seed rodam por `ts-node`, fora do `dist`). O `tsc --noEmit` do `tsconfig.json` continua cobrindo `backend/database/*.ts`.
- 2026-09-30 · plano · onda 0 — `key` e `system` são palavras reservadas do MySQL 8: todo SQL as escreve com crase.
- 2026-09-30 · T-01 · onda 1 — Erro prettier em mysql.adapter.ts:137 apontado pelo hook check-complexity foi corrigido durante a onda (instrução do orquestrador, sem fix loop).
- 2026-09-30 · T-02 · onda 1 — DuplicateEntryException não portada (a Interface da task não pedia); só isMysqlDuplicateEntry.
- 2026-09-30 · T-07 · onda 2 — Erros prettier/no-unnecessary-type-assertion apontados pelo hook check-complexity foram repassados ao implementador e corrigidos antes do commit (sem fix loop).
- 2026-09-30 · T-04 · onda 2 — Desvio aceito: `list` roda página e count em `Promise.all` fora de transação.
- 2026-09-30 · T-06 · onda 2 — Upsert com `VALUES(col)` (deprecado no MySQL 8) aceito; validar no banco real em T-17.
- 2026-09-30 · T-09 · onda 3 — RED 61c7e1d inclui tenant.repository.spec.ts além do tenants.service.spec.ts declarado; aceito (commit só de teste, sem implementação), sem reescrita de histórico.
- 2026-09-30 · T-10 · onda 3 — Desvios aceitos: `p.active = 1` literal nas queries em lote; `replaceTenants` grava `updated_by_id` em `user` (`user_tenant` não tem a coluna).
- 2026-09-30 · T-11 · onda 3 — Desvios aceitos: SELECT id após upsert, transação na regravação de perfis e na criação do SUPERADMIN, 4º caso de teste.
- 2026-09-30 · T-10 · onda 3 — Lint transitório do RED (user.repository.spec.ts, TS2307) acusado pelo hook check-complexity, resolvido pela implementação, sem ação.
- 2026-09-30 · T-12 · onda 4 — Desvios aceitos: `buildAuthResponse` lança UnauthorizedException quando `findById` devolve null; correção de lint do spec entrou no commit de implementação.
- 2026-09-30 · T-13 · onda 4 — Desvio aceito: `create` relê o usuário via `users.findById`.
- 2026-09-30 · T-12, T-13 · onda 4 — `não rodado: npm ci` aceito como adiado para T-17 (dona da validação de npm ci limpo), para não alterar node_modules no meio da migração.
- 2026-09-30 · T-16 · onda 5 — O classificador do auto mode negou o commit do implementador em .claude/hooks/ (Self-Modification); o usuário autorizou o orquestrador a commitar. Antes, o orquestrador restaurou a detecção de `dropdb` em protect-db.sh (removida junto com os padrões do Prisma) e testou: dropdb → ask, DELETE sem WHERE → exit 2, DROP TABLE → ask, ls → passa.
- 2026-09-30 · T-14 · onda 5 — Desvio aceito: build exigiu `"rootDir": "."` em tsconfig.build.json.
- 2026-09-30 · T-14 · onda 5 — Critério `grep -ri prisma`: `_prisma_migrations`/`PRISMA_BASELINE` no migration-runner e no spec são resíduo legítimo (baseline). Menções textuais em src/@core/infra/adapters/mysql.adapter.ts:22, src/@core/infra/database/query-builder/filters.ts:45 e query-builder/README.md:16 ficam para a onda de correção após a revisão final.
- 2026-09-30 · T-14 · onda 5 — `não rodado`: SHOW CREATE TABLE e `npm ci` real adiados para T-17 (dona); nesta onda só `npm ci --dry-run` com exit 0.

## Bloqueios
- nenhum

## Descobertas
- O MySQL de dev do projeto é o container `geduc-rag-db-mysql-1` em `localhost:3307` (banco `geduc_rag`); há outro MySQL do host em `127.0.0.1:3306` que não deve ser usado.
- `npm run lint` tem `--fix` embutido, e o hook `format-file.sh` roda `eslint --fix` em cada `.ts` editado. Use `npx eslint "{src,test}/**/*.ts"` para verificar.
- `users.policy.spec.ts` e `tenant.guard.spec.ts` não usam Prisma; `users.policy.spec.ts` só muda por causa de `userScopeWhere`.
- O `IDocumentRepository.list` e o `UsersService.list` já devolvem `{ data, total }`.
- [T-01] DATABASE_CONNECTION/IDatabaseConnection prontos (714a370). ensureSafeWhere também recusa `/*` e qualquer `#`/`--` no SQL inteiro e exige operador depois do primeiro WHERE; update/delete só servem para UPDATE/DELETE com WHERE, e `INSERT … ON DUPLICATE KEY UPDATE` vai por insert.
- [T-04] `DocumentRepository` (SQL) substitui `PrismaDocumentRepository`; `src/modules/documents` não referencia mais Prisma (a7e549a).
- [T-03] Runner pronto (f51d627, aff7581): migrations 0001/0002 idênticas ao Prisma (cmp), CLI `backend/database/migrate.ts`, script `db:migrate`; `MigrationConnection.query` devolve linhas.
- [T-05] `ConversationRepository` em SQL substitui o Prisma; `src/modules/chat` não referencia mais `PrismaService` (85f844b).
- [T-07] `buildEffectivePermissions(grants: UserGrants)`, `scopeOf`/`TenantScope` e tokens `'IEffectivePermissionsRepository'`/`'ITenantAccessRepository'` prontos; o e2e sobrescreve `DATABASE_CONNECTION` com stub que rejeita chamadas, então repositório novo no e2e precisa de override próprio; interfaces injetadas via `@Inject` exigem `import type` (TS1272).
- [T-08] `PROFILE_REPOSITORY = 'IProfileRepository'`, `IProfileRepository`/`ProfileWithPermissions` em `profiles/application/interface/repository/profile.repository.interface.ts`; `ProfilesModule` exporta `PROFILE_REPOSITORY` (quem consome importa `ProfilesModule`). `src/modules/profiles` não referencia mais Prisma.
- [T-11] `runSeed` em `backend/src/database/seed/run-seed.ts` e CLI `backend/database/seed.ts` prontos (905610e RED, 5b660dd); T-14 deve apontar `db:seed` (e remover o bloco `"prisma": { "seed" }`) para `ts-node database/seed.ts`. `prisma/seed.ts` continua intacto até T-14.
- [T-09] `TENANT_REPOSITORY = 'ITenantRepository'`/`ITenantRepository` prontos e exportados por `TenantsModule` (interface em `modules/tenants/application/interface/repository/tenant.repository.interface.ts`; `countExisting([])` → 0 sem SQL). `tenantWhere()` e o import de Prisma saíram de `tenant-access.service.ts`. `TenantsModule` não é global: quem consumir `TENANT_REPOSITORY` (ex.: users) precisa importar `TenantsModule`.
- [T-10] `USER_REPOSITORY = 'IUserRepository'` pronto e exportado pelo `UsersModule` (0fc23ce RED, 2403a80); tipos em `users/application/interface/repository/user.repository.interface.ts`, `toUserResponse(UserAggregate)` em `users/users.mapper.ts` (o de `users.select.ts` segue até T-13). `create` grava `must_change_password = 1`; `replaceTenants` grava `updated_by_id` em `user` (a tabela `user_tenant` não tem a coluna). `findInScope(id, [])` devolve `null` sem consultar. No e2e o repositório é construído sobre o stub de `DATABASE_CONNECTION` — quem passar a usá-lo no e2e (T-12/T-13) precisa de override.
- [T-12] `AuthService` injeta `IUserRepository` (`USER_REPOSITORY`) e usa `toUserResponse` de `users.mapper.ts`; `AuthModule` importa `UsersModule`; `src/modules/auth` sem Prisma (5b1c8b2). O e2e não passa por auth, sem override.
- [T-13] `UsersService(users, profiles, tenants, permissions, tenantAccess)` pronto (4bfa766); `users.select.ts` e `userScopeWhere` removidos, `src/modules/users` sem Prisma; `UsersModule` importa `ProfilesModule`/`TenantsModule`.
- [T-14] Prisma removido (20b1318): deps, `prisma/`, `prisma.config.ts`, `PrismaService`; `db:seed` → `ts-node database/seed.ts`; `tsconfig.build.json` fixa `rootDir "."` para manter `dist/src/main`.
- [T-15] Docs e agentes sem Prisma (5030a6e); nest-backend.md passou de PostgreSQL para MySQL.
- [T-16] Hooks protect-migrations.sh e protect-db.sh no novo caminho (d6613db); `dropdb` continua detectado.

## Pendências
- Proposta para o usuário aplicar em `.claude/settings.json` (não editado pelo plano): remover da allowlist `Bash(npx prisma generate)`, `Bash(npx prisma validate)` e `Bash(npx prisma migrate diff *)`. Se quiser, acrescentar `Bash(npm run db:migrate)` (aplica schema, avalie antes de liberar).
- T-17 depende do container MySQL local no ar e de o usuário `rag` ter permissão de `CREATE DATABASE` para o banco descartável `geduc_rag_runner_check`. Sem essa permissão, a comparação de schema vira pendência de ambiente. O banco descartável não é removido pelo agente, porque `DROP DATABASE` exige confirmação.
- T-01: ensureSafeWhere aceita `WHERE 1=1 LIMIT n`, `WHERE 1=1 OR id = ?`, `WHERE id = id` e UPDATE com subquery WHERE sem WHERE externo (mutation-guard.ts:25-34).
- T-01: `query()` executa UPDATE/DELETE sem a guarda; depende de disciplina dos repositórios (mysql.adapter.ts:59-64).
- T-01: falha do ROLLBACK substitui o erro original e a conexão volta ao pool por release(); considerar preservar o erro e `conn.destroy()` (mysql.adapter.ts:135-137).
- T-01: cobertura do fuso UTC é só de configuração; a leitura real de registro gravado pelo Prisma fica para o smoke de T-17.
- T-02: nome de param repetido entre filtros sobrescreve o valor em silêncio (filters.ts:20,67); considerar InvalidQueryError em colisão, pois T-07/T-10 compõem addRaw com EXISTS.
- T-02: toPositional casa `:letra` dentro de literal SQL e lança "Parâmetro ausente"; documentar no README (sql-params.ts:15).
- T-02: caso de teste diz "undefined/null" mas só testa null; `{ x: undefined }` é aceito e o mysql2 o trata diferente de null (query-builder.spec.ts:28).
- Critérios cruzados de grep prisma, SHOW CREATE TABLE e npm ci dependem de ondas posteriores.
- T-03: fake de `_prisma_migrations` ignora o WHERE (`finished_at IS NOT NULL AND rolled_back_at IS NULL`); faltam caso de migration revertida/inacabada e caso "baseline só com `schema_migrations` vazia" (migration-runner.ts:98).
- T-03: falha no meio de uma migration (DDL não transacional) deixa nada registrado; documentar a recuperação manual no cabeçalho da CLI (migration-runner.ts:138).
- T-03: a CLI usa `timezone: 'Z'` sem `SET time_zone = '+00:00'`; `applied_at` sai na hora do servidor (migrate.ts:38).
- T-03: `tsconfig.build.json` não exclui `database/`; tratar em T-14 (a decisão de onda 0 troca `prisma` por `database` no `exclude`).
- T-04: wiring de `'IDocumentRepository'` sem spec próprio (documents.providers.ts:31-41).
- T-04: `list` com página e COUNT fora de transação pode divergir sob escrita concorrente (document.repository.ts:97-103).
- T-05: teste "devolve null…" usa `calls.every(...)`, que passa vazio; asserir também `calls.length > 0` (conversation.repository.spec.ts:193).
- T-05: checagem de posse lança `Error` genérico; considerar erro de domínio tipado (conversation.repository.ts:132).
- T-05: `ORDER BY m.created_at ASC` sem desempate por id (preexistente) (conversation.repository.ts:47).
- T-06: `VALUES(col)` no upsert é deprecado no MySQL 8.0.20+; validar no banco real em T-17 (mysql-vector-store.client.ts:23-31).
- T-06: factory de `VECTOR_STORE_CLIENT` sem teste unitário (vector-store.module.ts:21-31).
- T-07: `scopeOf` sem teste; só é exercitado a partir de T-09/T-10 (tenant-access.service.ts:22).
- T-07: "ignora tenant excluído" provado só por `toContain('t.deleted_at IS NULL')`; verificar no MySQL real em T-17 (tenant-access.repository.spec.ts:64).
- Validador (onda 2): `import { Prisma }` e `tenantWhere` restantes em tenant-access.service.ts:2,64 são permitidos até T-09; grep prisma global, npm ci, SHOW CREATE TABLE e `db:migrate` contra banco real dependem de T-08…T-17.
- T-08: `ProfilesService.list` sem spec (profiles.service.ts:16); `findActiveByIds` sem asserção de `ORDER BY p.name ASC` e `active = ?` (profile.repository.spec.ts:83).
- T-09: aliases `CreateTenantInput`/`UpdateTenantInput` no lugar do literal de Produz (tenant.repository.interface.ts:14-38); "fora do alcance sem consultar" já passava no RED (tenants.service.spec.ts:75-82); "tenant sumido depois do UPDATE" usa `rejects.toThrow()` genérico (tenant.repository.spec.ts:189-195).
- T-10: `toUserResponse` sem teste próprio (users.mapper.ts:24); `addIn` em Consome, mas o escopo usa `addRaw` com `IN (:scopeTenantIds)` (user-list.query.ts:589); teste de `create` não confere `must_change_password`/`active` (user.repository.spec.ts:323).
- T-11: `profileIds.get(ADMIN_PROFILE) ?? ''` esconde perfil ausente (run-seed.ts:202); `permissionIds.get(key)` sem checagem de chave fora do catálogo (run-seed.ts:95); caso "senha ausente" não afirma ausência de INSERT em `user` (run-seed.spec.ts:136-144).
- Validador (onda 3): grep global de prisma ainda com 138 linhas em arquivos de T-12/T-13/T-14 (com dona); npm ci e SHOW CREATE TABLE dependem de T-17; `db:seed` ainda aponta para prisma/seed.ts (T-14); seed não rodado em banco (T-17). T-13: `TenantsModule` não é global, importar para usar `TENANT_REPOSITORY`.
- T-12: ramo `findById` → null (401 'Sessão inválida.') sem caso no spec (auth.service.ts:102); caso `limpa mustChangePassword ao trocar` não verifica o retorno de `changePassword` (auth.service.spec.ts:163).
- T-13: ramo `findById` → null após `create` (404 USER_NOT_FOUND) sem teste (users.service.ts:230); RED falha por `TypeError: reachOf is not a function` em vez de asserção explícita (reports/T-13.md § RED); `backend/CLAUDE.md` cita `userScopeWhere`/`USER_SELECT` (dona T-15).
- Validador (onda 4): grep global de prisma ainda encontra app.module.ts, database/prisma.service.ts, package.json, migration-runner, env.validation etc. (dona T-14); `npm ci` não rodado, adiado para T-17.
- Validador (onda 5): comentário desatualizado ("in-memory") em app.module.ts:40 (não é Prisma).
- T-14: `.env.example` ainda exemplifica `?allowPublicKeyRetrieval=true` na URL apesar de dizer que query params são ignorados (backend/.env.example:13-16).
- T-14: comentário do módulo raiz diz que a infra `@core` é "ainda in-memory", o que não vale com `RAG_STORAGE=mysql` (app.module.ts:40).
- T-15: `scopeOf` citado como de `users.policy.ts`, mas definido em `common/tenancy/tenant-access.service.ts:23` (backend/CLAUDE.md:47-50); lista de destrutivos redundante e linhas > 80 colunas (.claude/CLAUDE.md:48-49); indentação da árvore de pastas desalinhada (backend/CLAUDE.md:26).
- T-16: relatório ficou com "Status: parcial" e "Commit não feito", superado pelo commit d6613db; `dropdb` mantido em bloco próprio, divergência autorizada da Interface.
- Menções textuais a Prisma restantes: mysql.adapter.ts:22, query-builder/filters.ts:45 e query-builder/README.md:16 (limpeza na onda de correção após a revisão final).
- Onda 5 não rodou SHOW CREATE TABLE nem `npm ci` real (só `--dry-run`): dependem de T-17.

## Riscos
- Datas deslocadas por fuso: a mitigação é UTC fixo no pool e o caso de teste em T-01, e T-17 compara um `createdAt` real antes e depois.
- INSERT sem `updated_at` ou coluna reservada sem crase só falham no banco real: a mitigação é a regra no Interface de cada task e o seed + CRUD reais em T-17.
- Lockfile: `npm install` em T-01 e T-14, cada um sozinho na onda como escritor do lockfile.
- O hook `format-file.sh` reescreve os `.ts` editados: o implementador relê o arquivo antes do commit e não roda `npm run lint`.
- `git rm` de `backend/prisma/migrations/**` (T-14) é Bash e não passa pelo `protect-migrations.sh`: a remoção só acontece depois de T-03 ter copiado byte a byte (com `cmp` validado).

## Retomada
- Pasta: `.claude/tasks/kai-20260930-0848-remover-prisma-sem-orm/`
- Sessões: 26399f40-1989-4b2a-a596-b3f96a533b34
- Branch de trabalho: task/remover-prisma-sem-orm (base: main)
- BASE da onda 1: 481715e
- Commits por onda:
  - Onda 1: BASE 481715e → HEAD 714a370 (3dfaea6, c1686b8, 48e23ac, 714a370)
  - Onda 2: BASE 1a413ea → HEAD 1a1f7ce (f51d627, 64dff80, 6d2b876, 6686dbe, 9748701, aff7581, a7e549a, ad3c0c3, 85f844b, 1a1f7ce)
  - Onda 3: BASE 151d3a8 → HEAD 2403a80 (5f2b723, 905610e, 3f1072e, 61c7e1d, 5b660dd, 0fc23ce, 5ccd0cb, 2403a80)
  - Onda 4: BASE fbfdcd4 → HEAD 4bfa766 (7e5f6a2, 4de4688, 5b1c8b2, 4bfa766)
  - Onda 5: BASE 74e324a → HEAD d6613db (5030a6e, 20b1318, d6613db)
- Último status conhecido: onda 5 concluída (T-14, T-15 e T-16 [x]); validador e revisão sem bloqueantes.
- Próxima onda recomendada: onda 6 (T-17, validação final)
