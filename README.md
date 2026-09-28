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

### Ollama e embeddings locais

Por padrão o `.env.example` já sugere os providers reais:
`EMBEDDING_PROVIDER=local` (modelo `Xenova/multilingual-e5-small`, via
transformers.js) e `LLM_PROVIDER=ollama` (`qwen2.5:7b`, via
[Ollama](https://ollama.com) local). `mock` continua disponível para
testes/CI (é o default do código quando a env não é setada).

```bash
curl -fsSL https://ollama.com/install.sh | sh   # instala o Ollama (Ubuntu)
ollama pull qwen2.5:7b                          # baixa o modelo
```

Passo a passo completo (systemd, GPU, teste da API, observações de
hardware) em [`.docs/ollama-setup.md`](.docs/ollama-setup.md).

### Smoke ponta a ponta

`backend/scripts/smoke-rag.sh` (requer `curl` e `jq`) prova o assistente
contra os serviços reais: faz login, sobe `backend/scripts/fixtures/smoke-doc.md`
via multipart, espera o status `ready` (timeout de 180 s), pergunta em
`POST /chat/query` algo que só o documento responde e exclui o documento no
final. Com o backend em `LLM_PROVIDER=ollama`, `EMBEDDING_PROVIDER=local` e
`RAG_STORAGE=mysql`:

```bash
API_URL=http://localhost:3000 SMOKE_EMAIL=<email> SMOKE_PASSWORD=<senha> \
SMOKE_TENANT_ID=<tenant-id> bash backend/scripts/smoke-rag.sh; echo "exit=$?"
```

O usuário precisa de `document:manage` e `chat:query` e de vínculo com o
tenant. O script não lê o `.env`. No sucesso, imprime a resposta e
`SMOKE PASS filename=smoke-doc.md` (exit 0); em falha, imprime
`SMOKE FAIL: <etapa>` (`config`, `login`, `upload`, `status`, `chat` ou
`delete`) com o HTTP e a mensagem da API (exit 1). Um exemplo é o Ollama
parado, que resulta em `SMOKE FAIL: chat` com o 502 `Ollama indisponível`.
Na primeira execução, a ingestão baixa o modelo de embedding, o que exige
rede. Opcionais: `SMOKE_TIMEOUT_S`, `SMOKE_CHAT_TIMEOUT_S` e `SMOKE_QUESTION`.

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
| `documents` · `ingestion` · `embedding` · `retrieval` · `generation` · `chat` | pipeline RAG (herdado do rag-api) | ✅ back + front · MySQL, embedding local e Ollama |

Detalhes e próximos passos em `.docs/prd/modulo-users.md`,
`.docs/rag-architecture.md` e `.docs/rag-assistant-feature.md`.
