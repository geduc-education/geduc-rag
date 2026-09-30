# Assistente RAG — feature `rag_assistant`

> Documenta as duas pontas da feature no monorepo `geduc-rag`: a API de RAG
> (backend, módulos `documents` → `ingestion` → `embedding` → `retrieval` →
> `generation` → `chat`) e o módulo Flutter `rag_assistant`
> (`frontend/lib/modules/rag_assistant/`) que a consome. Detalhe arquitetural
> completo do backend em [rag-architecture.md](rag-architecture.md); regras
> invioláveis em [../.claude/CLAUDE.md](../.claude/CLAUDE.md) e
> [../backend/CLAUDE.md](../backend/CLAUDE.md).

## Visão geral

Assistente de pergunta-e-resposta sobre documentos enviados pelo usuário (RAG —
Retrieval-Augmented Generation), por tenant. Fluxo ponta a ponta:

```text
frontend (upload)                   backend (ingestão, assíncrona)
  tela Documentos  ──POST /documents (multipart)──▶  extração de texto → chunking
                                                       → embedding → grava no MySQL
                                                       (document_chunk.embedding)

frontend (pergunta)                 backend (consulta, síncrona)
  tela Chat  ────POST /chat/query───▶  embedding da pergunta → busca vetorial (por tenant)
                                       → prompt com contexto → LLM → resposta + citações
             ◀──────────────────────  { conversationId, answer, citations }
```

## Backend

Módulos NestJS em Clean Architecture (`backend/src/modules/{documents,ingestion,
embedding,retrieval,generation,chat}`), persistência via mysql2 (SQL parametrizado)/MySQL
(`RAG_STORAGE=mysql`, default) ou adapters in-memory (`RAG_STORAGE=memory`,
usado no e2e e em dev sem banco). Providers reais: `EMBEDDING_PROVIDER=local`
(transformers.js, `Xenova/multilingual-e5-small`) e `LLM_PROVIDER=ollama`
(Ollama local, `qwen2.5:7b` — ver [ollama-setup.md](ollama-setup.md)); `mock`
continua disponível para testes/CI. Todas as rotas exigem
`Authorization: Bearer <jwt>` e `tenant-id: <id>` (`@TenantScoped()`).

### Endpoints consumidos pelo front

| Rota | Body/Query | Resposta | Observação |
|---|---|---|---|
| `POST /documents` | `multipart/form-data`, campo `file` | `202 { documentId, status: "pending" }` | Cria o documento (extrai texto na hora) e enfileira a ingestão (chunking + embedding); **não bloqueia** esperando o processamento |
| `GET /documents?page&limit` | query | `200 { data: DocumentSummary[], total }` | Listagem paginada por tenant, com `status` de cada documento |
| `GET /documents/:id/status` | — | `200 { documentId, status }` | `status`: `pending` \| `processing` \| `ready` \| `failed` |
| `DELETE /documents/:id` | — | `204` | Remove o documento (e os chunks, via `onDelete: Cascade`); 404 fora do tenant |
| `POST /chat/query` | `{ question, conversationId? }` | `200 { conversationId, answer, citations }` | `citations`: `[{ documentId, chunkId, filename, excerpt }]`; sem `conversationId` abre um novo turno; conversa pertence a (tenant, usuário) |

Erros seguem o formato do `AllExceptionsFilter` (`common/filters/`):
`{ statusCode, message, code? }`.

## Frontend — módulo `rag_assistant`

Segue os padrões de `frontend/CLAUDE.md`: `flutter_modular` (DI por
`Bind`/`Module`), `Dio` via `ApiClient`, rotas próprias do módulo.

### Onde fica

| Peça | Arquivo |
|---|---|
| Repositórios (interface + HTTP) | `lib/modules/rag_assistant/data/{rag_documents_repository,rag_chat_repository}.dart` |
| Modelos | `lib/modules/rag_assistant/data/models/{rag_document,chat_answer}.dart` |
| Controllers | `lib/modules/rag_assistant/presentation/{documents/documents_controller,chat/chat_controller}.dart` |
| Telas | `lib/modules/rag_assistant/presentation/{documents/documents_page,chat/chat_page}.dart` |
| Módulo (DI + rotas) | `lib/modules/rag_assistant/rag_assistant_module.dart`, `presentation/{documents,chat}/*_binds.dart` |

### Telas

- **Chat** — `ChatPage`/`ChatController`. Bolhas de mensagem, citações dos
  chunks recuperados (com `filename`), campo de pergunta desabilitado durante
  o envio. "Nova conversa" zera `conversationId` e o histórico local. A
  conversa é descartada ao trocar de tenant ativo ou fazer logout.
- **Documentos** — `DocumentsPage`/`DocumentsController`. Upload via
  `file_picker` (multipart), lista paginada com badge de status, exclusão com
  confirmação e polling automático enquanto houver documento `pending`/
  `processing`.

### Registro

- DI: `registerRagAssistantBinds` (`rag_assistant_module.dart`) registra os
  repositórios; cada tela registra o próprio controller em
  `presentation/{documents,chat}/*_binds.dart`.
- Rotas: módulo incluído nas rotas do app (`NavGroup.assistente`).

## Versionamento de embedding

Trocar `EMBEDDING_PROVIDER`/`EMBEDDING_MODEL` (ou só a dimensão) deixa os
vetores antigos incompatíveis com os novos. `document_chunk.embeddingModel` e
`Document.embeddingModel`/`embeddingVersion` guardam a origem de cada vetor;
reenvie os documentos existentes ao trocar de provider ou de modelo.
