# Plano: Assistente RAG ponta a ponta com Ollama, embeddings locais e vetores no MySQL

## Objetivo
Tornar o assistente RAG do geduc-rag funcional ponta a ponta. O usuário sobe documentação (.md, .txt, .pdf, .docx) por tenant e o backend extrai o texto, faz chunking, gera embeddings locais (transformers.js) e persiste documentos, chunks e conversas no MySQL. No chat, a resposta vem de um LLM local via Ollama (qwen2.5:7b), baseada nos trechos recuperados e com citações (trecho e nome do documento). O frontend Flutter ganha o módulo `rag_assistant` com as telas Documentos e Chat.

## Premissas
- As decisões 1–6 da Fase 1 estão fechadas: Ollama (`LLM_PROVIDER=ollama|mock`), transformers.js com `Xenova/multilingual-e5-small` (384 dims, prefixos `query: `/`passage: `), vetores no MySQL com cosseno no backend, upload multipart com extração, `GET /documents` paginado, `DELETE /documents/:id` e o módulo Flutter `rag_assistant`.
- Nos testes, os mocks continuam sendo o default: os defaults do código seguem `mock` e o e2e usa `RAG_STORAGE=memory`, sem Ollama, sem download de modelo e com o Prisma stubado. O `.env.example` passa a sugerir `local`/`ollama`/`mysql`. O `.env` do dev não é editado; o usuário o ajusta seguindo os docs.
- A fila de ingestão continua in-memory. Um documento que ficar em `processing` depois de um restart do backend está fora do escopo (ver Riscos em notes.md).
- As chaves RBAC já existem e não mudam: `document:read`, `document:manage` e `chat:query` (`PERMISSIONS.DOCUMENT_READ/DOCUMENT_MANAGE/CHAT_QUERY`; `AppPermissions.documentRead/documentManage/chatQuery`).
- O repositório ainda não tem nenhum commit. O commit inicial é pré-requisito de execução (ver Perguntas no retorno do planejador).
- A conversa passa a pertencer a (tenant, usuário). Um `conversationId` de outro usuário responde 404 em vez de vazar o histórico dele.

## Escopo

### Incluso
- Schema Prisma com `Document`, `DocumentChunk` (embedding em BLOB Float32), `Conversation` e `ConversationMessage`, mais a migration `rag_persistence` (T-01).
- Dependências e configuração: env de providers, storage, upload e timeouts; códigos de erro novos (T-02).
- Contratos do pipeline: `EmbeddingKind` query/passage, `VectorStoreClient` assíncrono com `deleteByDocument`, `filename` em chunk, busca e citação (T-03).
- Domínio de documentos (mimeType, tamanho, motivo de falha, listagem, exclusão) e o contrato HTTP de documentos (T-04).
- Domínio de chat com a conversa por usuário e o contrato HTTP do chat (T-05).
- Vector store Prisma com cosseno filtrado por tenant (T-07); repositório Prisma de documentos e motivo de falha na ingestão (T-08); extração de texto de .md/.txt/.pdf/.docx (T-09); repositório Prisma de conversas e `filename` nas citações do chat (T-10).
- Gateway de embeddings locais com transformers.js (T-11) e gateway Ollama com timeout e erro virando `LlmProviderError` 502 (T-12).
- API de documentos: upload multipart com limite configurável, `GET /documents` paginado, `DELETE /documents/:id` removendo os chunks, e o e2e atualizado (T-14).
- Frontend: base do módulo `rag_assistant`, com menu, rotas protegidas, `ApiClient.upload` e dependências (T-06); camada de dados (T-13); tela Documentos com upload, lista, polling e exclusão (T-15); tela Chat com bolhas, citações, nova conversa e loading (T-16).
- Docs: `.env.example`, README, `backend/CLAUDE.md`, `.docs/rag-assistant-feature.md`, `.docs/rag-architecture.md` (envs) e o guia de instalação do Ollama no Ubuntu com `ollama pull qwen2.5:7b` (T-17).
- Script de smoke ponta a ponta contra Ollama e embeddings reais (T-18).

### Excluído
- Trocar a fila in-memory por fila persistente, e retomar a ingestão depois de um restart.
- Um índice vetorial dedicado (Qdrant, pgvector etc.) e ANN. A busca é uma varredura linear dos chunks do tenant.
- Streaming da resposta do LLM (SSE) e rerank (`RERANK_ENABLED` segue sem efeito).
- Listar ou retomar conversas antigas no frontend. "Nova conversa" só descarta o `conversationId` local.
- OCR de PDF escaneado: sem texto extraível, o upload é recusado.
- Novas chaves de permissão ou mudanças no RBAC, e alterações no `.env` do dev.
- Reingestão ou reembedding automático de documentos existentes quando o modelo muda.

## Contexto técnico
- Camadas envolvidas: database, backend, frontend, docs, qa
- Projeto/base analisada: /home/kaine/source/geduc-rag (raiz do repositório; `backend/`, `frontend/`, `infra/db/`, `.docs/`)
- Integrações: Ollama HTTP (`http://localhost:11434/api/generate`) e Hugging Face Hub (download do modelo de embedding na primeira execução, com cache local)

## Baseline
- nenhuma. `npx tsc --noEmit` e `npx eslint "{src,test}/**/*.ts"` (sem `--fix`) em `backend/`, e `fvm flutter analyze` em `frontend/`, estão limpos na árvore atual: 0 erros, com as saídas guardadas em `baseline/`. O critério das tasks é exit 0 nesses comandos.

## Exploração read-only
- Caminhos relevantes:
  - Módulos RAG: `backend/src/modules/documents|ingestion|embedding|retrieval|generation|chat`, cada um com `*.providers.ts` (namespaces `X_PROVIDERS`, tokens string como `'IDocumentRepository'`).
  - Infra e exceções: `backend/src/@core/infra/vector-store` (`VECTOR_STORE_CLIENT`), `backend/src/@core/infra/queue` (`InMemoryQueueClient` com catch no handler) e `backend/src/@core/shared/exceptions/502/llm-provider-error.ts`.
  - Config, erros e tenancy: `backend/src/config/env.validation.ts` (class-validator), `backend/src/common/errors/error-codes.ts`, `backend/src/common/filters/all-exceptions.filter.ts` (MulterError `LIMIT_FILE_SIZE` → 413 `ATTACHMENT_TOO_LARGE`) e `backend/src/common/tenancy/tenant-scoped.decorator.ts`.
  - E2e: `backend/test/app.e2e-spec.ts` (stub de Prisma inline) e `backend/test/setup-e2e.ts`.
  - Frontend: `frontend/lib/modules/home/home_module.dart` (reancoragem), `frontend/lib/core/routing/nav_destinations.dart`, `frontend/lib/core/http/api_client.dart`, `frontend/lib/modules/auth/guards/permission_guard.dart` e `frontend/lib/shared/components/`.
- Padrões identificados:
  - Backend (Clean Architecture): use cases puros com `IUseCase`; gateways em `infra/gateways`; DI por `useFactory`; o chunkId tem o formato `<documentId>:<index>`.
  - Paginação: `PaginationQueryDto` (`page`/`limit`, teto 100) e resposta `{ data, total }`.
  - Specs unitários ficam em `src/modules/*/__tests__/*.spec.ts`, com `jest.Mocked`.
  - Frontend: `ChangeNotifier` + `AnimatedBuilder`; repositório com interface `IXRepository`; fakes à mão em `test/support/`; `showAppToast` (SnackBar é proibido); `AppEmptyView`/`AppLoadingView`/`AppErrorView`; `AppConfirmDialog`; `AppPager`.
- Scripts úteis:
  - backend: `npx jest <spec>`, `npm run test:e2e`, `npx tsc --noEmit`, `npx eslint "{src,test}/**/*.ts"` (o `npm run lint` aplica `--fix`) e `npx prisma validate`/`generate`/`migrate status`/`migrate deploy`.
  - frontend: `fvm flutter test`, `fvm flutter analyze` e `fvm flutter pub get`.
- Riscos identificados:
  - O repositório não tem nenhum commit.
  - Arquivos que várias tasks querem tocar: `schema.prisma`, `package.json`/`package-lock.json`, `env.validation.ts`, `app.e2e-spec.ts`, `*.providers.ts`, `home_module.dart`, `nav_destinations.dart` e `pubspec.yaml`/`pubspec.lock`.
  - `@huggingface/transformers` é ESM e baixa binários do onnxruntime.
  - O multer decodifica `originalname` como latin1.
  - O hook `format-file.sh` roda `eslint --fix`/`dart format` a cada edição.
  - O `protect-migrations.sh` pede confirmação em Edit/Write dentro de `prisma/migrations/`.
  - O comentário de `infra/db/docker-compose.yml` diz que os vetores não ficam no MySQL e fica desatualizado.

## Mapa de arquivos

| Arquivo | Responsabilidade | Ação | Tasks que tocam |
|---|---|---|---|
| `backend/prisma/schema.prisma` | models Document, DocumentChunk, Conversation, ConversationMessage | modificar | T-01 |
| `backend/prisma/migrations/20260925000000_rag_persistence/migration.sql` | DDL das novas tabelas | criar | T-01 |
| `backend/package.json` | deps transformers.js, pdf-parse, mammoth, @types/multer; descrição MySQL | modificar | T-02 |
| `backend/package-lock.json` | lockfile | modificar | T-02 |
| `backend/src/config/env.validation.ts` | envs de providers, storage, upload e timeout | modificar | T-02 |
| `backend/src/config/__tests__/env.validation.spec.ts` | testes das envs novas | modificar | T-02 |
| `backend/test/setup-e2e.ts` | e2e com `RAG_STORAGE=memory` e providers mock | modificar | T-02 |
| `backend/src/common/errors/error-codes.ts` | códigos de upload e extração | modificar | T-02 |
| `backend/src/@core/infra/vector-store/vector-store.client.ts` | interface `VectorStoreClient` e records | criar | T-03 |
| `backend/src/@core/infra/vector-store/in-memory-vector-store.client.ts` | implementação em memória assíncrona, com `deleteByDocument` | modificar | T-03 |
| `backend/src/modules/embedding/application/interface/gateways/embedding-provider.gateway.interface.ts` | `embed(text, kind)` | modificar | T-03 |
| `backend/src/modules/embedding/infra/gateways/embedding-provider.gateway.ts` | mock aceita `kind` | modificar | T-03 |
| `backend/src/modules/embedding/application/usecase/embedding/embed-text.usecase.ts` | repassa `kind` | modificar | T-03 |
| `backend/src/modules/embedding/application/usecase/embedding/embed-and-store-chunk.usecase.ts` | embeda `passage`, grava filename/chunkIndex/model | modificar | T-03 |
| `backend/src/modules/embedding/application/interface/gateways/vector-store.gateway.interface.ts` | `UpsertChunkInput` com filename/chunkIndex/model | modificar | T-03 |
| `backend/src/modules/embedding/infra/gateways/vector-store.gateway.ts` | usa `VectorStoreClient` | modificar | T-03 |
| `backend/src/modules/embedding/embedding.providers.ts` ⚠ | tipo do client (T-03, onda 1); seleção do provider por env (T-11, onda 2) | modificar | T-03, T-11 |
| `backend/src/modules/embedding/__tests__/embed-and-store-chunk.usecase.spec.ts` | teste de kind `passage` e campos | modificar | T-03 |
| `backend/src/modules/retrieval/infra/gateways/query-embedding.gateway.ts` | embeda `query` | modificar | T-03 |
| `backend/src/modules/retrieval/application/interface/gateways/vector-search.gateway.interface.ts` | `ChunkSearchResult.filename` | modificar | T-03 |
| `backend/src/modules/retrieval/infra/gateways/vector-store.gateway.ts` | busca assíncrona via `VectorStoreClient` | modificar | T-03 |
| `backend/src/modules/retrieval/application/query-service/chunk/search-chunks.queryservice.ts` | repassa filename | modificar | T-03 |
| `backend/src/modules/retrieval/application/usecase/retrieval/retrieve-context.usecase.ts` | citação com filename | modificar | T-03 |
| `backend/src/modules/retrieval/domain/entities/value-objects/citation.vo.ts` | `CitationVO.filename` | modificar | T-03 |
| `backend/src/modules/retrieval/retrieval.providers.ts` | tipo do client | modificar | T-03 |
| `backend/src/modules/retrieval/__tests__/retrieve-context.usecase.spec.ts` | teste de filename e kind `query` | modificar | T-03 |
| `backend/src/modules/ingestion/application/interface/gateways/embedding-ingest.gateway.interface.ts` | input com filename/chunkIndex | modificar | T-03 |
| `backend/src/modules/ingestion/infra/gateways/embedding-ingest.gateway.ts` | repassa filename/chunkIndex | modificar | T-03 |
| `backend/src/modules/ingestion/application/usecase/ingestion/ingest-document.usecase.ts` ⚠ | filename/chunkIndex (T-03, onda 1); motivo de falha (T-08, onda 2) | modificar | T-03, T-08 |
| `backend/src/modules/ingestion/__tests__/ingest-document.usecase.spec.ts` ⚠ | testes da ingestão (T-03, onda 1; T-08, onda 2) | modificar | T-03, T-08 |
| `backend/src/modules/documents/domain/entities/document.entity.ts` | mimeType, sizeBytes, createdById, errorMessage | modificar | T-04 |
| `backend/src/modules/documents/application/interface/repository/document.repository.interface.ts` | `list` e `delete` | modificar | T-04 |
| `backend/src/modules/documents/infra/database/repositories/in-memory-document.repository.ts` | `list` e `delete` em memória | modificar | T-04 |
| `backend/src/modules/documents/application/usecase/document/document-summary.ts` | `DocumentSummary` e mapper | criar | T-04 |
| `backend/src/modules/documents/__tests__/document.entity.spec.ts` | testes da entidade | modificar | T-04 |
| `backend/src/modules/documents/__tests__/in-memory-document.repository.spec.ts` | testes de list/delete | criar | T-04 |
| `backend/src/modules/chat/domain/entities/conversation.entity.ts` | `userId` | modificar | T-05 |
| `backend/src/modules/chat/application/interface/repository/conversation.repository.interface.ts` | `findById(tenantId, userId, id)` | modificar | T-05 |
| `backend/src/modules/chat/infra/database/repositories/in-memory-conversation.repository.ts` | filtro por usuário | modificar | T-05 |
| `backend/src/modules/chat/application/usecase/chat/send-message.usecase.ts` | `userId` e 404 de conversa alheia | modificar | T-05 |
| `backend/src/modules/chat/controllers/chat.controller.ts` | `@CurrentUser('id')` e Swagger | modificar | T-05 |
| `backend/src/modules/chat/controllers/dtos/chat-query-response.dto.ts` | contrato de resposta do chat | criar | T-05 |
| `backend/src/modules/chat/__tests__/conversation.entity.spec.ts` | teste de userId | modificar | T-05 |
| `backend/src/modules/chat/__tests__/send-message.usecase.spec.ts` ⚠ | userId/404 (T-05, onda 1); citação com filename (T-10, onda 2) | modificar | T-05, T-10 |
| `frontend/pubspec.yaml` | file_picker e fake_async | modificar | T-06 |
| `frontend/pubspec.lock` | lockfile | modificar | T-06 |
| `frontend/lib/core/http/api_client.dart` | `upload` multipart | modificar | T-06 |
| `frontend/lib/core/routing/nav_destinations.dart` | grupo Assistente, com Documentos e Chat | modificar | T-06 |
| `frontend/lib/modules/home/home_module.dart` | registra binds e rotas do rag_assistant | modificar | T-06 |
| `frontend/lib/modules/rag_assistant/rag_assistant_module.dart` ⚠ | rotas/guards (T-06, onda 1); binds de repositórios (T-13, onda 2) | criar | T-06, T-13 |
| `frontend/lib/modules/rag_assistant/presentation/rag_view_state.dart` | `RagViewState` | criar | T-06 |
| `frontend/lib/modules/rag_assistant/presentation/documents/documents_binds.dart` ⚠ | stub (T-06, onda 1); controller (T-15, onda 3) | criar | T-06, T-15 |
| `frontend/lib/modules/rag_assistant/presentation/documents/documents_page.dart` ⚠ | placeholder (T-06, onda 1); tela (T-15, onda 3) | criar | T-06, T-15 |
| `frontend/lib/modules/rag_assistant/presentation/chat/chat_binds.dart` ⚠ | stub (T-06, onda 1); controller (T-16, onda 3) | criar | T-06, T-16 |
| `frontend/lib/modules/rag_assistant/presentation/chat/chat_page.dart` ⚠ | placeholder (T-06, onda 1); tela (T-16, onda 3) | criar | T-06, T-16 |
| `frontend/test/rag_assistant/rag_navigation_test.dart` | menu filtrado por permissão | criar | T-06 |
| `backend/src/@core/infra/vector-store/prisma-vector-store.client.ts` | cosseno no backend, filtrado por tenant | criar | T-07 |
| `backend/src/@core/infra/vector-store/float32-codec.ts` | vetor ↔ BLOB Float32 LE | criar | T-07 |
| `backend/src/@core/infra/vector-store/vector-store.module.ts` | seleção por `RAG_STORAGE` | modificar | T-07 |
| `backend/src/@core/infra/vector-store/__tests__/prisma-vector-store.client.spec.ts` | busca, isolamento e dims | criar | T-07 |
| `backend/src/modules/documents/infra/database/repositories/prisma-document.repository.ts` | persistência de documentos | criar | T-08 |
| `backend/src/modules/documents/documents.providers.ts` ⚠ | seleção do repositório (T-08, onda 2); use cases novos (T-14, onda 3) | modificar | T-08, T-14 |
| `backend/src/modules/documents/application/usecase/document/update-document-status.usecase.ts` | `reason` na falha | modificar | T-08 |
| `backend/src/modules/ingestion/application/interface/gateways/document-status.gateway.interface.ts` | `markFailed(..., reason?)` | modificar | T-08 |
| `backend/src/modules/ingestion/infra/gateways/document-status.gateway.ts` | repassa `reason` | modificar | T-08 |
| `backend/src/modules/documents/__tests__/prisma-document.repository.spec.ts` | mapeamento e isolamento | criar | T-08 |
| `backend/src/modules/documents/application/interface/gateways/text-extractor.gateway.interface.ts` | `ITextExtractorGateway` | criar | T-09 |
| `backend/src/modules/documents/infra/gateways/text-extractor.gateway.ts` | extração de md/txt/pdf/docx | criar | T-09 |
| `backend/src/modules/documents/__tests__/text-extractor.gateway.spec.ts` | extração por formato | criar | T-09 |
| `backend/src/modules/documents/__tests__/fixtures/sample.pdf` | fixture PDF com texto | criar | T-09 |
| `backend/src/modules/documents/__tests__/fixtures/sample.docx` | fixture DOCX com texto | criar | T-09 |
| `backend/src/modules/chat/infra/database/repositories/prisma-conversation.repository.ts` | persistência de conversas | criar | T-10 |
| `backend/src/modules/chat/chat.providers.ts` | seleção do repositório | modificar | T-10 |
| `backend/src/modules/chat/domain/entities/message.entity.ts` | `MessageCitation.filename` | modificar | T-10 |
| `backend/src/modules/chat/infra/gateways/retrieval-context.gateway.ts` | mapeia filename | modificar | T-10 |
| `backend/src/modules/chat/__tests__/prisma-conversation.repository.spec.ts` | persistência append-only | criar | T-10 |
| `backend/src/modules/embedding/infra/gateways/local-embedding-provider.gateway.ts` | transformers.js lazy, com prefixos e5 | criar | T-11 |
| `backend/src/modules/embedding/__tests__/local-embedding-provider.gateway.spec.ts` | prefixos, pooling e erro | criar | T-11 |
| `backend/src/modules/generation/infra/gateways/ollama-llm-provider.gateway.ts` | HTTP Ollama, timeout e erros | criar | T-12 |
| `backend/src/modules/generation/generation.providers.ts` | seleção por `LLM_PROVIDER` | modificar | T-12 |
| `backend/src/modules/generation/__tests__/ollama-llm-provider.gateway.spec.ts` | sucesso, timeout, conexão recusada, 404 | criar | T-12 |
| `frontend/lib/modules/rag_assistant/data/models/rag_document.dart` | `RagDocument`, `RagDocumentPage` | criar | T-13 |
| `frontend/lib/modules/rag_assistant/data/models/chat_answer.dart` | `ChatAnswer`, `ChatCitation` | criar | T-13 |
| `frontend/lib/modules/rag_assistant/data/rag_documents_repository.dart` | list/upload/delete | criar | T-13 |
| `frontend/lib/modules/rag_assistant/data/rag_chat_repository.dart` | ask | criar | T-13 |
| `frontend/test/rag_assistant/rag_models_test.dart` | fromJson | criar | T-13 |
| `frontend/test/support/fake_rag_documents_repository.dart` | fake | criar | T-13 |
| `frontend/test/support/fake_rag_chat_repository.dart` | fake | criar | T-13 |
| `backend/src/modules/documents/application/usecase/document/upload-document.usecase.ts` | upload com extração | modificar | T-14 |
| `backend/src/modules/documents/application/usecase/document/list-documents.usecase.ts` | listagem paginada | criar | T-14 |
| `backend/src/modules/documents/application/usecase/document/delete-document.usecase.ts` | exclusão com chunks | criar | T-14 |
| `backend/src/modules/documents/application/interface/gateways/document-vectors.gateway.interface.ts` | `IDocumentVectorsGateway` | criar | T-14 |
| `backend/src/modules/documents/infra/gateways/document-vectors.gateway.ts` | chama `VectorStoreClient.deleteByDocument` | criar | T-14 |
| `backend/src/modules/documents/controllers/document.controller.ts` | POST multipart, GET lista, DELETE | modificar | T-14 |
| `backend/src/modules/documents/controllers/dtos/upload-document.dto.ts` | DTO Swagger do multipart | modificar | T-14 |
| `backend/src/modules/documents/controllers/dtos/list-documents.dto.ts` | query paginada | criar | T-14 |
| `backend/src/modules/documents/documents.module.ts` | `MulterModule.registerAsync` com limite | modificar | T-14 |
| `backend/src/main.ts` | comentário do limite JSON | modificar | T-14 |
| `backend/src/modules/documents/__tests__/upload-document.usecase.spec.ts` | upload com extrator | modificar | T-14 |
| `backend/src/modules/documents/__tests__/list-documents.usecase.spec.ts` | listagem | criar | T-14 |
| `backend/src/modules/documents/__tests__/delete-document.usecase.spec.ts` | exclusão | criar | T-14 |
| `backend/test/app.e2e-spec.ts` | fluxo multipart, listagem, exclusão, 400 e 413 | modificar | T-14 |
| `frontend/lib/modules/rag_assistant/presentation/documents/documents_controller.dart` | estado, upload, exclusão, polling | criar | T-15 |
| `frontend/lib/modules/rag_assistant/presentation/documents/widgets/document_tile.dart` | linha com status | criar | T-15 |
| `frontend/test/rag_assistant/documents_controller_test.dart` | polling, upload, exclusão | criar | T-15 |
| `frontend/lib/modules/rag_assistant/presentation/chat/chat_controller.dart` | turnos, loading, nova conversa | criar | T-16 |
| `frontend/lib/modules/rag_assistant/presentation/chat/widgets/chat_bubble.dart` | bolha | criar | T-16 |
| `frontend/lib/modules/rag_assistant/presentation/chat/widgets/citation_card.dart` | trecho e nome do documento | criar | T-16 |
| `frontend/test/rag_assistant/chat_controller_test.dart` | envio, erro, nova conversa | criar | T-16 |
| `backend/.env.example` | envs novas com placeholders | modificar | T-17 |
| `README.md` ⚠ | setup Ollama/embeddings (T-17, onda 4); smoke (T-18, onda 5) | modificar | T-17, T-18 |
| `backend/CLAUDE.md` | estado atual do pipeline | modificar | T-17 |
| `.docs/rag-assistant-feature.md` | feature atualizada para o geduc-rag | modificar | T-17 |
| `.docs/rag-architecture.md` | envs e vector store MySQL | modificar | T-17 |
| `.docs/ollama-setup.md` | instalação do Ollama no Ubuntu | criar | T-17 |
| `infra/db/docker-compose.yml` | comentário sobre os vetores no MySQL | modificar | T-17 |
| `backend/scripts/smoke-rag.sh` | smoke ponta a ponta | criar | T-18 |
| `backend/scripts/fixtures/smoke-doc.md` | documento do smoke | criar | T-18 |

Todo arquivo com ⚠ é tocado por tasks em ondas diferentes; a serialização resolve o compartilhamento (ver Estratégia de execução).

## Decisões de arquitetura

| Decisão | Alternativas consideradas | Motivo da escolha |
|---|---|---|
| Embedding em `Bytes @db.Blob` (Float32 little-endian) | JSON `number[]`; `LONGTEXT` | 384 floats ocupam 1.536 bytes, contra cerca de 7–8 KB em JSON. A decodificação direta via `Float32Array` evita `JSON.parse` a cada busca, e a perda de precisão de float64 para float32 é irrelevante para o cosseno. |
| Cosseno no backend sobre os chunks do tenant (`WHERE tenant_id = ?` com o documento `ready`, ignorando `dimensions` diferente) | Índice vetorial externo; MySQL HeatWave | É a decisão 3 do usuário. É suficiente para dezenas de milhares de chunks por tenant, e o filtro por dimensão evita NaN depois de uma troca de modelo. |
| `RAG_STORAGE=mysql\|memory` (default `mysql`; o e2e usa `memory`) | Estender o stub de Prisma do e2e com mapas | Mantém o e2e sem banco, conforme a premissa, e os adapters in-memory continuam úteis. Os repositórios Prisma têm specs unitários com `PrismaService` mockado. |
| Extração de texto síncrona no request de upload (gateway em `documents/infra`) | Extrair na ingestão assíncrona | Um formato inválido ou um PDF sem texto respondem 400 na hora, sem criar um documento `failed`. O `content` extraído fica em `Document.content`, e a ingestão segue lendo texto. |
| `filename` da citação vem de um join `document_chunk → document` na busca | Denormalizar o filename no chunk | Evita duplicar o dado, e renomear no futuro não deixa o chunk desatualizado. |
| Conversa por (tenant, usuário), e `conversationId` alheio responde 404 | Escopo só por tenant | Impede ler ou anexar à conversa de outro usuário e evita a violação de PK ao recriar um id existente. |
| Mensagens persistidas em modo append-only (`createMany` só das mensagens além das já gravadas) | Apagar e recriar o histórico a cada turno | Não reescreve o histórico e cabe em uma transação. |
| transformers.js carregado lazy com `import()` dinâmico, pipeline `feature-extraction` com `{ pooling: 'mean', normalize: true }` e prefixos `query: `/`passage: ` configuráveis | Carregar no boot | O boot não baixa o modelo nem falha offline. O e5 exige os prefixos, e o jest nunca importa o pacote ESM porque o loader é injetável. |
| Ollama via `fetch` nativo `POST /api/generate` (`stream: false`, `options.num_predict` e `options.num_ctx = LLM_CONTEXT_WINDOW_TOKENS`) com `AbortSignal.timeout(LLM_TIMEOUT_MS)` | SDK `ollama` do npm; `/api/chat` | Não adiciona dependência. O prompt já vem montado pelo `PromptBuilderService`, e `num_ctx` evita o truncamento silencioso do contexto padrão do Ollama. |
| Os defaults do código continuam `mock`; o `.env.example` sugere `local`/`ollama` | Default `local`/`ollama` no código | Testes e CI nunca dependem de Ollama nem de download (premissa). |

## Diagrama de dependências

```text
Onda 1: T-01 · T-02 · T-03 · T-04 · T-05 · T-06
T-01,T-02,T-03 ─→ T-07
T-01,T-02,T-03,T-04 ─→ T-08
T-02 ─→ T-09
T-01,T-02,T-03,T-05 ─→ T-10
T-02,T-03 ─→ T-11
T-02 ─→ T-12
T-04,T-05,T-06 ─→ T-13
T-02,T-03,T-04,T-07,T-08,T-09,T-10 ─→ T-14
T-06,T-13 ─→ T-15
T-06,T-13 ─→ T-16
T-11,T-12,T-14,T-15,T-16 ─→ T-17
T-14,T-17 ─→ T-18
```

## Estratégia de execução
- Branch de trabalho: `task/assistente-rag-ollama`
- Branch base: `main`
- Commits da onda: cada implementador commita os próprios caminhos (`git commit -- <caminhos>`); com `worktree por agente` eles chegam pelos merges de `wave<N>/T-XX`. O fechador usa a skill `new-commit --auto` só se sobrou algo sem commit e sempre registra o estado das tasks num `chore(tasks): registra commits da onda N`.
- Isolamento em ondas com edições paralelas: caminho exclusivo. Cada arquivo compartilhado (⚠) é tocado por tasks de ondas diferentes. Os lockfiles (`package-lock.json`, `pubspec.lock`) têm um único dono (T-02 e T-06, respectivamente), e só esse dono roda `npm install`/`fvm flutter pub get` que altere lockfile. `npx prisma generate` só roda em T-01 (o client gerado fica fora da árvore versionada). Nas ondas seguintes, os agentes não reinstalam dependências.

## Ondas de execução

### Onda 1
- T-01 — schema e migration
- T-02 — dependências, env e códigos de erro
- T-03 — contratos de embedding e vector store
- T-04 — domínio e contrato HTTP de documentos
- T-05 — domínio e contrato HTTP do chat
- T-06 — base do módulo Flutter

### Onda 2
- T-07 — vector store Prisma
- T-08 — repositório Prisma de documentos e motivo de falha
- T-09 — extração de texto
- T-10 — repositório Prisma de conversas e filename nas citações
- T-11 — embeddings locais
- T-12 — gateway Ollama
- T-13 — camada de dados do frontend

### Onda 3
- T-14 — API de documentos e e2e
- T-15 — tela Documentos
- T-16 — tela Chat

### Onda 4
- T-17 — documentação

### Onda 5
- T-18 — smoke ponta a ponta

## Agentes

| Agente | subagent_type | model | Tasks |
|---|---|---|---|
| Sun Tzu — orquestrador | — | — | todas |
| Darwin | general-purpose | inherit | T-01, T-08, T-14 |
| Levi | general-purpose | inherit | T-02, T-12 |
| Platão | general-purpose | inherit | T-03, T-07 |
| Athena | general-purpose | inherit | T-04, T-09 |
| Jaspion | general-purpose | inherit | T-05, T-10 |
| Tesla | general-purpose | inherit | T-11 |
| Aang | general-purpose | inherit | T-06, T-13, T-15 |
| Goku | general-purpose | inherit | T-16 |
| Gandalf | geduc:documentador | sonnet | T-17 |
| Sherlock | general-purpose | inherit | T-18 |

## Review Focus
- Upload de `Relatório_ação.pdf` (o multer decodifica `originalname` como latin1) → `GET /documents` devolve `filename: "Relatório_ação.pdf"` com a acentuação intacta → T-14
- `POST /chat/query` com `conversationId` de outro usuário do mesmo tenant → 404, sem o histórico alheio no prompt e sem 500 por PK duplicada → T-05
- Tenant com chunks de `dimensions` diferente do vetor da pergunta (dados gravados antes de trocar o modelo) → esses chunks são ignorados, sem `NaN` no score nem exceção → T-07
- `DELETE /documents/:id` enquanto a ingestão está em `processing` → o processo não cai, a falha fica só no log, o documento some da listagem e não sobra `document_chunk` dele → T-08
- Sair da tela Documentos com item `processing` → o polling para, sem nenhuma chamada a `list` depois do `dispose` → T-15

## Critérios gerais de aceite
- `(cd backend && npx tsc --noEmit)` e `(cd backend && npx eslint "{src,test}/**/*.ts")` com exit 0.
- `(cd backend && npx jest)` e `(cd backend && npm run test:e2e)` passam sem Ollama instalado e sem rede.
- `(cd frontend && fvm flutter analyze)` imprime `No issues found!`, e `(cd frontend && fvm flutter test)` passa.
- Com MySQL, Ollama (`qwen2.5:7b`) e `EMBEDDING_PROVIDER=local` no ar, `backend/scripts/smoke-rag.sh` imprime `SMOKE PASS` com pelo menos uma citação contendo `filename`.
- Registros existentes de `user`, `tenant` e `user_tenant` mantêm a mesma contagem antes e depois da migration.
