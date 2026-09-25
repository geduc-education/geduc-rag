# Assistente RAG — backend (`rag-api`) + frontend (`geduc_lotacao`)

> **Nota (geduc-rag):** documento herdado do `rag-api`. No monorepo, o que
> mudou: a autenticação é **própria** (`common/guards/jwt-auth.guard.ts`, login em
> `modules/auth`) em vez de validar o JWT do geduc-api; o `tenant-id` é validado
> contra o vínculo `UserTenant` pelo `TenantGuard` (`@TenantScoped()`/`@TenantId()`
> em `common/tenancy/`), substituindo o `tenancyMiddleware`; env validada por
> `config/env.validation.ts` (class-validator) no lugar da config Joi; erros pelo
> `AllExceptionsFilter` do geduc-suporte (`{ statusCode, message, code? }`).
> O restante (estrutura dos módulos RAG, fronteiras, providers) segue valendo.

> Documenta as duas pontas da feature: a API de RAG (`rag-api`, projeto separado em
> `~/source/rag-api`) e o módulo `rag_assistant` do app Flutter `geduc_lotacao`
> (`~/source/geduc_lotacao`) que a consome. Detalhe arquitetural completo do backend em
> [architecture.md](architecture.md); regras invioláveis em [../CLAUDE.md](../CLAUDE.md).

## Visão geral

Assistente de pergunta-e-resposta sobre documentos enviados pelo usuário (RAG —
Retrieval-Augmented Generation). Fluxo ponta a ponta:

```text
geduc_lotacao (upload)              rag-api (ingestão, assíncrona)
  tela Documentos  ────POST /documents───▶  chunking → embedding → vector store
                                                       (in-memory, ver "Estado atual")

geduc_lotacao (pergunta)            rag-api (consulta, síncrona)
  tela Chat  ────POST /chat/query───▶  embedding da pergunta → busca vetorial (por tenant)
                                       → prompt com contexto → LLM → resposta + citações
             ◀──────────────────────  { conversationId, answer, citations }
```

## Backend — `rag-api`

Projeto NestJS + TypeScript, Clean Architecture, monolito modular. Roda em
`~/source/rag-api`, porta padrão `8002` (`PORT` no `.env`).

### Endpoints consumidos pelo front

Todos exigem `Authorization: Bearer <jwt>` (mesmo JWT emitido pela API de auth do
ecossistema GEDUC — a `rag-api` só valida) e `tenant-id: <id>`.

| Rota | Body | Resposta | Observação |
|---|---|---|---|
| `POST /documents` | `{ filename, content }` | `202 { documentId, status: "pending" }` | Cria o documento e enfileira a ingestão; **não bloqueia** esperando o processamento |
| `GET /documents/:id/status` | — | `200 { documentId, status }` | `status`: `pending` \| `processing` \| `ready` \| `failed` |
| `POST /chat/query` | `{ question, conversationId? }` | `200 { conversationId, answer, citations }` | `citations`: `[{ documentId, chunkId, excerpt }]`; sem `conversationId` abre um novo turno |

Erros seguem o formato do `AllExceptionFilter`: `{ statusCode, timestamp, path, errorId, error: { message } }`.

### Estado atual (sem banco de dados / vector store / provider real ainda)

Ver a tabela completa em [../CLAUDE.md](../CLAUDE.md#estado-atual-sem-banco-de-dados--vector-store--provider-real-ainda).
Resumo relevante para quem consome pelo front:

- **Sem listagem de documentos** — só existe criar (`POST /documents`) e consultar status
  por id (`GET /documents/:id/status`). O front compensa mantendo a lista localmente
  (ver seção do frontend abaixo).
- **Sem parsing de PDF/DOCX** — `content` é texto puro. O front só aceita colar texto ou
  anexar `.txt`/`.md`.
- **Sem RBAC por papel** — o `JwtAuthGuard` só valida assinatura/expiração do token; não
  há checagem de papel ainda. Por isso o item de menu/rota no front não restringe `roles`.
- Embedding/LLM/vector store são mocks in-memory — respostas são determinísticas mas não
  vêm de um LLM real.

### Rodando localmente

```bash
cd ~/source/rag-api
npm install
cp .env.example .env   # preencha ao menos JWT_SECRET
npm run start:dev      # porta 8002
```

## Frontend — módulo `rag_assistant` (`geduc_lotacao`)

Segue os padrões de [CLAUDE.md do geduc_lotacao](../../geduc_lotacao/CLAUDE.md): Signals
(`signals_flutter`), DI por GetIt, rotas GoRouter, erros por `Either<String, T>`.

### Onde fica

| Peça | Arquivo |
|---|---|
| Client HTTP (base URL própria) | `lib/core/rest_client/rag_rest_client.dart` |
| Models | `lib/core/models/rag_assistant/` (`rag_chat_message_model.dart`, `rag_citation_model.dart`, `rag_document_model.dart`) |
| DTOs de request | `lib/core/dtos/send_rag_message_dto.dart`, `upload_rag_document_dto.dart` |
| Repositórios | `lib/core/repositories/rag_assistant/` (`i_rag_chat_repository.dart` + impl, `i_rag_document_repository.dart` + impl) |
| Controllers | `lib/modules/rag_assistant/controllers/` (`rag_chat_controller.dart`, `rag_documents_controller.dart`) |
| Telas | `lib/modules/rag_assistant/pages/chat/`, `.../pages/documents/` |
| Módulo (DI + rotas) | `lib/modules/rag_assistant/rag_assistant_module.dart`, `rag_assistant_routes.dart`, `routes/routes.dart` |

### Por que um client HTTP separado

`rag-api` é um serviço distinto do `geduc-api` (`BASE_URL`), com host próprio
(`RAG_API_BASE_URL`, `.env`, default local `http://localhost:8002`). `RagRestClient`
reaproveita `TenantInterceptor`/`AuthInterceptor` já existentes — a `rag-api` foi desenhada
para aceitar os mesmos headers (`tenant-id`, `Authorization: Bearer`) que o app já envia.

### Telas

- **`/assistant` (Chat)** — `RagChatPage`. Bolhas de mensagem (`RagChatBubble`), citações
  dos chunks recuperados como chips com tooltip do trecho original, campo de pergunta
  (`RagChatInputBar`) desabilitado durante o envio. "Nova conversa" zera `conversationId`
  e o histórico local.
- **`/assistant/documents` (Documentos)** — `RagDocumentsPage`. Upload via diálogo
  (`RagDocumentUploadDialog`: nome + conteúdo colado ou anexo `.txt`/`.md`), lista com
  badge de status (`RagDocumentListItem`) e polling automático (`RagDocumentsController`)
  a cada 3s por até 10 tentativas após o upload, com botão de atualização manual.

### Registro (para quem for tocar em módulo novo parecido)

- DI: `RagAssistantModule.exportedBinds()` chamado em `lib/core/di/app_di.dart`;
  repositórios registrados em `lib/core/di/global_di.dart`.
- Rotas: `RagAssistantModule.routes` incluído no branch principal em
  `lib/core/routes/routes.dart`.
- Menu: item "Assistente IA" (id `70`, ícone `message-square.svg`) adicionado nas listas
  `main` e `alpha` de `lib/core/models/menu/menu_json_service.dart`, sem restrição de
  `roles` (reflete a ausência de RBAC no backend, ver acima).

### Limitação conhecida

A tela de Documentos só mostra o que foi enviado **na sessão atual** do navegador —
reflete a ausência de endpoint de listagem na `rag-api` (ver "Estado atual" acima), não é
um bug do front.

## Roadmap (destrava quando a infra real existir)

| Troca | Onde |
|---|---|
| Banco relacional real | `rag-api`: repositórios `InMemory*Repository` → repositório com conexão real |
| Vector store real (pgvector/Pinecone/Qdrant) | `rag-api`: `InMemoryVectorStoreClient` |
| Provider de embedding/LLM real | `rag-api`: gateways mock em `embedding`/`generation` |
| RBAC por papel | `rag-api`: `JwtAuthGuard` (checagem de papel) + front: `roles` na rota/menu do `rag_assistant` |
| Listagem de documentos no backend | `rag-api`: novo endpoint `GET /documents` + front: `RagDocumentsController` passa a buscar do servidor em vez de manter lista local |
