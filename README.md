# GEDUC RAG

Plataforma de RAG (Retrieval-Augmented Generation) multi-tenant: base de
conhecimento por tenant (documentos → chunks → embeddings) e assistente que
responde com citações. Identidade própria, RBAC N:N e vínculo usuário ↔ tenant.

Stack: **Backend** NestJS 11 + TypeScript + Prisma 7 + MySQL ·
**Frontend** Flutter Web (FVM) + flutter_modular + Dio.

Monorepo no mesmo padrão do `geduc-suporte`. O pipeline de RAG veio do
`rag-api` (Clean Architecture, adapters in-memory/mock).

## Estrutura do monorepo

```text
geduc-rag/
  backend/    ← NestJS + TypeScript + Prisma + MySQL (+ pipeline RAG)
  frontend/   ← Flutter Web + flutter_modular + Dio
  infra/      ← docker-compose do MySQL de desenvolvimento
  .claude/    ← agents, hooks e configuração
  .docs/      ← PRDs e documentação (inclui a arquitetura do RAG)
```

## Setup rápido

### Banco (dev)

```bash
docker compose -f infra/db/docker-compose.yml up -d   # MySQL 8.4 na 3307
```

### Backend

```bash
cd backend
cp .env.example .env        # DATABASE_URL já aponta para o compose acima
npm install                 # roda `prisma generate` no postinstall
npx prisma migrate deploy   # aplica a migration inicial
npm run db:seed             # permissões, perfis, tenant "geduc" e SUPERADMIN
npm run start:dev           # http://localhost:3000 · Swagger em /docs
```

Login inicial: `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` do `.env`.
A senha é temporária: o 1º acesso exige a troca.

### Frontend

```bash
cd frontend
fvm flutter pub get
fvm flutter run -d chrome   # API em http://localhost:3000 (--dart-define=API_BASE_URL=...)
```

## Testes

```bash
cd backend  && npm test && npm run test:e2e && npx tsc --noEmit && npm run lint
cd frontend && fvm flutter analyze && fvm flutter test
```

## Módulos

| Módulo | Camada | Estado |
|---|---|---|
| `auth` | login, troca de senha, `/auth/me` | ✅ |
| `users` | cadastro com perfis e tenants (1º módulo) | ✅ back + front |
| `profiles` / `tenants` | apoio ao cadastro de usuários (API) | ✅ API · tela pendente |
| `documents` · `ingestion` · `embedding` · `retrieval` · `generation` · `chat` | pipeline RAG (herdado do rag-api) | ✅ API com adapters in-memory/mock · tela pendente |

Detalhes e próximos passos em `.docs/prd/modulo-users.md` e
`.docs/rag-architecture.md`.
