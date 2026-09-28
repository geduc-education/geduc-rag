# CLAUDE.md — Backend (NestJS) · GEDUC RAG

NestJS 11 + TypeScript + Prisma 7 + MySQL.

## Duas famílias de módulo

| Família | Módulos | Padrão |
|---|---|---|
| **Plataforma** | `auth`, `users`, `profiles`, `tenants`, `changelog` | geduc-suporte: Controller → Service → PrismaService |
| **RAG** | `documents`, `ingestion`, `embedding`, `retrieval`, `generation`, `chat` | rag-api: Clean Architecture (use cases + gateways) — ver `.docs/rag-architecture.md` |

Não misture: módulo de plataforma não ganha use case/gateway; módulo RAG não
injeta `PrismaService` em use case (vai por repository atrás de interface).

## Estrutura de pastas

```text
src/
  app.module.ts · main.ts · app.controller.ts (GET /health)
  common/{decorators,dto,errors,filters,guards,interceptors,pipes,rbac,tenancy,types}/
  config/            # env.validation.ts, cors, logger, swagger, throttler
  database/          # prisma.service.ts, database.module.ts
  @core/             # infra do RAG: vector-store e queue (in-memory), exceções, IUseCase
  modules/{module}/  # plataforma: controller/service/module + dto/ + __tests__/
                     # RAG: application/ domain/ infra/ controllers/ + *.providers.ts
prisma/              # schema.prisma, migrations/, seed.ts
test/                # e2e (Prisma stubado — prova o wiring)
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
  service. Em `users`: `userScopeWhere` (tenants em comum),
  `assertTenantsGrantable`, `assertPermissionsGrantable`, `assertCanModify`/
  `assertCanDisable` — todas em `modules/users/users.policy.ts` (puras,
  testadas isoladamente).
- Leitura fora do alcance é **404** indistinto; e-mail duplicado é 409
  `EMAIL_UNAVAILABLE` neutro (não revela se o usuário está fora do alcance).
- Rota do RAG: sempre `@TenantScoped()` + `@TenantId()`. Nunca aceite tenant do
  corpo ou do header cru. Toda busca vetorial é filtrada por `tenantId`.
- Códigos de erro só em `common/errors/error-codes.ts`.

## Regras — Services, DTOs, Prisma

- Nunca retorne `passwordHash` (use `USER_SELECT` + `toUserResponse`).
- DTOs com `class-validator` + `@ApiProperty`; update com
  `PartialType(CreateDto, UPDATE_DTO_PARTIAL_OPTS)`; opcional de coluna NOT
  NULL usa `@IsOptionalNotNull()`. Proibido `any`.
- Tabelas `snake_case` (`@@map`/`@map`); FK de cadastro `Restrict`/`SetNull`,
  Cascade só em tabela de junção/filha pura.
- E-mail sempre normalizado (`normalizeEmail`) na escrita e no login.
- Exclusão de usuário é lógica (`deletedAt`); o e-mail segue reservado.

## Regras — Módulos RAG (herdadas do rag-api)

1. Controller sem `@Injectable()`, injeção só por construtor, só use cases.
2. Use case é classe pura (sem `@Inject()`), wiring no `*.providers.ts` com
   `useFactory` + `inject: []` (tokens string para interfaces).
3. Import cross-module e SDK de provider externo **só** em `infra/gateways/`.
4. Sem dependência circular entre módulos.
5. Estado atual: `RAG_STORAGE=mysql` (default) usa repositórios Prisma e o
   vector store é o próprio MySQL (`document_chunk.embedding Bytes`, busca por
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
npm run test:e2e         # e2e (Prisma stubado)
npx prisma migrate dev   # criar/aplicar migration (dev local!)
npx prisma generate      # regenerar client
npm run db:seed          # seed idempotente (guard NODE_ENV=production)
```

## NUNCA FAÇA

1. Prisma em controller · 2. Retornar `passwordHash` · 3. Rota sensível sem
`@RequirePermissions` · 4. `@Public()` sem intenção · 5. Secrets/URLs
hardcoded · 6. `any` em controller/service/DTO · 7. FK de cadastro com
Cascade · 8. Rota do RAG sem `@TenantScoped()` ou busca vetorial sem `tenantId`
· 9. Conceder perfil/tenant sem as asserções de `users.policy.ts`.

## Estilo

Nomes em inglês, kebab-case nos arquivos, Prettier do projeto (80 colunas).
Funções curtas, early returns. Imports: NestJS → externos → locais.
