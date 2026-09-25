# Tasks

| ID | Camada | Descrição | Dependências | Paralelizável | Complexidade | Agente | Status |
|---|---|---|---|---|---|---|---|
| T-01 | database | Schema Prisma (Document, DocumentChunk, Conversation, ConversationMessage) e migration rag_persistence | — | sim | média | Darwin | [x] |
| T-02 | backend | Dependências, envs de providers/storage/upload e códigos de erro | — | sim | média | Levi | [x] |
| T-03 | backend | Contratos do pipeline: EmbeddingKind, VectorStoreClient assíncrono, filename em chunk/busca/citação | — | sim | alta | Platão | [x] |
| T-04 | backend | Domínio de documentos (mimeType, tamanho, falha, list/delete) e contrato HTTP de documentos | — | sim | média | Athena | [x] |
| T-05 | backend | Domínio do chat com conversa por usuário e contrato HTTP do chat | — | sim | média | Jaspion | [x] |
| T-06 | frontend | Base do módulo rag_assistant: deps, ApiClient.upload, menu, rotas protegidas e stubs | — | sim | média | Aang | [x] |
| T-07 | backend | Vector store Prisma com BLOB Float32 e cosseno filtrado por tenant | T-01, T-02, T-03 | sim | alta | Platão | [ ] |
| T-08 | backend | Repositório Prisma de documentos e motivo de falha na ingestão | T-01, T-02, T-03, T-04 | sim | média | Darwin | [ ] |
| T-09 | backend | Extração de texto de .md/.txt/.pdf/.docx | T-02 | sim | média | Athena | [ ] |
| T-10 | backend | Repositório Prisma de conversas e filename nas citações do chat | T-01, T-02, T-03, T-05 | sim | média | Jaspion | [ ] |
| T-11 | backend | Gateway de embeddings locais com transformers.js | T-02, T-03 | sim | alta | Tesla | [ ] |
| T-12 | backend | Gateway Ollama com timeout e erros como LlmProviderError | T-02 | sim | média | Levi | [ ] |
| T-13 | frontend | Camada de dados do rag_assistant (modelos, repositórios, fakes) | T-04, T-05, T-06 | sim | média | Aang | [ ] |
| T-14 | backend | API de documentos: upload multipart, listagem paginada, exclusão e e2e | T-02, T-03, T-04, T-07, T-08, T-09, T-10 | sim | alta | Darwin | [ ] |
| T-15 | frontend | Tela Documentos (upload, lista com status, polling, excluir) | T-06, T-13 | sim | média | Aang | [ ] |
| T-16 | frontend | Tela Chat (bolhas, citações, nova conversa, loading) | T-06, T-13 | sim | média | Goku | [ ] |
| T-17 | docs | .env.example, README, backend/CLAUDE.md, .docs e guia do Ollama no Ubuntu | T-11, T-12, T-14, T-15, T-16 | não | simples | Gandalf | [ ] |
| T-18 | qa | Script de smoke ponta a ponta com Ollama e embeddings reais | T-14, T-17 | não | simples | Sherlock | [ ] |

## Detalhamento

### T-01 — Schema Prisma e migration rag_persistence

**Camada:** database
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Darwin

**Arquivos prováveis**
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260925000000_rag_persistence/migration.sql`

**Interface**
- Produz: `prisma.document`, `prisma.documentChunk`, `prisma.conversation`, `prisma.conversationMessage`, `enum DocumentStatus { pending processing ready failed }`, `enum MessageRole { user assistant }`, `DocumentChunk.embedding Bytes @db.Blob (Float32 little-endian)`. Colunas: `Document` → `@@map("document")`: id uuid, tenantId FK Tenant Restrict, filename VarChar(255), mimeType VarChar(100), sizeBytes Int, content LongText, status DocumentStatus default pending, errorMessage VarChar(500)?, embeddingModel VarChar(191)?, embeddingVersion VarChar(20)?, createdById FK User SetNull?, createdAt, updatedAt, `@@index([tenantId, createdAt])`; `DocumentChunk` → `@@map("document_chunk")`: id VarChar(191) no formato `<documentId>:<index>`, documentId FK Document Cascade, tenantId, chunkIndex Int, content Text, embedding, dimensions Int, embeddingModel VarChar(191), createdAt, `@@index([tenantId, dimensions])`, `@@index([documentId])`; `Conversation` → `@@map("conversation")`: id uuid, tenantId FK Tenant Restrict, userId FK User Restrict, createdAt, updatedAt, `@@index([tenantId, userId])`; `ConversationMessage` → `@@map("conversation_message")`: id uuid, conversationId FK Conversation Cascade, role MessageRole, content Text, citations Json?, createdAt, `@@index([conversationId, createdAt])`; Colunas em snake_case via `@map`, conforme o schema atual.
- Consome: nada

**Teste RED**
- sem teste: mudança só de schema e migration SQL. A verificação é por `prisma validate`, `migrate status` e contagem de registros.

**Critério de aceite**
- `npx prisma validate` imprime `is valid`.
- Depois de `npx prisma migrate deploy`, `npx prisma migrate status` imprime `Database schema is up to date!`.
- `SHOW TABLES` lista `document`, `document_chunk`, `conversation` e `conversation_message`.
- As contagens de `user`, `tenant` e `user_tenant` são iguais antes e depois.

**Validação**
- `(cd backend && npx prisma validate && npx prisma generate)` (evidência: `The schema at prisma/schema.prisma is valid` e `Generated Prisma Client`)
- Antes e depois do deploy: `docker compose -f infra/db/docker-compose.yml exec -T mysql mysql -urag -prag geduc_rag -e "SELECT (SELECT COUNT(*) FROM user) u, (SELECT COUNT(*) FROM tenant) t, (SELECT COUNT(*) FROM user_tenant) ut"` (evidência: a mesma linha `u t ut` nas duas execuções)
- `(cd backend && npx prisma migrate deploy && npx prisma migrate status)` (evidência: `20260925000000_rag_persistence` aplicada e `Database schema is up to date!`)
- `docker compose -f infra/db/docker-compose.yml exec -T mysql mysql -urag -prag geduc_rag -e "SHOW TABLES"` (evidência: as 4 tabelas novas presentes)

### T-02 — Dependências, envs e códigos de erro

**Camada:** backend
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Levi

**Arquivos prováveis**
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/config/env.validation.ts`
- `backend/src/config/__tests__/env.validation.spec.ts`
- `backend/test/setup-e2e.ts`
- `backend/src/common/errors/error-codes.ts`

**Interface**
- Produz: envs em `EnvironmentVariables`: `EMBEDDING_PROVIDER: 'mock' | 'local'` (default `mock`), com `EMBEDDING_MODEL` default `Xenova/multilingual-e5-small` e `EMBEDDING_DIMENSIONS` default `384`; `EMBEDDING_QUERY_PREFIX` (default `query: `), `EMBEDDING_PASSAGE_PREFIX` (default `passage: `) e `EMBEDDING_CACHE_DIR` (opcional); `LLM_PROVIDER: 'mock' | 'ollama'` (default `mock`), `LLM_BASE_URL` (URL, default `http://localhost:11434`), `LLM_MODEL` (default `qwen2.5:7b`) e `LLM_TIMEOUT_MS` (int, default `120000`); `RAG_STORAGE: 'mysql' | 'memory'` (default `mysql`) e `DOCUMENT_MAX_UPLOAD_BYTES` (int, default `10485760`).
- Produz: códigos `ERROR_CODES.ATTACHMENT_TOO_LARGE` (413), `ERROR_CODES.UNSUPPORTED_DOCUMENT_TYPE` (400) e `ERROR_CODES.DOCUMENT_TEXT_EMPTY` (400).
- Produz: dependências `@huggingface/transformers`, `pdf-parse` (v2) e `mammoth`, e em devDependencies `@types/multer`. A descrição do `package.json` passa a dizer MySQL.
- Produz: `setup-e2e.ts` define `RAG_STORAGE=memory`, `EMBEDDING_PROVIDER=mock` e `LLM_PROVIDER=mock`.
- Consome: nada

**Teste RED**
- `backend/src/config/__tests__/env.validation.spec.ts` — `validateEnv` aceita `LLM_PROVIDER=ollama`, `EMBEDDING_PROVIDER=local` e `RAG_STORAGE=memory`, e rejeita `LLM_PROVIDER=openai` e `LLM_BASE_URL=nao-e-url` (comando: `cd backend && npx jest src/config/__tests__/env.validation.spec.ts`)

**Critério de aceite**
- O spec de env passa com os casos novos.
- `npm ls @huggingface/transformers pdf-parse mammoth @types/multer` lista as 4 dependências.
- `error-codes.ts` exporta os 3 códigos novos.
- `npx tsc --noEmit` sai com exit 0.

**Validação**
- `(cd backend && npx jest src/config/__tests__/env.validation.spec.ts)` (evidência: `Tests:` com todos `passed`, incluindo os casos de ollama/local/memory)
- `(cd backend && npm ls @huggingface/transformers pdf-parse mammoth @types/multer)` (evidência: as 4 linhas com versão, sem `missing`)
- `(cd backend && npx tsc --noEmit)` (evidência: exit 0 e nenhuma linha `error TS`)

### T-03 — Contratos do pipeline: EmbeddingKind, VectorStoreClient e filename

**Camada:** backend
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Platão

**Arquivos prováveis**
- `backend/src/@core/infra/vector-store/vector-store.client.ts`
- `backend/src/@core/infra/vector-store/in-memory-vector-store.client.ts`
- `backend/src/modules/embedding/application/interface/gateways/embedding-provider.gateway.interface.ts`
- `backend/src/modules/embedding/infra/gateways/embedding-provider.gateway.ts`
- `backend/src/modules/embedding/application/usecase/embedding/embed-text.usecase.ts`
- `backend/src/modules/embedding/application/usecase/embedding/embed-and-store-chunk.usecase.ts`
- `backend/src/modules/embedding/application/interface/gateways/vector-store.gateway.interface.ts`
- `backend/src/modules/embedding/infra/gateways/vector-store.gateway.ts`
- `backend/src/modules/embedding/embedding.providers.ts`
- `backend/src/modules/embedding/__tests__/embed-and-store-chunk.usecase.spec.ts`
- `backend/src/modules/retrieval/infra/gateways/query-embedding.gateway.ts`
- `backend/src/modules/retrieval/application/interface/gateways/vector-search.gateway.interface.ts`
- `backend/src/modules/retrieval/infra/gateways/vector-store.gateway.ts`
- `backend/src/modules/retrieval/application/query-service/chunk/search-chunks.queryservice.ts`
- `backend/src/modules/retrieval/application/usecase/retrieval/retrieve-context.usecase.ts`
- `backend/src/modules/retrieval/domain/entities/value-objects/citation.vo.ts`
- `backend/src/modules/retrieval/retrieval.providers.ts`
- `backend/src/modules/retrieval/__tests__/retrieve-context.usecase.spec.ts`
- `backend/src/modules/ingestion/application/interface/gateways/embedding-ingest.gateway.interface.ts`
- `backend/src/modules/ingestion/infra/gateways/embedding-ingest.gateway.ts`
- `backend/src/modules/ingestion/application/usecase/ingestion/ingest-document.usecase.ts`
- `backend/src/modules/ingestion/__tests__/ingest-document.usecase.spec.ts`

**Interface**
- Produz: `type EmbeddingKind = 'query' | 'passage'`, `IEmbeddingProviderGateway.embed(text: string, kind: EmbeddingKind): Promise<number[]>` e `EmbedTextUseCase.execute(text: string, kind: EmbeddingKind): Promise<number[]>`. A ingestão embeda `passage`; o `QueryEmbeddingGateway` embeda `query`.
- Produz: interface `VectorStoreClient` em `backend/src/@core/infra/vector-store/vector-store.client.ts` (token `VECTOR_STORE_CLIENT` mantido em `vector-store.module.ts`), com os métodos `upsert(record: VectorStoreRecord): Promise<void>`, `search(tenantId: string, queryVector: number[], topK: number): Promise<VectorStoreSearchResult[]>` e `deleteByDocument(tenantId: string, documentId: string): Promise<void>`.
- Produz: `VectorStoreRecord { chunkId: string; documentId: string; tenantId: string; filename: string; chunkIndex: number; content: string; vector: number[]; embeddingModel: string }`, `VectorStoreSearchResult { record: VectorStoreRecord; score: number }` e `InMemoryVectorStoreClient implements VectorStoreClient`.
- Produz: `EmbedAndStoreChunkInput { chunkId, documentId, tenantId, filename, chunkIndex, content }`, `ChunkSearchResult { chunkId, documentId, filename, content, score }` e `CitationVO { documentId, chunkId, filename, excerpt }`.
- Consome: nada

**Teste RED**
- `backend/src/modules/embedding/__tests__/embed-and-store-chunk.usecase.spec.ts`, `backend/src/modules/retrieval/__tests__/retrieve-context.usecase.spec.ts`, `backend/src/modules/ingestion/__tests__/ingest-document.usecase.spec.ts` — o chunk é embedado com kind `passage` e gravado com filename/chunkIndex/embeddingModel; a pergunta é embedada com kind `query`; a citação traz o `filename` do documento; a ingestão repassa o filename de `getContent` e o índice de cada chunk (comando: `cd backend && npx jest src/modules/embedding src/modules/retrieval src/modules/ingestion`)

**Critério de aceite**
- Os três specs passam com as asserções novas (`embed` chamado com `'passage'`/`'query'`; `citations[0].filename` igual ao filename do chunk).
- `npx tsc --noEmit` sai com exit 0.

**Validação**
- `(cd backend && npx jest src/modules/embedding src/modules/retrieval src/modules/ingestion)` (evidência: `Test Suites:` todos `passed`)
- `(cd backend && npx tsc --noEmit)` (evidência: exit 0, nenhuma linha `error TS`)

### T-04 — Domínio e contrato HTTP de documentos

**Camada:** backend
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Athena

**Arquivos prováveis**
- `backend/src/modules/documents/domain/entities/document.entity.ts`
- `backend/src/modules/documents/application/interface/repository/document.repository.interface.ts`
- `backend/src/modules/documents/infra/database/repositories/in-memory-document.repository.ts`
- `backend/src/modules/documents/application/usecase/document/document-summary.ts`
- `backend/src/modules/documents/__tests__/document.entity.spec.ts`
- `backend/src/modules/documents/__tests__/in-memory-document.repository.spec.ts`

**Interface**
- Produz: `DocumentProps.mimeType?: string` (default `text/plain`), `DocumentProps.sizeBytes?: number` (default: bytes UTF-8 de `content`), `DocumentProps.createdById?: string | null`, `DocumentEntity.errorMessage: string | null` e `markFailed(reason?: string): void`, que grava `errorMessage` truncado em 500 caracteres. `markReady` e `markProcessing` limpam `errorMessage`.
- Produz: `IDocumentRepository.list(tenantId: string, page: number, limit: number): Promise<{ data: DocumentEntity[]; total: number }>`, ordenado por `createdAt` desc, e `IDocumentRepository.delete(tenantId: string, documentId: string): Promise<boolean>`, que devolve `false` se o documento não existe no tenant.
- Produz: `DocumentSummary { documentId: string; filename: string; mimeType: string; sizeBytes: number; status: DocumentStatus; errorMessage: string | null; createdAt: string }` e `toDocumentSummary(entity: DocumentEntity): DocumentSummary` (`createdAt` em ISO 8601).
- Produz: contrato HTTP: `GET /documents?page=1&limit=20 → 200 { data: DocumentSummary[]; total: number }`; `POST /documents multipart/form-data campo file → 202 { documentId: string; status: 'pending' }`; `DELETE /documents/:id → 204`; `GET /documents/:id/status` mantido.
- Consome: nada

**Teste RED**
- `backend/src/modules/documents/__tests__/document.entity.spec.ts`, `backend/src/modules/documents/__tests__/in-memory-document.repository.spec.ts` — `markFailed('x')` grava `errorMessage = 'x'` e `markReady` o limpa; `list` do tenant A não devolve documentos do tenant B e pagina com `total`; `delete` de id de outro tenant devolve `false` (comando: `cd backend && npx jest src/modules/documents`)

**Critério de aceite**
- Os specs de documents passam.
- `list('A', 2, 1)` devolve 1 item e `total` igual ao número de documentos do tenant A.
- `delete('B', idDeA)` devolve `false` e o documento de A continua em `findById`.
- `npx tsc --noEmit` sai com exit 0.

**Validação**
- `(cd backend && npx jest src/modules/documents)` (evidência: `Test Suites:` todos `passed`)
- `(cd backend && npx tsc --noEmit)` (evidência: exit 0)

### T-05 — Domínio do chat com conversa por usuário e contrato HTTP

**Camada:** backend
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Jaspion

**Arquivos prováveis**
- `backend/src/modules/chat/domain/entities/conversation.entity.ts`
- `backend/src/modules/chat/application/interface/repository/conversation.repository.interface.ts`
- `backend/src/modules/chat/infra/database/repositories/in-memory-conversation.repository.ts`
- `backend/src/modules/chat/application/usecase/chat/send-message.usecase.ts`
- `backend/src/modules/chat/controllers/chat.controller.ts`
- `backend/src/modules/chat/controllers/dtos/chat-query-response.dto.ts`
- `backend/src/modules/chat/__tests__/conversation.entity.spec.ts`
- `backend/src/modules/chat/__tests__/send-message.usecase.spec.ts`

**Interface**
- Produz: `ConversationProps.userId: string`, `IConversationRepository.findById(tenantId: string, userId: string, conversationId: string): Promise<ConversationEntity | null>` e `SendMessageInput { tenantId: string; userId: string; conversationId?: string; question: string }`. Com `conversationId` informado e não encontrado para (tenant, usuário), o use case lança `NotFound` (404) e não chama retrieval nem geração.
- Produz: `ChatQueryResponseDto` (Swagger) e o contrato HTTP `POST /chat/query { question: string; conversationId?: string } → 200 { conversationId: string; answer: string; citations: { documentId: string; chunkId: string; filename: string; excerpt: string }[] }`. O controller lê o usuário com `@CurrentUser('id')`.
- Consome: nada

**Teste RED**
- `backend/src/modules/chat/__tests__/send-message.usecase.spec.ts`, `backend/src/modules/chat/__tests__/conversation.entity.spec.ts` — `conversationId` existente de outro usuário faz o use case rejeitar com `NotFound` sem chamar `retrievalContextGateway.retrieve`; uma conversa nova é criada com o `userId` do input; `findById` é chamado com (tenantId, userId, conversationId) (comando: `cd backend && npx jest src/modules/chat`)

**Critério de aceite**
- Os specs de chat passam.
- O caso de conversa alheia termina em `NotFound`, com `retrieve` e `generate` chamados 0 vezes.
- `npx tsc --noEmit` sai com exit 0.

**Validação**
- `(cd backend && npx jest src/modules/chat)` (evidência: `Test Suites:` todos `passed`, incluindo o caso de conversa alheia → NotFound)
- `(cd backend && npx tsc --noEmit)` (evidência: exit 0)

### T-06 — Base do módulo Flutter rag_assistant

**Camada:** frontend
**Dependências:** nenhuma
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Aang

**Arquivos prováveis**
- `frontend/pubspec.yaml`
- `frontend/pubspec.lock`
- `frontend/lib/core/http/api_client.dart`
- `frontend/lib/core/routing/nav_destinations.dart`
- `frontend/lib/modules/home/home_module.dart`
- `frontend/lib/modules/rag_assistant/rag_assistant_module.dart`
- `frontend/lib/modules/rag_assistant/presentation/rag_view_state.dart`
- `frontend/lib/modules/rag_assistant/presentation/documents/documents_binds.dart`
- `frontend/lib/modules/rag_assistant/presentation/documents/documents_page.dart`
- `frontend/lib/modules/rag_assistant/presentation/chat/chat_binds.dart`
- `frontend/lib/modules/rag_assistant/presentation/chat/chat_page.dart`
- `frontend/test/rag_assistant/rag_navigation_test.dart`

**Interface**
- Produz: `Future<Response<T>> upload<T>(String path, FormData data)` em `ApiClient`, que envia multipart e passa pelo mesmo `_guard`, com Authorization e `tenant-id`.
- Produz: `NavGroup.assistente` (rótulo `Assistente`), com os destinos `Documentos` → `/home/rag/documents` (`AppPermissions.documentRead`) e `Assistente` → `/home/rag/chat` (`AppPermissions.chatQuery`).
- Produz: `void registerRagAssistantBinds(ModularContext c)` e `void registerRagAssistantRoutes(ModularContext r)`, com as rotas `/rag/documents` e `/rag/chat` protegidas por `permissionGuard(..., redirectTo: '/home/dashboard')`; `void registerRagDocumentsBinds(ModularContext c)` e `void registerRagChatBinds(ModularContext c)` (stubs vazios); `enum RagViewState { loading, ready, empty, error }`.
- Produz: dependências `file_picker` e, em dev_dependencies, `fake_async`.
- Consome: nada

**Teste RED**
- `frontend/test/rag_assistant/rag_navigation_test.dart` — `HomeShellController.visibleDestinations` com só `document:read` inclui `Documentos` e não `Assistente`; com `chat:query` inclui `Assistente`; sem nenhuma das duas, nenhum destino do grupo `assistente` aparece (comando: `cd frontend && fvm flutter test test/rag_assistant/rag_navigation_test.dart`)

**Critério de aceite**
- O teste de navegação passa.
- `fvm flutter analyze` imprime `No issues found!`.
- `pubspec.lock` contém `file_picker` e `fake_async`.

**Validação**
- `(cd frontend && fvm flutter test test/rag_assistant/rag_navigation_test.dart)` (evidência: `All tests passed!`)
- `(cd frontend && fvm flutter analyze)` (evidência: `No issues found!`)
- `grep -E "^  (file_picker|fake_async):" frontend/pubspec.lock` (evidência: as duas linhas)

### T-07 — Vector store Prisma com cosseno filtrado por tenant

**Camada:** backend
**Dependências:** T-01, T-02, T-03
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Platão

**Arquivos prováveis**
- `backend/src/@core/infra/vector-store/prisma-vector-store.client.ts`
- `backend/src/@core/infra/vector-store/float32-codec.ts`
- `backend/src/@core/infra/vector-store/vector-store.module.ts`
- `backend/src/@core/infra/vector-store/__tests__/prisma-vector-store.client.spec.ts`

**Interface**
- Produz: `PrismaVectorStoreClient implements VectorStoreClient`, `encodeFloat32(vector: number[]): Uint8Array` e `decodeFloat32(bytes: Uint8Array): number[]`; `search` busca só `document_chunk` com `tenantId` igual ao argumento e `document.status = ready`, com `include` do `document.filename`. Descarta chunks com `dimensions !== queryVector.length`, ordena por cosseno desc e corta em `topK`; `upsert` grava `dimensions = vector.length`; `deleteByDocument` apaga por (tenantId, documentId); Erro do Prisma vira `VectorStoreError` (502).
- Produz: `VectorStoreModule` provê `VECTOR_STORE_CLIENT` com `InMemoryVectorStoreClient` quando `RAG_STORAGE=memory` e com `PrismaVectorStoreClient` nos demais casos.
- Consome: T-01 `prisma.documentChunk`, T-02 `RAG_STORAGE: 'mysql' | 'memory'`, T-03 `VectorStoreClient`, T-03 `deleteByDocument(tenantId: string, documentId: string): Promise<void>`

**Teste RED**
- `backend/src/@core/infra/vector-store/__tests__/prisma-vector-store.client.spec.ts` — `decodeFloat32(encodeFloat32(v))` devolve `v` com precisão float32; `search` passa `where.tenantId` ao Prisma e ordena por cosseno; um chunk de dimensão diferente é ignorado sem `NaN`; `deleteByDocument` filtra por tenantId e documentId (comando: `cd backend && npx jest src/@core/infra/vector-store`)

**Critério de aceite**
- O spec passa.
- O `where` capturado do mock de `documentChunk.findMany` contém `tenantId` e `document: { status: 'ready' }`.
- Com dois chunks de 384 dims e um de 3 dims, `search` devolve só os de 384, com `score` finito.

**Validação**
- `(cd backend && npx jest src/@core/infra/vector-store)` (evidência: `Tests:` todos `passed`, incluindo "ignora dimensão diferente")
- `(cd backend && npx tsc --noEmit)` (evidência: exit 0)

### T-08 — Repositório Prisma de documentos e motivo de falha

**Camada:** backend
**Dependências:** T-01, T-02, T-03, T-04
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Darwin

**Arquivos prováveis**
- `backend/src/modules/documents/infra/database/repositories/prisma-document.repository.ts`
- `backend/src/modules/documents/documents.providers.ts`
- `backend/src/modules/documents/application/usecase/document/update-document-status.usecase.ts`
- `backend/src/modules/ingestion/application/interface/gateways/document-status.gateway.interface.ts`
- `backend/src/modules/ingestion/infra/gateways/document-status.gateway.ts`
- `backend/src/modules/ingestion/application/usecase/ingestion/ingest-document.usecase.ts`
- `backend/src/modules/documents/__tests__/prisma-document.repository.spec.ts`
- `backend/src/modules/ingestion/__tests__/ingest-document.usecase.spec.ts`

**Interface**
- Produz: `PrismaDocumentRepository implements IDocumentRepository`. Toda query leva `tenantId` no `where`; `list` usa `$transaction([findMany, count])`; `delete` usa `deleteMany({ where: { id, tenantId } })` e devolve `count > 0`.
- Produz: `DOCUMENTS_PROVIDERS.REPOSITORY.DOCUMENT_REPOSITORY` seleciona por `RAG_STORAGE`, com `useFactory` sobre `ConfigService` e `PrismaService`.
- Produz: `IDocumentStatusGateway.markFailed(tenantId: string, documentId: string, reason?: string): Promise<void>` e `UpdateDocumentStatusInput.reason?: string`. A ingestão passa `error.message` como `reason`; se o `markFailed` falhar (documento excluído no meio), a ingestão loga e rejeita com o erro original, não com o `NotFound`.
- Consome: T-01 `prisma.document`, T-02 `RAG_STORAGE: 'mysql' | 'memory'`, T-04 `IDocumentRepository.list(tenantId: string, page: number, limit: number)`, T-04 `markFailed(reason?: string): void`

**Teste RED**
- `backend/src/modules/documents/__tests__/prisma-document.repository.spec.ts`, `backend/src/modules/ingestion/__tests__/ingest-document.usecase.spec.ts` — o repositório mapeia a linha Prisma para `DocumentEntity` e filtra `findById`/`list`/`delete` por `tenantId`; a ingestão que falha no embedding chama `markFailed` com o `reason` da mensagem; quando `markFailed` rejeita com `NotFound`, `execute` rejeita com o erro original do embedding (comando: `cd backend && npx jest src/modules/documents/__tests__/prisma-document.repository.spec.ts src/modules/ingestion`)

**Critério de aceite**
- Os specs passam.
- O `where` de todas as chamadas ao mock do Prisma contém `tenantId`.
- No caso do documento excluído durante `processing`, a promise rejeita com a mensagem do erro de embedding.

**Validação**
- `(cd backend && npx jest src/modules/documents/__tests__/prisma-document.repository.spec.ts src/modules/ingestion)` (evidência: `Tests:` todos `passed`, incluindo "documento excluído durante processing")
- `(cd backend && npx tsc --noEmit)` (evidência: exit 0)

### T-09 — Extração de texto de .md/.txt/.pdf/.docx

**Camada:** backend
**Dependências:** T-02
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Athena

**Arquivos prováveis**
- `backend/src/modules/documents/application/interface/gateways/text-extractor.gateway.interface.ts`
- `backend/src/modules/documents/infra/gateways/text-extractor.gateway.ts`
- `backend/src/modules/documents/__tests__/text-extractor.gateway.spec.ts`
- `backend/src/modules/documents/__tests__/fixtures/sample.pdf`
- `backend/src/modules/documents/__tests__/fixtures/sample.docx`

**Interface**
- Produz: token `'ITextExtractorGateway'`, `ITextExtractorGateway.extract(input: ExtractTextInput): Promise<string>`, `ExtractTextInput { filename: string; mimeType: string; buffer: Buffer }` e `SUPPORTED_DOCUMENT_EXTENSIONS = ['.md', '.txt', '.pdf', '.docx']`; O formato é decidido pela extensão (case-insensitive): .md/.txt como UTF-8 (sem BOM), .pdf via `pdf-parse` e .docx via `mammoth.extractRawText`; Extensão fora da lista → `BadRequestException` com `code: ERROR_CODES.UNSUPPORTED_DOCUMENT_TYPE`; texto vazio depois de `trim` → `code: ERROR_CODES.DOCUMENT_TEXT_EMPTY`.
- Consome: T-02 `ERROR_CODES.UNSUPPORTED_DOCUMENT_TYPE`, T-02 `ERROR_CODES.DOCUMENT_TEXT_EMPTY`

**Teste RED**
- `backend/src/modules/documents/__tests__/text-extractor.gateway.spec.ts`, `backend/src/modules/documents/__tests__/fixtures/sample.pdf`, `backend/src/modules/documents/__tests__/fixtures/sample.docx` — extrai o texto conhecido das fixtures .pdf e .docx e de buffers .md/.txt com acentuação; `.exe` rejeita com `UNSUPPORTED_DOCUMENT_TYPE`; .txt só com espaços rejeita com `DOCUMENT_TEXT_EMPTY` (comando: `cd backend && npx jest src/modules/documents/__tests__/text-extractor.gateway.spec.ts`)

**Critério de aceite**
- O spec passa.
- O texto extraído da fixture PDF e da DOCX contém a frase conhecida (ex.: `Regimento escolar de teste`).
- Os dois casos de erro devolvem status 400 com o `code` correspondente em `getResponse()`.

**Validação**
- `(cd backend && npx jest src/modules/documents/__tests__/text-extractor.gateway.spec.ts)` (evidência: `Tests:` todos `passed`, com 4 formatos e 2 erros)
- `(cd backend && npx tsc --noEmit)` (evidência: exit 0)

### T-10 — Repositório Prisma de conversas e filename nas citações

**Camada:** backend
**Dependências:** T-01, T-02, T-03, T-05
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Jaspion

**Arquivos prováveis**
- `backend/src/modules/chat/infra/database/repositories/prisma-conversation.repository.ts`
- `backend/src/modules/chat/chat.providers.ts`
- `backend/src/modules/chat/domain/entities/message.entity.ts`
- `backend/src/modules/chat/infra/gateways/retrieval-context.gateway.ts`
- `backend/src/modules/chat/__tests__/prisma-conversation.repository.spec.ts`
- `backend/src/modules/chat/__tests__/send-message.usecase.spec.ts`

**Interface**
- Produz: `PrismaConversationRepository implements IConversationRepository`; `findById` filtra por `{ id, tenantId, userId }` e carrega as mensagens por `createdAt` asc; `save` roda em `$transaction`: um `upsert` da conversa e um `createMany` só das mensagens além das já persistidas (append-only), com `citations` em JSON.
- Produz: `CHAT_PROVIDERS.REPOSITORY.CONVERSATION_REPOSITORY` seleciona por `RAG_STORAGE`, e `MessageCitation { documentId: string; chunkId: string; filename: string; excerpt: string }`. O `RetrievalContextGateway` mapeia `CitationVO.filename`.
- Consome: T-01 `prisma.conversation`, T-01 `prisma.conversationMessage`, T-02 `RAG_STORAGE: 'mysql' | 'memory'`, T-03 `CitationVO { documentId, chunkId, filename, excerpt }`, T-05 `IConversationRepository.findById(tenantId: string, userId: string, conversationId: string): Promise<ConversationEntity | null>`

**Teste RED**
- `backend/src/modules/chat/__tests__/prisma-conversation.repository.spec.ts`, `backend/src/modules/chat/__tests__/send-message.usecase.spec.ts` — `findById` passa `userId` e `tenantId` no `where`; o segundo `save` da mesma conversa chama `createMany` só com as 2 mensagens novas; a resposta do `SendMessageUseCase` traz `citations[0].filename` (comando: `cd backend && npx jest src/modules/chat`)

**Critério de aceite**
- Os specs passam.
- Depois de 2 turnos, o `createMany` capturado recebe 2 mensagens em cada chamada, e não 4 na segunda.
- `citations[0]` contém a chave `filename`.

**Validação**
- `(cd backend && npx jest src/modules/chat)` (evidência: `Test Suites:` todos `passed`)
- `(cd backend && npx tsc --noEmit)` (evidência: exit 0)

### T-11 — Gateway de embeddings locais com transformers.js

**Camada:** backend
**Dependências:** T-02, T-03
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Tesla

**Arquivos prováveis**
- `backend/src/modules/embedding/infra/gateways/local-embedding-provider.gateway.ts`
- `backend/src/modules/embedding/embedding.providers.ts`
- `backend/src/modules/embedding/__tests__/local-embedding-provider.gateway.spec.ts`

**Interface**
- Produz: `LocalEmbeddingProviderGateway implements IEmbeddingProviderGateway`, com um construtor que aceita o loader injetável `(model: string, cacheDir?: string) => Promise<FeatureExtractor>`. O default usa `await import('@huggingface/transformers')` e `pipeline('feature-extraction', model)`; O pipeline é carregado lazy na primeira chamada e reaproveitado; chamadas concorrentes compartilham a mesma promise; `embed` prefixa `EMBEDDING_QUERY_PREFIX` ou `EMBEDDING_PASSAGE_PREFIX` conforme o `kind` e chama o pipeline com `{ pooling: 'mean', normalize: true }`; Falha de carga ou de inferência vira `EmbeddingProviderError` com a mensagem `Falha ao carregar o modelo de embedding <modelo>: <causa>`.
- Produz: `EMBEDDING_PROVIDERS.GATEWAY.EMBEDDING_PROVIDER_GATEWAY` usa o `LocalEmbeddingProviderGateway` quando `EMBEDDING_PROVIDER=local` e o mock `EmbeddingProviderGateway` nos demais casos.
- Consome: T-02 `EMBEDDING_PROVIDER: 'mock' | 'local'`, T-02 `EMBEDDING_QUERY_PREFIX`, T-02 `EMBEDDING_PASSAGE_PREFIX`, T-02 `EMBEDDING_CACHE_DIR`, T-03 `IEmbeddingProviderGateway.embed(text: string, kind: EmbeddingKind): Promise<number[]>`

**Teste RED**
- `backend/src/modules/embedding/__tests__/local-embedding-provider.gateway.spec.ts` — com loader fake: `embed('x', 'query')` chama o pipeline com `'query: x'` e `{ pooling: 'mean', normalize: true }`; `'passage'` usa `'passage: x'`; duas chamadas carregam o modelo uma vez só; loader rejeitando vira `EmbeddingProviderError` com o nome do modelo na mensagem (comando: `cd backend && npx jest src/modules/embedding/__tests__/local-embedding-provider.gateway.spec.ts`)

**Critério de aceite**
- O spec passa sem importar `@huggingface/transformers` e sem rede.
- O loader fake é chamado 1 vez em 2 `embed`.
- O erro tem status 502 e a mensagem contém `Xenova/multilingual-e5-small`.

**Validação**
- `(cd backend && npx jest src/modules/embedding)` (evidência: `Test Suites:` todos `passed`)
- `(cd backend && npx tsc --noEmit)` (evidência: exit 0)
- `(cd backend && npm run build)` (evidência: exit 0, porque o `import()` dinâmico compila com `module: nodenext`)

### T-12 — Gateway Ollama com timeout e erros como LlmProviderError

**Camada:** backend
**Dependências:** T-02
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Levi

**Arquivos prováveis**
- `backend/src/modules/generation/infra/gateways/ollama-llm-provider.gateway.ts`
- `backend/src/modules/generation/generation.providers.ts`
- `backend/src/modules/generation/__tests__/ollama-llm-provider.gateway.spec.ts`

**Interface**
- Produz: `OllamaLlmProviderGateway implements ILlmProviderGateway`, com `fetch` injetável (default: `globalThis.fetch`); Faz `POST ${LLM_BASE_URL}/api/generate` com o corpo `{ model: LLM_MODEL, prompt, stream: false, options: { num_predict: maxOutputTokens, num_ctx: LLM_CONTEXT_WINDOW_TOKENS } }` e `signal: AbortSignal.timeout(LLM_TIMEOUT_MS)`; Mapeia `response` → `text`, `prompt_eval_count` → `inputTokens` e `eval_count` → `outputTokens`; Erros viram `LlmProviderError` (502) com mensagem em pt-BR:
    - conexão recusada → `Ollama indisponível em <url>. Verifique se o serviço está no ar (ollama serve).`
    - timeout → `Ollama não respondeu em <n> ms.`
    - HTTP 404 → `Modelo <modelo> não encontrado no Ollama. Rode: ollama pull <modelo>`
    - outro status → `Ollama respondeu <status>: <corpo resumido>`
- Produz: `GENERATION_PROVIDERS.GATEWAY.LLM_PROVIDER_GATEWAY` usa o `OllamaLlmProviderGateway` quando `LLM_PROVIDER=ollama` e o mock nos demais casos. Nenhuma chamada ao Ollama no boot.
- Consome: T-02 `LLM_PROVIDER: 'mock' | 'ollama'`, T-02 `LLM_BASE_URL`, T-02 `LLM_MODEL`, T-02 `LLM_TIMEOUT_MS`

**Teste RED**
- `backend/src/modules/generation/__tests__/ollama-llm-provider.gateway.spec.ts` — com fetch fake: o sucesso devolve `text`/tokens do JSON e envia `stream: false` e `num_ctx`; `TypeError` com cause `ECONNREFUSED` vira `LlmProviderError` com `ollama serve`; `AbortError`/`TimeoutError` vira mensagem com o timeout; 404 vira mensagem com `ollama pull qwen2.5:7b` (comando: `cd backend && npx jest src/modules/generation/__tests__/ollama-llm-provider.gateway.spec.ts`)

**Critério de aceite**
- O spec passa sem rede.
- Os 3 casos de erro têm `getStatus() === 502` e as mensagens listadas.
- `npx tsc --noEmit` sai com exit 0.

**Validação**
- `(cd backend && npx jest src/modules/generation)` (evidência: `Test Suites:` todos `passed`)
- `(cd backend && npx tsc --noEmit)` (evidência: exit 0)

### T-13 — Camada de dados do rag_assistant

**Camada:** frontend
**Dependências:** T-04, T-05, T-06
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Aang

**Arquivos prováveis**
- `frontend/lib/modules/rag_assistant/data/models/rag_document.dart`
- `frontend/lib/modules/rag_assistant/data/models/chat_answer.dart`
- `frontend/lib/modules/rag_assistant/data/rag_documents_repository.dart`
- `frontend/lib/modules/rag_assistant/data/rag_chat_repository.dart`
- `frontend/lib/modules/rag_assistant/rag_assistant_module.dart`
- `frontend/test/rag_assistant/rag_models_test.dart`
- `frontend/test/support/fake_rag_documents_repository.dart`
- `frontend/test/support/fake_rag_chat_repository.dart`

**Interface**
- Produz: `RagDocument.fromJson(Map<String, dynamic> json)` com `documentId`, `filename`, `mimeType`, `sizeBytes`, `status` (`RagDocumentStatus { pending, processing, ready, failed }`), `errorMessage` e `createdAt` (DateTime), e o getter `bool get isInProgress` (pending/processing). `RagDocumentPage { List<RagDocument> data; int total }`.
- Produz: `ChatAnswer.fromJson` com `conversationId`, `answer` e `citations`, e `ChatCitation { documentId, chunkId, filename, excerpt }`.
- Produz: os repositórios; `abstract interface class IRagDocumentsRepository { Future<RagDocumentPage> list({int page, int limit}); Future<String> upload({required String filename, required Uint8List bytes}); Future<void> delete(String documentId); }`, onde `upload` usa `ApiClient.upload` com `FormData` e campo `file`; `abstract interface class IRagChatRepository { Future<ChatAnswer> ask(String question, {String? conversationId}); }`; Ambos registrados em `registerRagAssistantBinds`.
- Produz: `FakeRagDocumentsRepository` e `FakeRagChatRepository` em `test/support/`.
- Consome: T-04 `GET /documents?page=1&limit=20 → 200 { data: DocumentSummary[]; total: number }`, T-04 `POST /documents multipart/form-data campo file → 202 { documentId: string; status: 'pending' }`, T-04 `DELETE /documents/:id → 204`, T-05 `POST /chat/query { question: string; conversationId?: string }`, T-06 `Future<Response<T>> upload<T>(String path, FormData data)`, T-06 `void registerRagAssistantBinds(ModularContext c)`

**Teste RED**
- `frontend/test/rag_assistant/rag_models_test.dart` — `RagDocument.fromJson` converte `status: 'processing'` em `RagDocumentStatus.processing` com `isInProgress == true` e `errorMessage` nulo; `ChatAnswer.fromJson` lê `citations[0].filename` e `excerpt`; um status desconhecido cai em `failed` sem exceção (comando: `cd frontend && fvm flutter test test/rag_assistant/rag_models_test.dart`)

**Critério de aceite**
- O teste de modelos passa.
- `fvm flutter analyze` imprime `No issues found!`.

**Validação**
- `(cd frontend && fvm flutter test test/rag_assistant/rag_models_test.dart)` (evidência: `All tests passed!`)
- `(cd frontend && fvm flutter analyze)` (evidência: `No issues found!`)

### T-14 — API de documentos: upload multipart, listagem, exclusão e e2e

**Camada:** backend
**Dependências:** T-02, T-03, T-04, T-07, T-08, T-09, T-10
**Paralelizável:** sim
**Complexidade:** alta
**Agente:** Darwin

**Arquivos prováveis**
- `backend/src/modules/documents/application/usecase/document/upload-document.usecase.ts`
- `backend/src/modules/documents/application/usecase/document/list-documents.usecase.ts`
- `backend/src/modules/documents/application/usecase/document/delete-document.usecase.ts`
- `backend/src/modules/documents/application/interface/gateways/document-vectors.gateway.interface.ts`
- `backend/src/modules/documents/infra/gateways/document-vectors.gateway.ts`
- `backend/src/modules/documents/controllers/document.controller.ts`
- `backend/src/modules/documents/controllers/dtos/upload-document.dto.ts`
- `backend/src/modules/documents/controllers/dtos/list-documents.dto.ts`
- `backend/src/modules/documents/documents.module.ts`
- `backend/src/modules/documents/documents.providers.ts`
- `backend/src/main.ts`
- `backend/src/modules/documents/__tests__/upload-document.usecase.spec.ts`
- `backend/src/modules/documents/__tests__/list-documents.usecase.spec.ts`
- `backend/src/modules/documents/__tests__/delete-document.usecase.spec.ts`
- `backend/test/app.e2e-spec.ts`

**Interface**
- Produz: `UploadDocumentInput { tenantId: string; userId: string; filename: string; mimeType: string; sizeBytes: number; buffer: Buffer }`. O `UploadDocumentUseCase` extrai o texto, cria o documento `pending` com `createdById` e enfileira a ingestão.
- Produz: `ListDocumentsUseCase` → `{ data: DocumentSummary[]; total: number }` e `DeleteDocumentUseCase`, que chama `IDocumentVectorsGateway.deleteByDocument` e depois `repository.delete`; documento inexistente no tenant → `NotFound` (404).
- Produz: token `'IDocumentVectorsGateway'`.
- Produz: `DocumentController`; `POST /documents` com `FileInterceptor('file')`, `@ApiConsumes('multipart/form-data')` e `originalname` convertido de latin1 para utf8; `GET /documents` (`DOCUMENT_READ`, `ListDocumentsDto extends PaginationQueryDto`) e `DELETE /documents/:id` (`DOCUMENT_MANAGE`, `@HttpCode(204)`); `MulterModule.registerAsync` com `memoryStorage` e `limits.fileSize = DOCUMENT_MAX_UPLOAD_BYTES`; acima do limite → 413 `ATTACHMENT_TOO_LARGE`.
- Consome: T-02 `DOCUMENT_MAX_UPLOAD_BYTES`, T-02 `ERROR_CODES.ATTACHMENT_TOO_LARGE`, T-03 `deleteByDocument(tenantId: string, documentId: string): Promise<void>`, T-04 `toDocumentSummary(entity: DocumentEntity): DocumentSummary`, T-04 `IDocumentRepository.delete(tenantId: string, documentId: string): Promise<boolean>`, T-07 `PrismaVectorStoreClient implements VectorStoreClient`, T-08 `PrismaDocumentRepository implements IDocumentRepository`, T-09 `ITextExtractorGateway.extract(input: ExtractTextInput): Promise<string>`, T-10 `MessageCitation { documentId: string; chunkId: string; filename: string; excerpt: string }`

**Teste RED**
- `backend/test/app.e2e-spec.ts`, `backend/src/modules/documents/__tests__/upload-document.usecase.spec.ts`, `backend/src/modules/documents/__tests__/list-documents.usecase.spec.ts`, `backend/src/modules/documents/__tests__/delete-document.usecase.spec.ts` — são 7 comportamentos: (1) `POST /documents` multipart com `.md` responde 202 e o status chega a `ready`; (2) `POST /chat/query` devolve uma citação com `filename` igual ao do upload; (3) `GET /documents` lista o documento com `total >= 1`; (4) `DELETE /documents/:id` responde 204, e depois `GET /documents/:id/status` responde 404; (5) upload `.exe` responde 400 `UNSUPPORTED_DOCUMENT_TYPE`; (6) arquivo acima de `DOCUMENT_MAX_UPLOAD_BYTES` responde 413 `ATTACHMENT_TOO_LARGE`; (7) `filename` com acento sai intacto na listagem (comando: `cd backend && npm run test:e2e && npx jest src/modules/documents`)

**Critério de aceite**
- O e2e passa com os 7 casos novos e os anteriores (401, 403, 400 `TENANT_REQUIRED`, 403 `TENANT_OUT_OF_SCOPE`).
- Os specs de documents passam.
- A listagem devolve `filename: "Relatório_ação.md"` para o upload com esse nome.

**Validação**
- `(cd backend && npm run test:e2e)` (evidência: `Tests:` todos `passed`, incluindo `DELETE /documents/:id → 204`, `413 ATTACHMENT_TOO_LARGE` e o nome acentuado preservado)
- `(cd backend && npx jest src/modules/documents)` (evidência: `Test Suites:` todos `passed`)
- `(cd backend && npx tsc --noEmit && npx eslint "{src,test}/**/*.ts")` (evidência: exit 0 nos dois)

### T-15 — Tela Documentos

**Camada:** frontend
**Dependências:** T-06, T-13
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Aang

**Arquivos prováveis**
- `frontend/lib/modules/rag_assistant/presentation/documents/documents_controller.dart`
- `frontend/lib/modules/rag_assistant/presentation/documents/documents_page.dart`
- `frontend/lib/modules/rag_assistant/presentation/documents/documents_binds.dart`
- `frontend/lib/modules/rag_assistant/presentation/documents/widgets/document_tile.dart`
- `frontend/test/rag_assistant/documents_controller_test.dart`

**Interface**
- Produz: `DocumentsController extends ChangeNotifier`, com o construtor `DocumentsController(IRagDocumentsRepository repository, {Duration pollInterval = const Duration(seconds: 3)})`; Métodos: `load({int page = 1})`, `upload(String filename, Uint8List bytes)` e `delete(String documentId)`; Getters: `RagViewState state`, `List<RagDocument> items`, `int total` e `String? errorMessage`; O polling fica ativo só enquanto algum item tem `isInProgress`; `dispose` cancela o timer.
- Produz: `DocumentsPage`; Botão "Enviar documento" (`AppPrimaryButton` + `file_picker` com `withData: true` e `allowedExtensions` md/txt/pdf/docx) e lista de `DocumentTile` com chip de status e `errorMessage` em `failed`; Excluir com `AppConfirmDialog`; `AppPager`, `AppEmptyView`, `AppLoadingView` e `AppErrorView`; feedback por `showAppToast`; Os botões de upload e de excluir só aparecem com `document:manage`.
- Consome: T-13 `IRagDocumentsRepository`, T-13 `FakeRagDocumentsRepository`, T-06 `void registerRagDocumentsBinds(ModularContext c)`, T-06 `enum RagViewState { loading, ready, empty, error }`

**Teste RED**
- `frontend/test/rag_assistant/documents_controller_test.dart` — com `fakeAsync` e o fake: item `processing` faz `list` ser chamado de novo a cada `pollInterval` até o item virar `ready`, e depois disso para; `dispose` com item `processing` não gera nenhuma chamada a `list` depois; `upload` chama o repositório e recarrega; `delete` remove o item da lista; erro do repositório deixa `state == RagViewState.error` (comando: `cd frontend && fvm flutter test test/rag_assistant/documents_controller_test.dart`)

**Critério de aceite**
- O teste passa.
- No caso do `dispose`, o contador de chamadas do fake a `list` não cresce depois de `elapse(pollInterval * 3)`.
- `fvm flutter analyze` imprime `No issues found!`.

**Validação**
- `(cd frontend && fvm flutter test test/rag_assistant/documents_controller_test.dart)` (evidência: `All tests passed!`, incluindo "para o polling após dispose")
- `(cd frontend && fvm flutter analyze)` (evidência: `No issues found!`)

### T-16 — Tela Chat

**Camada:** frontend
**Dependências:** T-06, T-13
**Paralelizável:** sim
**Complexidade:** média
**Agente:** Goku

**Arquivos prováveis**
- `frontend/lib/modules/rag_assistant/presentation/chat/chat_controller.dart`
- `frontend/lib/modules/rag_assistant/presentation/chat/chat_page.dart`
- `frontend/lib/modules/rag_assistant/presentation/chat/chat_binds.dart`
- `frontend/lib/modules/rag_assistant/presentation/chat/widgets/chat_bubble.dart`
- `frontend/lib/modules/rag_assistant/presentation/chat/widgets/citation_card.dart`
- `frontend/test/rag_assistant/chat_controller_test.dart`

**Interface**
- Produz: `ChatController extends ChangeNotifier`, com o construtor `ChatController(IRagChatRepository repository)`; Métodos: `send(String question)` e `newConversation()`; Getters: `List<ChatTurn> turns` (`ChatTurn { role, text, citations }`), `bool isSending`, `String? conversationId` e `String? errorMessage`; Enquanto `isSending`, um novo `send` é ignorado; pergunta vazia é ignorada.
- Produz: `ChatPage`; Bolhas do usuário e do assistente (`ChatBubble`) e `CitationCard` com o nome do documento e o trecho (expansível); Botão "Nova conversa", campo de entrada com envio por Enter e indicador de carregamento na bolha pendente; Erro 502 exibido em `AppErrorBanner` com a mensagem do backend.
- Consome: T-13 `IRagChatRepository`, T-13 `FakeRagChatRepository`, T-06 `void registerRagChatBinds(ModularContext c)`

**Teste RED**
- `frontend/test/rag_assistant/chat_controller_test.dart` — `send('pergunta')` adiciona a bolha do usuário e, depois da resposta do fake, a do assistente com `citations[0].filename`; o segundo `send` repassa o `conversationId` recebido; `newConversation()` limpa `turns` e `conversationId`; `send` durante `isSending` não chama o repositório; `AppException` do fake preenche `errorMessage` e zera `isSending` (comando: `cd frontend && fvm flutter test test/rag_assistant/chat_controller_test.dart`)

**Critério de aceite**
- O teste passa.
- O fake registra o `conversationId` do primeiro retorno na segunda chamada e `null` depois de `newConversation()`.
- `fvm flutter analyze` imprime `No issues found!`.

**Validação**
- `(cd frontend && fvm flutter test test/rag_assistant/chat_controller_test.dart)` (evidência: `All tests passed!`)
- `(cd frontend && fvm flutter analyze)` (evidência: `No issues found!`)

### T-17 — Documentação: envs, README, CLAUDE.md, .docs e guia do Ollama

**Camada:** docs
**Dependências:** T-11, T-12, T-14, T-15, T-16
**Paralelizável:** não
**Complexidade:** simples
**Agente:** Gandalf

**Arquivos prováveis**
- `backend/.env.example`
- `README.md`
- `backend/CLAUDE.md`
- `.docs/rag-assistant-feature.md`
- `.docs/rag-architecture.md`
- `.docs/ollama-setup.md`
- `infra/db/docker-compose.yml`

**Interface**
- Produz: `.env.example` com todas as envs novas e placeholders, sugerindo `EMBEDDING_PROVIDER=local`, `EMBEDDING_MODEL=Xenova/multilingual-e5-small`, `EMBEDDING_DIMENSIONS=384`, `LLM_PROVIDER=ollama`, `LLM_MODEL=qwen2.5:7b` e `RAG_STORAGE=mysql`; `.docs/ollama-setup.md`: instalação no Ubuntu (`curl -fsSL https://ollama.com/install.sh | sh`), `systemctl status ollama`, `nvidia-smi`, `ollama pull qwen2.5:7b`, `ollama run qwen2.5:7b "teste"`, `curl http://localhost:11434/api/tags` e observações para RTX 4060 8 GB e 14 GB de RAM; `rag-assistant-feature.md` reescrito para o geduc-rag: rotas `GET/POST /documents`, `DELETE /documents/:id` e `POST /chat/query` com `filename` na citação; módulo Flutter `rag_assistant`; sem referências a rag-api, porta 8002 ou geduc_lotacao; README com a seção `### Ollama e embeddings locais`; `backend/CLAUDE.md` e `rag-architecture.md` com o estado atual: MySQL como vector store, providers `local`/`ollama`/`mock`; O comentário do docker-compose atualizado.
- Consome: T-02 `RAG_STORAGE: 'mysql' | 'memory'`, T-02 `LLM_TIMEOUT_MS`, T-11 `LocalEmbeddingProviderGateway implements IEmbeddingProviderGateway`, T-12 `OllamaLlmProviderGateway implements ILlmProviderGateway`, T-14 `UploadDocumentInput { tenantId: string; userId: string; filename: string; mimeType: string; sizeBytes: number; buffer: Buffer }`

**Teste RED**
- sem teste: só documentação e comentários, sem comportamento executável.

**Critério de aceite**
- Toda env declarada em `env.validation.ts` aparece em `backend/.env.example`.
- `.docs/ollama-setup.md` contém `ollama pull qwen2.5:7b`.
- `grep -n "rag-api\|8002\|geduc_lotacao" .docs/rag-assistant-feature.md` não imprime nenhuma linha.

**Validação**
- `for k in $(grep -oE "^  [A-Z_]+[?!]?:" backend/src/config/env.validation.ts | tr -d ' ?!:'); do grep -q "^#\? \?$k=" backend/.env.example || echo "FALTA $k"; done` (evidência: nenhuma linha `FALTA`)
- `grep -c "ollama pull qwen2.5:7b" .docs/ollama-setup.md` (evidência: número maior que 0)
- `grep -n "rag-api\|8002\|geduc_lotacao" .docs/rag-assistant-feature.md; echo "exit=$?"` (evidência: `exit=1`, nenhuma linha)

### T-18 — Smoke ponta a ponta com Ollama e embeddings reais

**Camada:** qa
**Dependências:** T-14, T-17
**Paralelizável:** não
**Complexidade:** simples
**Agente:** Sherlock

**Arquivos prováveis**
- `backend/scripts/smoke-rag.sh`
- `backend/scripts/fixtures/smoke-doc.md`
- `README.md`

**Interface**
- Produz: `backend/scripts/smoke-rag.sh`, que usa `curl` e `jq`. Recebe `API_URL` (default `http://localhost:3000`), `SMOKE_EMAIL`, `SMOKE_PASSWORD` e `SMOKE_TENANT_ID` por env, sem ler `.env`; Passos: login, upload multipart de `smoke-doc.md`, polling de `/documents/:id/status` até `ready` (timeout de 180 s), `POST /chat/query` com uma pergunta cuja resposta está no documento e `DELETE` do documento no final; Imprime `SMOKE PASS` com `citations[0].filename`; em falha, imprime `SMOKE FAIL: <etapa>` e sai com exit 1.
- Produz: a seção `### Smoke ponta a ponta` no README.
- Consome: T-04 `POST /documents multipart/form-data campo file → 202 { documentId: string; status: 'pending' }`, T-05 `POST /chat/query { question: string; conversationId?: string }`, T-04 `DELETE /documents/:id → 204`

**Teste RED**
- sem teste: o script é a própria verificação ponta a ponta e depende de serviços externos (MySQL, Ollama, download do modelo), sem espaço para um teste automatizado offline.

**Critério de aceite**
- Com o backend em `LLM_PROVIDER=ollama`, `EMBEDDING_PROVIDER=local` e `RAG_STORAGE=mysql`, o script imprime `SMOKE PASS`, uma resposta não vazia e `filename=smoke-doc.md`, e sai com exit 0.
- Com o Ollama parado (`sudo systemctl stop ollama`), imprime `SMOKE FAIL: chat` com a mensagem 502 `Ollama indisponível` e sai com exit 1.

**Validação**
- `bash -n backend/scripts/smoke-rag.sh && shellcheck backend/scripts/smoke-rag.sh || true` (evidência: `bash -n` sem saída)
- `API_URL=http://localhost:3000 SMOKE_EMAIL=<admin> SMOKE_PASSWORD=<senha> SMOKE_TENANT_ID=<tenant> bash backend/scripts/smoke-rag.sh; echo "exit=$?"` (evidência: `SMOKE PASS filename=smoke-doc.md` e `exit=0`)
- `docker compose -f infra/db/docker-compose.yml exec -T mysql mysql -urag -prag geduc_rag -e "SELECT COUNT(*) FROM document_chunk WHERE document_id NOT IN (SELECT id FROM document)"` (evidência: `0`, sem chunk órfão depois do `DELETE`)

## Legenda

- [ ] pendente
- [~] em andamento
- [x] concluído com evidência
- [!] bloqueado
