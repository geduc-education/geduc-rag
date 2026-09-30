# CLAUDE.md — Backend (NestJS) · GEDUC RAG

NestJS 11 + TypeScript + mysql2 (SQL parametrizado, sem ORM) + MySQL.

## Duas famílias de módulo

| Família | Módulos | Padrão |
|---|---|---|
| **Plataforma** | `auth`, `users`, `profiles`, `tenants`, `changelog` | geduc-suporte: Controller → Service → repositório SQL |
| **RAG** | `documents`, `ingestion`, `embedding`, `retrieval`, `generation`, `chat` | rag-api: Clean Architecture (use cases + gateways) — ver `.docs/rag-architecture.md` |

Não misture: módulo de plataforma não ganha use case/gateway; módulo RAG não
injeta `IDatabaseConnection` em use case (vai por repository atrás de interface).

## Estrutura de pastas

```text
src/
  app.module.ts · main.ts · app.controller.ts (GET /health)
  common/{decorators,dto,errors,filters,guards,interceptors,pipes,rbac,tenancy,types}/
  config/            # env.validation.ts, cors, logger, swagger, throttler
  database/          # database.module.ts (DATABASE_CONNECTION), seed/run-seed.ts
  @core/             # infra do RAG: vector-store e queue (in-memory), exceções, IUseCase
  modules/{module}/  # plataforma: controller/service/module + dto/ + __tests__/
                     # RAG: application/ domain/ infra/ controllers/ + *.providers.ts
database/             # migrate.ts, seed.ts (CLIs) e migrations/NNNN_*.sql
test/                # e2e (DATABASE_CONNECTION stubado — prova o wiring)
```

## Guards globais (ordem importa)

`JwtAuthGuard` → `MustChangePasswordGuard` → `PermissionsGuard` → `TenantGuard`.

- `JwtAuthGuard`: toda rota exige Bearer; opt-out só com `@Public()`.
- `MustChangePasswordGuard`: com `mustChangePassword`, só passam as rotas
  `@AllowPasswordChangePending()` (`/auth/change-password`, `/auth/me`).
- `PermissionsGuard`: `@RequirePermissions` (AND) / `@RequireAnyPermission`
  (OR); permissão efetiva do `EffectivePermissionsService` (fonte única — não
  reescreva a query). SUPERADMIN tem bypass.
- `TenantGuard`: só em `@TenantScoped()`. Exige `tenant-id` (UUID), confere o
  vínculo via `TenantAccessService` e popula `req.tenantId`, lido com
  `@TenantId()`.

## Regras — Autorização

- O guard de permissão responde "pode usar esta rota"; o **alcance** é do
  service. Em `users`: `scopeOf` (tenants em comum, `TenantScope`),
  `assertTenantsGrantable`, `assertPermissionsGrantable`, `assertCanModify`/
  `assertCanDisable` — todas em `modules/users/users.policy.ts` (puras,
  testadas isoladamente).
- Leitura fora do alcance é **404** indistinto; e-mail duplicado é 409
  `EMAIL_UNAVAILABLE` neutro (não revela se o usuário está fora do alcance).
- Rota do RAG: sempre `@TenantScoped()` + `@TenantId()`. Nunca aceite tenant do
  corpo ou do header cru. Toda busca vetorial é filtrada por `tenantId`.
- Códigos de erro só em `common/errors/error-codes.ts`.

## Regras — Services, DTOs, SQL e repositórios

- Nunca retorne `passwordHash` (projete colunas no repositório e use
  `toUserResponse` de `users.mapper.ts`).
- DTOs com `class-validator` + `@ApiProperty`; update com
  `PartialType(CreateDto, UPDATE_DTO_PARTIAL_OPTS)`; opcional de coluna NOT
  NULL usa `@IsOptionalNotNull()`. Proibido `any`.
- Tabelas `snake_case`; FK de cadastro `RESTRICT`/`SET NULL`, `CASCADE` só em
  tabela de junção/filha pura.
- E-mail sempre normalizado (`normalizeEmail`) na escrita e no login.
- Exclusão de usuário é lógica (`deleted_at`); o e-mail segue reservado.

SQL (padrão do `check-sql`), via `IDatabaseConnection` (`DATABASE_CONNECTION`):

- **Valor** sempre em placeholder (`?`/`:nome`); nunca concatenado nem
  interpolado. **Identificador** (tabela, coluna, `ORDER BY`) só por allow-list.
- `LIMIT`/`OFFSET` nunca interpolados: placeholder ou inteiro já validado.
- Sem `SELECT *`: liste as colunas. Sem N+1: `IN (...)` ou join, nunca
  `query()` em `for`/`map`.
- `tenant_id` em todo acesso a dado do RAG (leitura e escrita).
- `UPDATE`/`DELETE` sempre com `WHERE` (`ensureSafeWhere` recusa o resto).
- `updated_at = NOW(3)` em todo `INSERT`/`UPDATE` (não há `@updatedAt`).
- `key` e `system` são reservadas no MySQL 8: sempre com crase.
- Métodos de escrita aceitam `tx?: ITransactionalConnection`; nada de chamada
  externa (HTTP, LLM, embedding) dentro de transação.
- Repositório é injetado por token string (`'IUserRepository'`, ...) com
  `@Inject` e `import type` da interface.

Migrations: `backend/database/migrations/NNNN_*.sql`, aplicadas por
`npm run db:migrate`. Mudança de schema = nova migration; **nunca** edite uma
já aplicada. O runner só roda em banco local pela CLI (não roda no arranque
do container).

## Regras — Módulos RAG (herdadas do rag-api)

1. Controller sem `@Injectable()`, injeção só por construtor, só use cases.
2. Use case é classe pura (sem `@Inject()`), wiring no `*.providers.ts` com
   `useFactory` + `inject: []` (tokens string para interfaces).
3. Import cross-module e SDK de provider externo **só** em `infra/gateways/`.
4. Sem dependência circular entre módulos.
5. Estado atual: `RAG_STORAGE=mysql` (default) usa repositórios SQL (mysql2) e o
   vector store é o próprio MySQL (`document_chunk.embedding BLOB`, busca por
   varredura linear filtrada por tenant); `RAG_STORAGE=memory` mantém os
   adapters in-memory (e2e, dev sem banco). `EMBEDDING_PROVIDER=local`
   (transformers.js) e `LLM_PROVIDER=ollama` (Ollama local, `qwen2.5:7b`) são
   os providers reais; `mock` de ambos continua para testes/CI — ver
   `.docs/ollama-setup.md`. A seleção é por `useFactory` nos `*.providers.ts`;
   trocar de provider não deve tocar use case, controller nem teste.

## Comandos

```bash
npm run start:dev        # watch
npm run build            # compilar
npm run lint             # ESLint --fix
npx tsc --noEmit         # typecheck (inclui specs — o build NÃO compila specs)
npm test                 # unit
npm run test:e2e         # e2e (DATABASE_CONNECTION stubado)
npm run db:migrate       # aplica database/migrations/*.sql (dev local!)
npm run db:seed          # seed idempotente (guard NODE_ENV=production)
```

## NUNCA FAÇA

1. SQL/`IDatabaseConnection` em controller · 2. Retornar `passwordHash` · 3. Rota sensível sem
`@RequirePermissions` · 4. `@Public()` sem intenção · 5. Secrets/URLs
hardcoded · 6. `any` em controller/service/DTO · 7. FK de cadastro com
Cascade · 8. Rota do RAG sem `@TenantScoped()` ou busca vetorial sem `tenantId`
· 9. Conceder perfil/tenant sem as asserções de `users.policy.ts` ·
10. Interpolar valor em SQL · 11. UPDATE/DELETE sem `WHERE` · 12. Editar
migration já aplicada.

## Estilo

Nomes em inglês, kebab-case nos arquivos, Prettier do projeto (80 colunas).
Funções curtas, early returns. Imports: NestJS → externos → locais.
