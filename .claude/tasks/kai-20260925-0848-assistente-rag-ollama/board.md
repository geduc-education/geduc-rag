# Board — kai-20260925-0848-assistente-rag-ollama

Log append-only de fatos que afetam outras tasks desta execução: contrato divergente, símbolo renomeado, arquivo compartilhado alterado, decisão que outra task precisa conhecer. Uma linha por fato, acrescentada por append com heredoc (abaixo; o delimitador entre aspas aceita qualquer caractere no fato); nunca edite ou remova linhas. Leia antes de começar uma task e antes de usar cada `Consome`. O fechador consolida as linhas em `notes.md § Descobertas`.

Formato: `- [T-NN] <fato>`

Append:

```bash
cat >> "/home/kaine/source/geduc-rag/.claude/tasks/kai-20260925-0848-assistente-rag-ollama/board.md" <<'EOF'
- [T-NN] <fato>
EOF
```
- [T-01] Migration 20260925000000_rag_persistence aplicada e Prisma Client regenerado (de477ff): `prisma.document`, `documentChunk`, `conversation`, `conversationMessage` e enums `DocumentStatus`/`MessageRole` disponíveis em `@prisma/client`. Back-relations: `User.documents`, `User.conversations`, `Tenant.documents`, `Tenant.conversations`.
- [T-04] `IDocumentRepository` ganhou `list(tenantId, page, limit)` e `delete(tenantId, documentId)`: todo mock `jest.Mocked<IDocumentRepository>` e toda implementação (T-08 Prisma) precisam dos dois. `DocumentProps` aceita `errorMessage?: string | null` (reidratação no T-08) além de `mimeType`/`sizeBytes`/`createdById`. `DocumentSummary`/`toDocumentSummary` em `backend/src/modules/documents/application/usecase/document/document-summary.ts`. Truncamento em `DOCUMENT_ERROR_MESSAGE_MAX_LENGTH = 500` (exportado da entidade).
- [T-06] Pronto: `ApiClient.upload<T>(path, FormData)`, `NavGroup.assistente`, `registerRagDocumentsBinds`/`registerRagChatBinds` (stubs vazios em `presentation/{documents,chat}/*_binds.dart`), `DocumentsPage`/`ChatPage` stubs e `RagViewState` em `presentation/rag_view_state.dart`. `file_picker` e `fake_async` (dev) já estão no pubspec.lock (bd00b01).
- [T-05] `IConversationRepository.findById(tenantId, userId, conversationId)` e `ConversationProps.userId` entregues; sem `conversationId` o use case cria conversa nova sem chamar `findById`; `ChatQueryResponseDto` já declara `citations[].filename` no Swagger, mas `MessageCitation.filename` fica para o T-10 (controller segue retornando `SendMessageOutput`).
- [T-02] Envs novas em EnvironmentVariables (c4317a3): EMBEDDING_PROVIDER mock|local, EMBEDDING_MODEL=Xenova/multilingual-e5-small, EMBEDDING_DIMENSIONS=384 (antes 1536), EMBEDDING_QUERY_PREFIX, EMBEDDING_PASSAGE_PREFIX, EMBEDDING_CACHE_DIR?, LLM_PROVIDER mock|ollama, LLM_BASE_URL (IsUrl, default http://localhost:11434), LLM_MODEL (agora string com default qwen2.5:7b, não mais opcional), LLM_TIMEOUT_MS=120000, RAG_STORAGE mysql|memory, DOCUMENT_MAX_UPLOAD_BYTES=10485760. ERROR_CODES ganhou ATTACHMENT_TOO_LARGE, UNSUPPORTED_DOCUMENT_TYPE, DOCUMENT_TEXT_EMPTY. Versões: @huggingface/transformers 4.3.0, pdf-parse 2.4.5, mammoth 1.12.3, @types/multer 2.2.0.
- [T-03] Contratos publicados: `VectorStoreClient` em `backend/src/@core/infra/vector-store/vector-store.client.ts` (upsert/search/deleteByDocument, todos async; `VectorStoreRecord` com filename/chunkIndex/embeddingModel); `EmbeddingKind` exportado de `embedding-provider.gateway.interface.ts`; `CitationVO` e `ChunkSearchResult`/`RetrievedChunk` ganharam `filename`. Gateways importam o client com `import type` (TS1272 com emitDecoratorMetadata).
- [T-03] `EmbedTextUseCase` deixou de `implements IUseCase` (a assinatura `execute(text, kind)` não cabe em `execute(input?)`). O gateway mock de embedding ignora `kind`. `chat/infra/gateways/retrieval-context.gateway.ts` ainda não repassa `citation.filename` (fica para o T-10).
