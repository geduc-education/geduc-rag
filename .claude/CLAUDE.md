# CLAUDE.md — GEDUC RAG

Plataforma de RAG multi-tenant: documentos por tenant → chunking → embeddings →
vector store; assistente que responde com citações. Identidade própria (login
e-mail/senha), RBAC N:N (`User` ↔ `Profile` ↔ `Permission`) e vínculo N:N
usuário ↔ tenant.

Stack: **Backend** NestJS 11 + TypeScript + Prisma 7 + MySQL ·
**Frontend** Flutter Web (FVM) + flutter_modular + Dio.

## Estrutura do monorepo

```text
geduc-rag/
  backend/    ← NestJS + TypeScript + Prisma + MySQL (+ pipeline RAG)
  frontend/   ← Flutter Web + flutter_modular + Dio
  infra/      ← MySQL de dev
  .claude/    ← agents, hooks e configuração
  .docs/      ← PRDs e documentação do produto
```

> Contexto detalhado por ambiente: `backend/CLAUDE.md` e `frontend/CLAUDE.md`.
> Arquitetura do pipeline RAG: `.docs/rag-architecture.md`.

## Origem

- Padrão de monorepo, auth, RBAC, `common/`, frontend e `.claude/` vêm do
  **geduc-suporte**.
- O pipeline RAG (módulos `documents`…`chat`, `@core/infra`) vem do
  **rag-api**, com a Clean Architecture dele preservada. O `JwtAuthGuard`
  externo, o middleware de tenancy e a config Joi do rag-api foram
  substituídos pelos equivalentes do geduc-suporte (`common/`).

## Modelo de domínio (resumo)

- **Permissão efetiva = união** das permissões dos perfis ativos. Perfis são
  globais da plataforma. SUPERADMIN (`isSuperAdmin`, criado pelo seed) tem
  bypass de permissão e de tenant e não pode ser inativado/excluído.
- **Tenant** escopa todo dado do RAG. `UserTenant` é o que libera o header
  `tenant-id` nas rotas `@TenantScoped()` (`TenantGuard`). Tenant inexistente,
  inativo ou sem vínculo respondem o mesmo 403 `TENANT_OUT_OF_SCOPE`.
- **Alcance no cadastro**: o ator só vê/opera usuários com quem compartilha
  tenant; só vincula tenants do próprio alcance; só atribui perfis cujas
  permissões ele tem ("ninguém concede o que não tem").

## Segurança e salvaguardas

- **Nunca** rode comandos destrutivos de banco (`migrate reset`, `db push
  --force-reset`, `DROP`, `TRUNCATE`, `DELETE` sem `WHERE`) sem confirmação. O
  hook `protect-db.sh` bloqueia/pede confirmação — não contorne.
- Antes de migration/seed, confirme `DATABASE_URL` em `localhost`. Após mudar
  `schema.prisma`, sempre `npx prisma generate`.
- **Nunca** leia/imprima/comite segredos (`.env`, chaves). Config vai para
  `.env.example` com placeholders.
- O seed tem guard `NODE_ENV=production` — não remova.
- Push, criação de remote e ações externas: só com pedido explícito.

## Hooks

| Hook | Evento | O que faz |
|---|---|---|
| `protect-db.sh` | `PreToolUse` (Bash) | Nega `DELETE` sem `WHERE`; destrutivos viram confirmação manual. |
| `protect-migrations.sh` | `PreToolUse` (Edit\|Write) | Edição em `backend/prisma/migrations/**` pede confirmação. |
| `format-file.sh` | `PostToolUse` (Edit\|Write) | `eslint --fix` (backend `.ts`) / `fvm dart format` (frontend `.dart`). |
| `check-complexity.sh` | `Stop` | Complexidade ciclomática dos arquivos alterados; bloqueia acima do limite. |

## Agentes

`.claude/agents/`: `nest-backend`, `flutter-dev`, `explorer`, `reviewer`.
Planos e tasks em `.claude/tasks/`.

## Idioma

Comunicação, comentários, docs e reviews de PR em **pt-BR** com acentuação
correta. Nomes de arquivos e símbolos no original (inglês).
