# Board — kai-20260930-0848-remover-prisma-sem-orm

Log append-only de fatos que afetam outras tasks desta execução: contrato divergente, símbolo renomeado, arquivo compartilhado alterado, decisão que outra task precisa conhecer. Uma linha por fato, acrescentada por append com heredoc (abaixo; o delimitador entre aspas aceita qualquer caractere no fato); nunca edite ou remova linhas. Leia antes de começar uma task e antes de usar cada `Consome`. O fechador consolida as linhas em `notes.md § Descobertas`.

Formato: `- [T-NN] <fato>`

Append:

```bash
cat >> "/home/kaine/source/geduc-rag/.claude/tasks/kai-20260930-0848-remover-prisma-sem-orm/board.md" <<'EOF'
- [T-NN] <fato>
EOF
```
- [T-01] `DATABASE_CONNECTION`/`IDatabaseConnection` prontos (commit 714a370). `ensureSafeWhere` também recusa `/*` e qualquer `#`/`--` no SQL inteiro, e exige operador (`=`, `<>`, `!=`, `<`, `>`, `IN (`, `IS [NOT] NULL`, `LIKE`, `BETWEEN`, `EXISTS`) depois do primeiro `WHERE`. O `update`/`delete` só servem para UPDATE/DELETE com WHERE; `INSERT … ON DUPLICATE KEY UPDATE` vai por `insert`.
- [T-04] `DocumentRepository` (SQL) substitui `PrismaDocumentRepository`, que foi removido junto com seu spec (a7e549a). `documents.providers.ts` injeta `DATABASE_CONNECTION`; `src/modules/documents` não referencia mais Prisma.
- [T-03] Runner pronto (f51d627 RED, aff7581): `backend/database/migrations/0001_init.sql` e `0002_rag_persistence.sql` idênticos ao Prisma (cmp), CLI `backend/database/migrate.ts`, script `db:migrate` em `backend/package.json` (logo após `db:seed`). `MigrationConnection.query` devolve linhas; a CLI desembrulha `[rows, fields]`.
- [T-05] `PrismaConversationRepository` e seu spec removidos; `ConversationRepository(connection: IDatabaseConnection)` em `chat/infra/database/repositories/conversation.repository.ts`, provider `'IConversationRepository'` injeta `[ConfigService, DATABASE_CONNECTION]` (85f844b). `src/modules/chat` não referencia mais `PrismaService`.
- [T-07] `buildEffectivePermissions(grants: UserGrants)`, `scopeOf`/`TenantScope` (em `tenant-access.service.ts`) e os tokens `'IEffectivePermissionsRepository'`/`'ITenantAccessRepository'` prontos; `EFFECTIVE_PERMISSIONS_SELECT` e `UserWithEffectivePermissions` removidos. O e2e já sobrescreve `DATABASE_CONNECTION` com stub que rejeita qualquer chamada: repositório novo usado no e2e precisa de override próprio. Nos services, interfaces injetadas via `@Inject` exigem `import type`/`type X` (TS1272 com isolatedModules).
