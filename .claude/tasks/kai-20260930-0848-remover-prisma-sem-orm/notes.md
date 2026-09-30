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

## Bloqueios
- nenhum

## Descobertas
- O MySQL de dev do projeto é o container `geduc-rag-db-mysql-1` em `localhost:3307` (banco `geduc_rag`); há outro MySQL do host em `127.0.0.1:3306` que não deve ser usado.
- `npm run lint` tem `--fix` embutido, e o hook `format-file.sh` roda `eslint --fix` em cada `.ts` editado. Use `npx eslint "{src,test}/**/*.ts"` para verificar.
- `users.policy.spec.ts` e `tenant.guard.spec.ts` não usam Prisma; `users.policy.spec.ts` só muda por causa de `userScopeWhere`.
- O `IDocumentRepository.list` e o `UsersService.list` já devolvem `{ data, total }`.
- [T-01] DATABASE_CONNECTION/IDatabaseConnection prontos (714a370). ensureSafeWhere também recusa `/*` e qualquer `#`/`--` no SQL inteiro e exige operador depois do primeiro WHERE; update/delete só servem para UPDATE/DELETE com WHERE, e `INSERT … ON DUPLICATE KEY UPDATE` vai por insert.

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
- Último status conhecido: onda 1 concluída (T-01 e T-02 [x]); validador e revisão sem bloqueantes.
- Próxima onda recomendada: onda 2 (T-03, T-04 e demais com dependências T-01/T-02 satisfeitas, conforme plan.md)
